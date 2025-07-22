/**
 * TTS 打斷檢測模組
 * 負責檢測用戶語音並智慧地打斷正在播放的 TTS
 */

export interface TtsInterruptDetectorOptions {
  /** 基線噪音值 */
  baselineNoise: number;
  /** TTS 開始時間 */
  ttsStartTime: number;
  /** TTS 音量樣本 */
  ttsVolumeSamples: number[];
  /** 音量變化計數 */
  volumeChangeCount: number;
  /** 停止 TTS 播放的回調函數 */
  onStopTts: () => void;
}

export interface VoiceDetectionResult {
  /** 是否應該停止 TTS */
  shouldStopTts: boolean;
  /** 檢測到的原因 */
  reason?: string;
  /** 調試信息 */
  debugInfo?: Record<string, any>;
}

/**
 * TTS 打斷檢測器類
 */
export class TtsInterruptDetector {
  private options: TtsInterruptDetectorOptions;

  constructor(options: TtsInterruptDetectorOptions) {
    this.options = options;
  }

  /**
   * 更新選項
   */
  updateOptions(newOptions: Partial<TtsInterruptDetectorOptions>) {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * 計算動態語音閾值
   */
  private getVoiceThreshold(): number {
    const { baselineNoise, ttsVolumeSamples, ttsStartTime } = this.options;
    
    // 檢查是否在瀏覽器環境且 TTS 正在播放
    if (typeof window !== 'undefined' && speechSynthesis && speechSynthesis.speaking) {
      // TTS剛開始播放的前1秒使用較高閾值避免初始波動誤判
      const timeSinceStart = Date.now() - ttsStartTime;
      if (timeSinceStart < 1000) {
        return baselineNoise + 20; // 前1秒使用較高閾值
      }
      
      // 動態計算：基於收集到的TTS音量數據
      if (ttsVolumeSamples.length > 8) {
        const avgTtsVolume = ttsVolumeSamples.reduce((sum, vol) => sum + vol, 0) / ttsVolumeSamples.length;
        const maxTtsVolume = Math.max(...ttsVolumeSamples);
        // 使用平衡的倍數：取平均值的1.4倍或最大值的1.2倍，選較大者
        const balancedThreshold = Math.max(
          avgTtsVolume * 1.4,
          maxTtsVolume * 1.2,
          baselineNoise + 30
        );
        return balancedThreshold;
      }
      // 如果還沒收集到足夠數據，使用中等固定值
      return baselineNoise + 15;
    }
    return baselineNoise + 1; // 正常情況下的語音閾值
  }

  /**
   * 檢查是否為 TTS 播放狀態
   */
  private isTtsPlaying(): boolean {
    return typeof window !== 'undefined' && speechSynthesis && speechSynthesis.speaking;
  }

  /**
   * 檢測語音並決定是否應該打斷 TTS
   */
  detectVoiceInterrupt(currentVolume: number): VoiceDetectionResult {
    const { ttsStartTime, volumeChangeCount, onStopTts } = this.options;
    
    // 如果 TTS 沒有在播放，不需要檢測打斷
    if (!this.isTtsPlaying()) {
      return { shouldStopTts: false };
    }

    const voiceThreshold = this.getVoiceThreshold();
    const isVoiceDetected = currentVolume >= voiceThreshold;

    if (!isVoiceDetected) {
      return { shouldStopTts: false };
    }

    // 額外驗證：檢查是否真的是人聲打斷
    const timeSinceStart = Date.now() - ttsStartTime;
    const hasSignificantVolumeChange = volumeChangeCount > 1; // 有顯著音量變化（降低門檻）
    const isAboveThreshold = currentVolume > voiceThreshold; // 超過基本閾值即可

    const debugInfo = {
      timeSinceStart,
      hasSignificantVolumeChange,
      isAboveThreshold,
      currentVolume: currentVolume.toFixed(1),
      threshold: voiceThreshold.toFixed(1),
      volumeChangeCount
    };

    // 判斷是否應該停止 TTS
    if (timeSinceStart > 500 && (hasSignificantVolumeChange || isAboveThreshold)) {
      console.log('🔇 檢測到用戶說話，立即停止TTS播放', debugInfo);
      
      // 執行停止 TTS 的回調
      onStopTts();
      
      return {
        shouldStopTts: true,
        reason: '檢測到用戶語音打斷',
        debugInfo
      };
    } else {
      console.log('⚠️ 疑似誤判，不停止TTS', debugInfo);
      
      return {
        shouldStopTts: false,
        reason: '疑似誤判，未達到打斷條件',
        debugInfo
      };
    }
  }

  /**
   * 獲取當前的語音閾值（用於顯示）
   */
  getCurrentVoiceThreshold(): number {
    return this.getVoiceThreshold();
  }
}

/**
 * 創建 TTS 打斷檢測器的工廠函數
 */
export function createTtsInterruptDetector(options: TtsInterruptDetectorOptions): TtsInterruptDetector {
  return new TtsInterruptDetector(options);
}

/**
 * 常量配置
 */
export const TTS_INTERRUPT_CONFIG = {
  /** TTS 開始後的保護期（毫秒） */
  PROTECTION_PERIOD: 500,
  /** 初始高閾值倍數 */
  INITIAL_HIGH_THRESHOLD: 20,
  /** 動態閾值 - 平均值倍數 */
  DYNAMIC_AVG_MULTIPLIER: 1.4,
  /** 動態閾值 - 最大值倍數 */
  DYNAMIC_MAX_MULTIPLIER: 1.2,
  /** 最小動態閾值增量 */
  MIN_DYNAMIC_THRESHOLD: 30,
  /** 中等固定閾值增量 */
  MEDIUM_THRESHOLD: 15,
  /** 正常語音閾值增量 */
  NORMAL_THRESHOLD: 1,
  /** 需要的最小 TTS 樣本數 */
  MIN_TTS_SAMPLES: 8,
  /** 最小音量變化計數 */
  MIN_VOLUME_CHANGE_COUNT: 1
} as const;
