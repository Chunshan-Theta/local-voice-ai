import { NextApiRequest, NextApiResponse } from 'next';
import { chatWithOllama } from '../../lib/ollama';

interface ReplyRequest {
  message: string;
}

interface ReplyResponse {
  reply: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReplyResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支援 POST 方法' });
  }

  try {
    const { message } = req.body as ReplyRequest;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: '訊息不能為空' });
    }

    // AI 聊天回覆
    const reply = await chatWithOllama(message);

    res.status(200).json({
      reply,
    });

  } catch (error) {
    console.error('Reply API error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'AI 回覆錯誤' 
    });
  }
} 