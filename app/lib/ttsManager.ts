interface TtsConfig {
  enabled: boolean;
  voice: string | null;
  rate: number;
  volume: number;
  pitch: number;
}

interface TtsCallbacks {
  onStart?: (text: string, messageId?: string) => void;
  onEnd?: (messageId?: string) => void;
  onError?: (error: any, messageId?: string) => void;
  onSpeakingChange?: (speaking: boolean) => void;
}

export interface TtsManager {
  speak: (text: string, messageId?: string) => void;
  stop: () => void;
  destroy: () => void;
  isSpeaking: () => boolean;
}

class TtsManagerImpl implements TtsManager {
  private config: TtsConfig;
  private callbacks: TtsCallbacks;
  private speaking: boolean = false;
  private audioContext: AudioContext | null = null;
  private streamBuffer: Uint8Array = new Uint8Array(0);
  private streamController: AbortController | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  constructor(config: TtsConfig, callbacks: TtsCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  public async speak(text: string, messageId?: string) {
    if (!this.config.enabled || !text.trim()) {
      return;
    }

    try {
      // Stop any current speech
      this.stop();

      // Notify start
      this.speaking = true;
      this.callbacks.onStart?.(text, messageId);
      this.callbacks.onSpeakingChange?.(true);

      // 初始化音频上下文
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      // 创建中止控制器
      this.streamController = new AbortController();

      // Call the speech API with stream support
      const response = await fetch('/api/speech-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: text }),
        signal: this.streamController.signal,
      });

      // 詳細的錯誤處理
      if (!response.ok) {
        const errorBody = await response.text().catch(() => null);
        const error: any = new Error(`Speech API responded with status ${response.status}`);
        error.status = response.status;
        error.statusText = response.statusText;
        error.response = errorBody;
        
        // 嘗試解析錯誤響應
        try {
          error.details = errorBody ? JSON.parse(errorBody) : null;
        } catch {
          error.details = null;
        }
        
        throw error;
      }

      // 檢查是否為流式響應
      const isChunked = response.headers.get('transfer-encoding') === 'chunked';
      
      if (isChunked && response.body) {
        // 处理流式响应
        console.log('🌊 检测到流式响应，开始流式播放');
        await this.handleStreamingAudio(response, messageId);
      } else {
        // 处理完整响应（向后兼容）
        console.log('📦 使用完整音频响应');
        await this.handleCompleteAudio(response, messageId);
      }

    } catch (error) {
      console.error('TTS error:', error);
      this.speaking = false;
      this.callbacks.onSpeakingChange?.(false);
      this.callbacks.onError?.(error, messageId);
    }
  }

  public stop() {
    // 中止流式请求
    if (this.streamController) {
      this.streamController.abort();
      this.streamController = null;
    }

    // 停止当前播放的音频
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    // 清空流缓冲区
    this.streamBuffer = new Uint8Array(0);
    
    this.speaking = false;
    this.callbacks.onSpeakingChange?.(false);
  }

  public destroy() {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.currentAudio) {
      this.currentAudio = null;
    }
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }

  // 处理流式音频数据
  private async handleStreamingAudio(response: Response, messageId?: string) {
    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    const reader = response.body.getReader();
    this.streamBuffer = new Uint8Array(0);
    let totalBytesReceived = 0;
    let playbackStarted = false;

    console.log('🌊 开始接收流式音频数据');

    try {
      // 开始接收数据并尽快开始播放
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log(`✅ 流式接收完成，总计: ${totalBytesReceived} bytes`);
          
          // 如果还没开始播放，现在播放所有接收到的数据
          if (!playbackStarted && this.streamBuffer.length > 0) {
            await this.playStreamBuffer(messageId);
          }
          break;
        }

        if (value && value.length > 0) {
          totalBytesReceived += value.length;
          
          // 累积音频数据
          const newBuffer = new Uint8Array(this.streamBuffer.length + value.length);
          newBuffer.set(this.streamBuffer);
          newBuffer.set(value, this.streamBuffer.length);
          this.streamBuffer = newBuffer;

          // 收到足够数据后立即开始播放（快速响应）
          if (!playbackStarted && this.streamBuffer.length >= 8192) {
            console.log(`🎵 收到 ${this.streamBuffer.length} bytes，立即开始播放`);
            playbackStarted = true;
            
            // 在后台播放当前数据，同时继续接收
            this.playStreamBuffer(messageId);
            
            // 继续接收剩余数据但不再阻塞播放
          }
        }
      }

    } catch (error) {
      console.error('❌ 流式音频处理错误:', error);
      throw error;
    }
  }

  // 播放流缓冲区中的音频数据
  private async playStreamBuffer(messageId?: string) {
    if (this.streamBuffer.length === 0) return;

    try {
      console.log(`🎵 播放流式音频数据，大小: ${this.streamBuffer.length} bytes`);
      
      // 创建 Blob 和 URL
      const audioBlob = new Blob([this.streamBuffer], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // 停止之前的音频（如果有）
      if (this.currentAudio) {
        this.currentAudio.pause();
      }
      
      // 使用 HTML Audio 元素播放
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.volume = this.config.volume;
      
      // 设置事件监听器
      this.currentAudio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.speaking = false;
        this.callbacks.onSpeakingChange?.(false);
        this.callbacks.onEnd?.(messageId);
      };
      
      this.currentAudio.onerror = (error) => {
        console.error('流式音频播放错误:', error);
        URL.revokeObjectURL(audioUrl);
        this.speaking = false;
        this.callbacks.onSpeakingChange?.(false);
        this.callbacks.onError?.(error, messageId);
      };
      
      // 开始播放
      await this.currentAudio.play();
      console.log('✅ 流式音频开始播放');
      
    } catch (error) {
      console.error('流式音频播放失败:', error);
      this.callbacks.onError?.(error, messageId);
    }
  }

  // 处理完整音频数据（向后兼容）
  private async handleCompleteAudio(response: Response, messageId?: string) {
    // 檢查響應內容類型
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('audio/')) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    // Get audio data
    const audioData = await response.arrayBuffer();
    
    // 驗證音頻數據
    if (!audioData || audioData.byteLength === 0) {
      throw new Error('Received empty audio data');
    }

    // 使用 HTML Audio 元素播放
    const audioBlob = new Blob([audioData], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    this.currentAudio = new Audio(audioUrl);
    this.currentAudio.volume = this.config.volume;
    
    // Handle completion
    this.currentAudio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      this.speaking = false;
      this.callbacks.onSpeakingChange?.(false);
      this.callbacks.onEnd?.(messageId);
    };

    this.currentAudio.onerror = (error) => {
      console.error('音频播放错误:', error);
      URL.revokeObjectURL(audioUrl);
      this.speaking = false;
      this.callbacks.onSpeakingChange?.(false);
      this.callbacks.onError?.(error, messageId);
    };

    await this.currentAudio.play();
  }
}

export function createTtsManager(config: TtsConfig, callbacks: TtsCallbacks): TtsManager {
  return new TtsManagerImpl(config, callbacks);
}
