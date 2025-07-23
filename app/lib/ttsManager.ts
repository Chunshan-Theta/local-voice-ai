/**
 * TTS (Text-to-Speech) 模組
 * 負責語音合成功能，包括語音選擇、播放控制、狀態管理等
 */

export interface TtsOptions {
  /** 是否啟用TTS */
  enabled: boolean;
  /** 語音對象 */
  voice: SpeechSynthesisVoice | null;
  /** 語速 (0.1 - 10) */
  rate: number;
  /** 音量 (0 - 1) */
  volume: number;
  /** 音調 (0 - 2) */
  pitch: number;
}

export interface TtsCallbacks {
  /** TTS開始播放回調 */
  onStart?: (text: string, messageId?: string) => void;
  /** TTS播放結束回調 */
  onEnd?: (messageId?: string) => void;
  /** TTS播放錯誤回調 */
  onError?: (error: SpeechSynthesisErrorEvent, messageId?: string) => void;
  /** 語音狀態改變回調 */
  onSpeakingChange?: (isSpeaking: boolean) => void;
}

export interface TtsState {
  /** 是否正在播放 */
  isSpeaking: boolean;
  /** 可用語音列表 */
  availableVoices: SpeechSynthesisVoice[];
  /** 當前正在播放的消息ID */
  currentMessageId?: string;
}

/**
 * TTS管理器類
 */
export class TtsManager {
  private options: TtsOptions;
  private callbacks: TtsCallbacks;
  private state: TtsState;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private speakingCheckInterval: NodeJS.Timeout | null = null;

  constructor(options: TtsOptions, callbacks: TtsCallbacks = {}) {
    this.options = options;
    this.callbacks = callbacks;
    this.state = {
      isSpeaking: false,
      availableVoices: [],
      currentMessageId: undefined
    };

    this.initializeVoices();
    this.startSpeakingMonitor();
  }

  /**
   * 初始化可用語音列表
   */
  private initializeVoices(): void {
    // 確保在瀏覽器環境中運行
    if (typeof window === 'undefined' || !speechSynthesis) return;

    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      this.state.availableVoices = voices;
      
      // 如果還沒有選擇語音，優先選擇中文語音
      if (!this.options.voice && voices.length > 0) {
        const chineseVoice = voices.find(voice => 
          voice.lang.includes('zh') || 
          voice.lang.includes('cmn') ||
          voice.name.includes('Chinese') ||
          voice.name.includes('中文')
        );
        
        if (chineseVoice) {
          this.options.voice = chineseVoice;
          console.log('🗣️ 自動選擇中文語音:', chineseVoice.name, chineseVoice.lang);
        } else {
          this.options.voice = voices[0];
          console.log('🗣️ 自動選擇預設語音:', voices[0].name, voices[0].lang);
        }
      }
    };

    // 語音列表可能需要時間載入
    if (speechSynthesis.getVoices().length === 0) {
      speechSynthesis.addEventListener('voiceschanged', loadVoices);
    } else {
      loadVoices();
    }
  }

  /**
   * 開始監控語音合成狀態
   */
  private startSpeakingMonitor(): void {
    if (typeof window === 'undefined' || !speechSynthesis) return;

    this.speakingCheckInterval = setInterval(() => {
      const isSpeaking = speechSynthesis.speaking;
      if (this.state.isSpeaking !== isSpeaking) {
        this.state.isSpeaking = isSpeaking;
        if (this.callbacks.onSpeakingChange) {
          this.callbacks.onSpeakingChange(isSpeaking);
        }
      }
    }, 100);
  }

  /**
   * 停止監控語音合成狀態
   */
  private stopSpeakingMonitor(): void {
    if (this.speakingCheckInterval) {
      clearInterval(this.speakingCheckInterval);
      this.speakingCheckInterval = null;
    }
  }

  /**
   * 移除文本中的emoji
   */
  private removeEmojis(text: string): string {
    // 使用正則表達式移除emoji和其他符號
    return text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|[\uD83C-\uD83E][\uDC00-\uDFFF]|[\u1F600-\u1F64F]|[\u1F300-\u1F5FF]|[\u1F680-\u1F6FF]|[\u1F1E0-\u1F1FF]/g, '');
  }

  /**
   * 播放文本
   */
  speak(text: string, messageId?: string): boolean {
    // 確保在瀏覽器環境中運行
    if (typeof window === 'undefined' || !speechSynthesis) return false;

    // 如果TTS未啟用，直接返回
    if (!this.options.enabled) return false;

    // 停止當前播放
    this.stop();
    
    if (!text.trim()) return false;

    // 移除emoji
    const cleanText = this.removeEmojis(text);
    
    if (!cleanText.trim()) return false;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    this.currentUtterance = utterance;

    // 設置語音參數
    if (this.options.voice) {
      utterance.voice = this.options.voice;
    }
    utterance.rate = this.options.rate;
    utterance.volume = this.options.volume;
    utterance.pitch = this.options.pitch;

    // 事件監聽
    utterance.onstart = () => {
      console.log('🗣️ 開始朗讀:', cleanText.substring(0, 50) + '...');
      this.state.currentMessageId = messageId;
      
      if (this.callbacks.onStart) {
        this.callbacks.onStart(text, messageId);
      }
    };

    utterance.onend = () => {
      console.log('✅ 朗讀完成');
      this.state.currentMessageId = undefined;
      this.currentUtterance = null;
      
      if (this.callbacks.onEnd) {
        this.callbacks.onEnd(messageId);
      }
    };

    utterance.onerror = (event) => {
      console.error('❌ TTS 錯誤:', event.error);
      this.state.currentMessageId = undefined;
      this.currentUtterance = null;
      
      if (this.callbacks.onError) {
        this.callbacks.onError(event, messageId);
      }
    };

    speechSynthesis.speak(utterance);
    return true;
  }

  /**
   * 停止播放
   */
  stop(): void {
    // 確保在瀏覽器環境中運行
    if (typeof window === 'undefined' || !speechSynthesis) return;

    speechSynthesis.cancel();
    this.state.currentMessageId = undefined;
    this.currentUtterance = null;
  }

  /**
   * 檢查是否正在播放
   */
  isSpeaking(): boolean {
    return this.state.isSpeaking;
  }

  /**
   * 獲取當前播放的消息ID
   */
  getCurrentMessageId(): string | undefined {
    return this.state.currentMessageId;
  }

  /**
   * 獲取可用語音列表
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.state.availableVoices;
  }

  /**
   * 更新TTS選項
   */
  updateOptions(newOptions: Partial<TtsOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * 更新回調函數
   */
  updateCallbacks(newCallbacks: Partial<TtsCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...newCallbacks };
  }

  /**
   * 獲取當前TTS選項
   */
  getOptions(): TtsOptions {
    return { ...this.options };
  }

  /**
   * 獲取當前TTS狀態
   */
  getState(): TtsState {
    return { ...this.state };
  }

  /**
   * 設置語音
   */
  setVoice(voice: SpeechSynthesisVoice | null): void {
    this.options.voice = voice;
  }

  /**
   * 設置語速
   */
  setRate(rate: number): void {
    this.options.rate = Math.max(0.1, Math.min(10, rate));
  }

  /**
   * 設置音量
   */
  setVolume(volume: number): void {
    this.options.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * 設置音調
   */
  setPitch(pitch: number): void {
    this.options.pitch = Math.max(0, Math.min(2, pitch));
  }

  /**
   * 啟用或禁用TTS
   */
  setEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  /**
   * 清理資源
   */
  destroy(): void {
    this.stop();
    this.stopSpeakingMonitor();
    
    // 移除事件監聽器
    if (typeof window !== 'undefined' && speechSynthesis) {
      speechSynthesis.removeEventListener('voiceschanged', this.initializeVoices);
    }
  }
}

/**
 * 創建TTS管理器的工廠函數
 */
export function createTtsManager(
  options: TtsOptions,
  callbacks: TtsCallbacks = {}
): TtsManager {
  return new TtsManager(options, callbacks);
}

/**
 * TTS相關常量
 */
export const TTS_CONFIG = {
  /** 預設TTS選項 */
  DEFAULT_OPTIONS: {
    enabled: true,
    voice: null,
    rate: 1.25,
    volume: 0.8,
    pitch: 1.0
  } as TtsOptions,
  /** 語速範圍 */
  RATE_RANGE: { min: 0.5, max: 2.0, step: 0.1 },
  /** 音量範圍 */
  VOLUME_RANGE: { min: 0, max: 1, step: 0.1 },
  /** 音調範圍 */
  PITCH_RANGE: { min: 0, max: 2, step: 0.1 }
} as const;
