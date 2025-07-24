import { NextApiRequest, NextApiResponse } from 'next';
import { chatWithOllama } from '../../lib/ollama';
import type { AgentConfig } from '../../src/class/types/basic';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ReplyRequest {
  message: string;
  conversationHistory?: ConversationMessage[];
  agentConfig?: AgentConfig;
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
    const { message, conversationHistory = [], agentConfig } = req.body as ReplyRequest;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: '訊息不能為空' });
    }

    console.log('📥 API received request:');
    console.log('Processing message:', message);
    console.log('Conversation history length:', conversationHistory.length);
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Agent config received:', {
      exists: !!agentConfig,
      name: agentConfig?.name || 'No name',
      instructionsLength: agentConfig?.instructions?.length || 0,
      voice: agentConfig?.voice || 'No voice',
      lang: agentConfig?.lang || 'No lang'
    });
    
    if (agentConfig && agentConfig.instructions) {
      console.log('Agent instructions preview:', agentConfig.instructions.substring(0, 100) + '...');
    } else {
      console.log('⚠️ No agent config or instructions provided, using default system prompt');
    }

    // AI 聊天回覆，傳入對話歷史和 agent 配置
    const reply = await chatWithOllama(message, conversationHistory, agentConfig);

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