import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const OLLAMA_BASE_URL = 'https://loaclhost:11343';
const WHISPER_SERVICE_URL = 'http://localhost:5001';  // 修改端口

export async function whisperWithOllama(audioFilePath: string): Promise<string> {
  console.log('Processing audio file with local Python Whisper service:', audioFilePath);
  
  try {
    const formData = new FormData();
    const audioBuffer = fs.readFileSync(audioFilePath);
    formData.append('audio', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });

    const response = await axios.post('http://localhost:5001/transcribe', formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 120000, // 增加到 2 分鐘超時
      maxContentLength: 50 * 1024 * 1024, // 50MB 最大內容長度
      maxBodyLength: 50 * 1024 * 1024,    // 50MB 最大請求體長度
    });

    const result = response.data;
    console.log('Whisper response:', result);

    if (result.transcript) {
      return result.transcript;
    } else {
      throw new Error('未收到辨識結果');
    }
  } catch (error) {
    console.error('Whisper API error:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNRESET') {
        throw new Error('Whisper 服務連接中斷 - 音頻檔案可能過大或處理時間過長');
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('無法連接到 Whisper 服務 - 請檢查 Docker 容器是否正在運行');
      } else if (error.response) {
        throw new Error(`Whisper API 錯誤: ${error.response.data?.error || error.message}`);
      } else {
        throw new Error(`網路錯誤: ${error.message}`);
      }
    }
    
    throw new Error('語音辨識失敗 - 請檢查 Whisper 服務狀態');
  }
}

export async function chatWithOllama(prompt: string): Promise<string> {
  console.log('Sending prompt to Ollama:', prompt);
  
  try {
    const response = await axios.post('https://site.ollama.lazyinwork.com/api/generate', {
      model: 'gemma3:4b',
      prompt: prompt,
      stream: false
    }, {
      timeout: 30000, // 30秒超時
    });

    if (response.data && response.data.response) {
      return response.data.response;
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