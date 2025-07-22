import axios from 'axios';
import type { ConversationMessage } from './ollama';

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
  destroy: () => void;
}

const DEFAULT_CONFIG: Required<ReplyManagerConfig> = {
  maxHistoryLength: 10,
  timeout: 60000,
};

export const createReplyManager = (
  config: ReplyManagerConfig = {},
  callbacks: ReplyManagerCallbacks = {}
): ReplyManager => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
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
      const replyResponse = await axios.post('/api/reply', {
        message: transcript,
        conversationHistory: validHistory,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: finalConfig.timeout,
      });

      const { reply } = replyResponse.data;
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

  return {
    processAudio,
    destroy,
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
