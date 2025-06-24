import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { whisperWithOllama, chatWithOllama } from '../../lib/ollama';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface ChatResponse {
  transcript: string;
  reply: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支援 POST 方法' });
  }

  try {
    const form = formidable({
      uploadDir: './tmp',
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
    
    if (!transcript.trim()) {
      return res.status(400).json({ error: '語音辨識無結果' });
    }

    // AI 聊天回覆
    const reply = await chatWithOllama(transcript);

    res.status(200).json({
      transcript,
      reply,
    });

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : '伺服器錯誤' 
    });
  }
} 