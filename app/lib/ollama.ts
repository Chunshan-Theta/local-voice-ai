import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

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

export async function chatWithOllama(prompt: string): Promise<string> {
  console.log('Sending prompt to Ollama:', prompt);
  
  try {
    const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: OLLAMA_MODEL,
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