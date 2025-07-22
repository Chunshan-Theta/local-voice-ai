import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'https://site.ollama.lazyinwork.com';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:1b';
const WHISPER_SERVICE_URL = process.env.WHISPER_SERVICE_URL || 'http://whisper-service:5001';

export async function whisperWithOllama(audioFilePath: string): Promise<string> {
  console.log('Processing audio file with local Python Whisper service:', audioFilePath);
  
  try {
    // Check if file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file does not exist: ${audioFilePath}`);
    }

    const formData = new FormData();
    const audioBuffer = fs.readFileSync(audioFilePath);
    formData.append('audio', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });

    const response = await axios.post(`${WHISPER_SERVICE_URL}/transcribe`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 120000, // 2 minutes timeout
      maxContentLength: 50 * 1024 * 1024, // 50MB max content length
      maxBodyLength: 50 * 1024 * 1024,    // 50MB max body length
    });

    const result = response.data;
    console.log('Whisper response:', result);

    if (result.transcript !== undefined) {
      return result.transcript || '';
    } else {
      throw new Error('No transcription result received');
    }
  } catch (error) {
    console.error('Whisper API error:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNRESET') {
        throw new Error('Whisper service connection reset - audio file may be too large or processing took too long');
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('Could not connect to Whisper service - please check if the service is running');
      } else if (error.response) {
        throw new Error(`Whisper API error: ${error.response.data?.error || error.message}`);
      } else {
        throw new Error(`Network error: ${error.message}`);
      }
    }
    
    throw new Error('Voice recognition failed - please check Whisper service status');
  }
}

export async function chatWithOllama(
  userMessage: string, 
  conversationHistory: ConversationMessage[] = []
): Promise<string> {
  console.log('Sending message to Ollama:', userMessage);
  console.log('Conversation history length:', conversationHistory.length);
  
  // 系統提示詞 - 讓 AI 表現得像真人
  const systemPrompt = `你是一個友善、自然的語音對話夥伴。請用遵守以下方式回應：

1. 使用自然、口語化的表達方式，就像真人對話一樣
2. 回應要簡潔明瞭，通常 1-2 句話即可
3. 適當使用語氣詞和表達情感，如：哦、啊、呢、吧、真的嗎、太好了等
4. 根據對話內容調整語調：輕鬆、關心、興奮、同情等
5. 可以適當提問來保持對話流暢
6. 避免過於正式或機械化的回答
7. 如果話題需要，可以分享相關的經驗或看法
8. 保持友善和正面的態度
9. 不要有表情符號等非口語對話內容，例如不要使用「😊」這樣的表情符號

請記住，這是語音對話，你的回應會被朗讀出來，所以要聽起來自然流暢。`;

  try {
    // 構建完整的對話上下文
    let fullPrompt = systemPrompt + "\n\n";
    
    // 添加最近的對話歷史（限制為最近 6 輪對話避免過長）
    const recentHistory = conversationHistory.slice(-6);
    
    if (recentHistory.length > 0) {
      fullPrompt += "最近的對話歷史：\n";
      recentHistory.forEach((msg) => {
        const speaker = msg.role === 'user' ? '用戶' : '助手';
        fullPrompt += `${speaker}：${msg.content}\n`;
      });
      fullPrompt += "\n";
    }
    
    // 添加當前用戶消息
    fullPrompt += `現在用戶說：${userMessage}\n\n請以自然、真人般的方式回應：`;

    const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: fullPrompt,
      stream: false,
      options: {
        temperature: 0.8,  // 增加一些創造性
        top_p: 0.9,       // 保持回應的多樣性
        top_k: 40,        // 適中的詞彙選擇範圍
      }
    }, {
      timeout: 30000, // 30秒超時
    });

    if (response.data && response.data.response) {
      const reply = response.data.response.trim();
      console.log('Ollama response:', reply);
      return reply;
    } else {
      throw new Error('未收到有效回應');
    }
  } catch (error) {
    console.error('Ollama API error:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.response) {
        throw new Error(`Ollama API 錯誤: ${error.response.data?.error || error.message}`);
      } else {
        throw new Error(`網路錯誤: ${error.message}`);
      }
    }
    
    throw new Error('聊天服務失敗');
  }
} 