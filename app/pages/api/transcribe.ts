import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { whisperWithOllama } from '../../lib/ollama';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface TranscribeResponse {
  transcript: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TranscribeResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支援 POST 方法' });
  }

  try {
    // 確保 tmp 目錄存在
    const uploadDir = './tmp';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    const [fields, files] = await form.parse(req);
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;

    if (!audioFile) {
      return res.status(400).json({ error: '未找到音訊檔案' });
    }

    // 語音辨識
    const transcript = await whisperWithOllama(audioFile.filepath);
    
    // 清理臨時文件
    try {
      if (fs.existsSync(audioFile.filepath)) {
        fs.unlinkSync(audioFile.filepath);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup temporary file:', cleanupError);
    }
    
    if (!transcript.trim()) {
      return res.status(200).json({ 
        transcript: "（未識別到語音）"
      });
    }

    res.status(200).json({
      transcript,
    });

  } catch (error) {
    console.error('Transcribe API error:', error);
    
    // 清理臨時文件 (在錯誤情況下也要清理)
    try {
      const uploadDir = './tmp';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const form = formidable({
        uploadDir,
        keepExtensions: true,
      });
      const [, files] = await form.parse(req);
      const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;
      
      if (audioFile && audioFile.filepath) {
        if (fs.existsSync(audioFile.filepath)) {
          fs.unlinkSync(audioFile.filepath);
        }
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup temporary file in error handler:', cleanupError);
    }
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : '語音轉錄錯誤' 
    });
  }
} 