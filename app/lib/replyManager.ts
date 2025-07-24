import axios from 'axios';
import type { ConversationMessage } from './ollama';
import type { AgentConfig } from '../src/class/types/basic';

export interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  isPlaying?: boolean;
}

export interface ReplyManagerConfig {
  maxHistoryLength?: number;
  timeout?: number;
  agentConfig?: AgentConfig;
}

export interface ReplyManagerCallbacks {
  onTranscriptionStart?: (messageId: string) => void;
  onTranscriptionComplete?: (messageId: string, transcript: string) => void;
  onReplyStart?: (messageId: string) => void;
  onReplyComplete?: (messageId: string, reply: string) => void;
  onError?: (error: string, messageId?: string) => void;
  onSpeakReply?: (text: string, messageId: string) => void;
}

export interface ReplyManager {
  processAudio: (audioBlob: Blob, conversationHistory: Message[]) => Promise<{ userMessageId: string; aiMessageId: string }>;
  processTextMessage: (text: string, conversationHistory: Message[]) => Promise<{ userMessageId: string; aiMessageId: string }>;
  destroy: () => void;
  updateAgentConfig: (agentConfig: AgentConfig) => void;
}

const DEFAULT_CONFIG: Omit<Required<ReplyManagerConfig>, 'agentConfig'> = {
  maxHistoryLength: 10,
  timeout: 60000,
};

export const createReplyManager = (
  config: ReplyManagerConfig = {},
  callbacks: ReplyManagerCallbacks = {}
): ReplyManager => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let currentAgentConfig = config.agentConfig;
  
  const processAudio = async (
    audioBlob: Blob, 
    conversationHistory: Message[]
  ): Promise<{ userMessageId: string; aiMessageId: string }> => {
    // 檢查音頻大小
    if (audioBlob.size < 1000) {
      throw new Error('音頻檔案太小，可能沒有錄到聲音');
    }

    // 創建用戶消息
    const userMessageId = `user_${Date.now()}`;
    callbacks.onTranscriptionStart?.(userMessageId);

    try {
      // 步驟1：語音轉錄
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      const transcribeResponse = await axios.post('/api/transcribe', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      const { transcript } = transcribeResponse.data;
      callbacks.onTranscriptionComplete?.(userMessageId, transcript);

      // 如果轉錄結果為空，不進行AI回覆
      if (!transcript.trim() || transcript === '（未識別到語音）') {
        throw new Error('未識別到有效語音');
      }

      // 創建AI消息
      const aiMessageId = `ai_${Date.now()}`;
      callbacks.onReplyStart?.(aiMessageId);

      // 步驟2：構建對話歷史
      const validHistory: ConversationMessage[] = conversationHistory
        .filter(msg => 
          !msg.isLoading && 
          msg.content.trim() && 
          msg.content !== '正在轉錄語音...' && 
          msg.content !== '正在思考回覆...'
        )
        .slice(-finalConfig.maxHistoryLength) // 只保留最近的消息
        .map(msg => ({
          role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
          content: msg.content
        }));

      console.log('Conversation history:', validHistory);

      // 步驟3：獲取AI回覆
      console.log('🔄 準備發送請求到 /api/reply');
      console.log('📋 當前 agentConfig:', currentAgentConfig?.name || 'No agent config');
      
      const replyResponse = await axios.post('/api/reply', {
        message: transcript,
        conversationHistory: validHistory,
        agentConfig: currentAgentConfig,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: finalConfig.timeout,
      });

      const { reply } = replyResponse.data;
      console.log('✅ 收到 AI 回覆:', reply.substring(0, 50) + '...');
      callbacks.onReplyComplete?.(aiMessageId, reply);

      // 觸發TTS播放
      if (reply.trim()) {
        callbacks.onSpeakReply?.(reply, aiMessageId);
      }

      return { userMessageId, aiMessageId };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '處理失敗';
      callbacks.onError?.(errorMessage, userMessageId);
      throw error;
    }
  };

  const processTextMessage = async (
    text: string,
    conversationHistory: Message[]
  ): Promise<{ userMessageId: string; aiMessageId: string }> => {
    const userMessageId = `user-${Date.now()}`;
    const aiMessageId = `ai-${Date.now()}`;

    try {
      // 步驟1：創建用戶消息
      callbacks.onTranscriptionStart?.(userMessageId);
      callbacks.onTranscriptionComplete?.(userMessageId, text);

      // 步驟2：開始AI回覆
      callbacks.onReplyStart?.(aiMessageId);

      // 準備對話歷史
      const validHistory = conversationHistory
        .filter(msg => !msg.isLoading && msg.content.trim())
        .slice(-finalConfig.maxHistoryLength)
        .map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        } as ConversationMessage));

      // 步驟3：獲取AI回覆
      console.log('🔄 processTextMessage 準備發送請求到 /api/reply');
      console.log('📋 當前 agentConfig:', currentAgentConfig?.name || 'No agent config');
      console.log('💬 用戶消息:', text);
      
      // 檢查 agentConfig 的完整性
      if (currentAgentConfig) {
        console.log('🔍 agentConfig 詳細檢查:');
        console.log('  - Name:', currentAgentConfig.name);
        console.log('  - Instructions exist:', !!currentAgentConfig.instructions);
        console.log('  - Instructions length:', currentAgentConfig.instructions?.length || 0);
        console.log('  - Instructions preview:', currentAgentConfig.instructions?.substring(0, 100) + '...' || 'No instructions');
        console.log('  - Voice:', currentAgentConfig.voice);
        console.log('  - Lang:', currentAgentConfig.lang);
      } else {
        console.log('❌ currentAgentConfig is null or undefined');
      }
      
      const requestPayload = {
        message: text,
        conversationHistory: validHistory,
        agentConfig: currentAgentConfig,
      };
      
      console.log('📤 Request payload summary:', {
        message: text,
        historyLength: validHistory.length,
        agentConfigExists: !!currentAgentConfig,
        agentConfigName: currentAgentConfig?.name || 'No name'
      });
      
      const replyResponse = await axios.post('/api/reply', requestPayload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: finalConfig.timeout,
      });

      const { reply } = replyResponse.data;
      console.log('✅ processTextMessage 收到 AI 回覆:', reply.substring(0, 50) + '...');
      callbacks.onReplyComplete?.(aiMessageId, reply);

      // 觸發TTS播放
      if (reply.trim()) {
        callbacks.onSpeakReply?.(reply, aiMessageId);
      }

      return { userMessageId, aiMessageId };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '處理失敗';
      callbacks.onError?.(errorMessage, userMessageId);
      throw error;
    }
  };

  const destroy = () => {
    // 清理資源（如果有的話）
    console.log('ReplyManager destroyed');
  };

  const updateAgentConfig = (agentConfig: AgentConfig) => {
    currentAgentConfig = agentConfig;
    console.log('🔄 ReplyManager agent config updated:', agentConfig.name);
    console.log('📋 Agent config details:');
    console.log('  - Name:', agentConfig.name);
    console.log('  - Instructions length:', agentConfig.instructions.length);
    console.log('  - Voice:', agentConfig.voice);
    console.log('  - Language:', agentConfig.lang);
  };

  return {
    processAudio,
    processTextMessage,
    destroy,
    updateAgentConfig,
  };
};

// 工具函數：檢查音頻是否有效
export const isAudioValid = (audioBlob: Blob): boolean => {
  return audioBlob.size >= 1000;
};

// 工具函數：格式化錯誤消息
export const formatReplyError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message.includes('timeout')) {
      return '請求超時，請重試';
    }
    if (error.message.includes('Network Error')) {
      return '網路連接錯誤，請檢查網路';
    }
    return error.message;
  }
  return '未知錯誤';
};
