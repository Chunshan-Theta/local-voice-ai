import { EventEmitter } from 'events';

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

class TtsManagerImpl extends EventEmitter implements TtsManager {
  private config: TtsConfig;
  private callbacks: TtsCallbacks;
  private speaking: boolean = false;
  private audioContext: AudioContext | null = null;
  private audioSource: AudioBufferSourceNode | null = null;

  constructor(config: TtsConfig, callbacks: TtsCallbacks) {
    super();
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

      // Call the speech API
      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: text }),
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

      // Play audio
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const audioBuffer = await this.audioContext.decodeAudioData(audioData);
      this.audioSource = this.audioContext.createBufferSource();
      this.audioSource.buffer = audioBuffer;
      this.audioSource.connect(this.audioContext.destination);

      // Handle completion
      this.audioSource.onended = () => {
        this.speaking = false;
        this.callbacks.onSpeakingChange?.(false);
        this.callbacks.onEnd?.(messageId);
      };

      this.audioSource.start();

    } catch (error) {
      console.error('TTS error:', error);
      this.speaking = false;
      this.callbacks.onSpeakingChange?.(false);
      this.callbacks.onError?.(error, messageId);
    }
  }

  public stop() {
    if (this.audioSource) {
      try {
        this.audioSource.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      this.audioSource = null;
    }
    
    this.speaking = false;
    this.callbacks.onSpeakingChange?.(false);
  }

  public destroy() {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }
}

export function createTtsManager(config: TtsConfig, callbacks: TtsCallbacks): TtsManager {
  return new TtsManagerImpl(config, callbacks);
}
