/**
 * 環境噪音校準模組
 * 負責檢測和計算環境噪音基線，為語音檢測提供動態閾值
 */

export interface NoiseCalibrationOptions {
  /** 校準持續時間（毫秒） */
  calibrationDuration: number;
  /** 最小基線噪音值 */
  minBaselineNoise: number;
  /** 採樣間隔（毫秒） */
  samplingInterval: number;
  /** 校準進度回調 */
  onProgress?: (progress: number, currentVolume: number) => void;
  /** 校準完成回調 */
  onComplete?: (baselineNoise: number) => void;
  /** 校準錯誤回調 */
  onError?: (error: Error) => void;
}

export interface CalibrationResult {
  /** 計算出的基線噪音值 */
  baselineNoise: number;
  /** 校準期間收集的樣本數據 */
  samples: number[];
  /** 校準統計信息 */
  stats: {
    mean: number;
    min: number;
    max: number;
    stdDev: number;
  };
}

/**
 * 環境噪音校準器類
 */
export class NoiseCalibrator {
  private options: NoiseCalibrationOptions;
  private calibrationData: number[] = [];
  private calibrationInterval: NodeJS.Timeout | null = null;
  private isCalibrating = false;

  constructor(options: NoiseCalibrationOptions) {
    this.options = options;
  }

  /**
   * 開始校準環境噪音
   */
  async startCalibration(analyser: AnalyserNode): Promise<CalibrationResult> {
    if (this.isCalibrating) {
      throw new Error('校準已在進行中');
    }

    this.isCalibrating = true;
    this.calibrationData = [];

    return new Promise((resolve, reject) => {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const calibrationStart = Date.now();

      this.calibrationInterval = setInterval(() => {
        try {
          analyser.getByteFrequencyData(dataArray);
          const sum = Array.from(dataArray).reduce((a, b) => a + b, 0);
          const average = sum / dataArray.length;
          
          this.calibrationData.push(average);
          
          const elapsed = Date.now() - calibrationStart;
          const progress = Math.min((elapsed / this.options.calibrationDuration) * 100, 100);
          
          // 觸發進度回調
          if (this.options.onProgress) {
            this.options.onProgress(progress, average);
          }
          
          if (elapsed >= this.options.calibrationDuration) {
            this.stopCalibration();
            
            try {
              const result = this.calculateResult();
              
              // 觸發完成回調
              if (this.options.onComplete) {
                this.options.onComplete(result.baselineNoise);
              }
              
              resolve(result);
            } catch (error) {
              reject(error);
            }
          }
        } catch (error) {
          this.stopCalibration();
          const calibrationError = error instanceof Error ? error : new Error('校準過程中發生未知錯誤');
          
          // 觸發錯誤回調
          if (this.options.onError) {
            this.options.onError(calibrationError);
          }
          
          reject(calibrationError);
        }
      }, this.options.samplingInterval);
    });
  }

  /**
   * 停止校準
   */
  stopCalibration(): void {
    if (this.calibrationInterval) {
      clearInterval(this.calibrationInterval);
      this.calibrationInterval = null;
    }
    this.isCalibrating = false;
  }

  /**
   * 計算校準結果
   */
  private calculateResult(): CalibrationResult {
    if (this.calibrationData.length === 0) {
      throw new Error('沒有收集到校準數據');
    }

    const samples = [...this.calibrationData];
    const mean = samples.reduce((sum, val) => sum + val, 0) / samples.length;
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    
    // 計算標準差
    const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length;
    const stdDev = Math.sqrt(variance);
    
    // 計算基線噪音值，確保不低於最小值
    const baselineNoise = Math.max(mean, this.options.minBaselineNoise);

    const stats = {
      mean,
      min,
      max,
      stdDev
    };

    console.log(`✅ 環境音校準完成: ${baselineNoise.toFixed(1)}, 統計信息:`, stats);

    return {
      baselineNoise,
      samples,
      stats
    };
  }

  /**
   * 獲取當前校準狀態
   */
  getCalibrationStatus(): {
    isCalibrating: boolean;
    samplesCollected: number;
  } {
    return {
      isCalibrating: this.isCalibrating,
      samplesCollected: this.calibrationData.length
    };
  }

  /**
   * 更新校準選項
   */
  updateOptions(newOptions: Partial<NoiseCalibrationOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}

/**
 * 閾值計算器類
 * 負責根據基線噪音和當前狀態計算動態閾值
 */
export class ThresholdCalculator {
  private baselineNoise: number;

  constructor(baselineNoise: number) {
    this.baselineNoise = baselineNoise;
  }

  /**
   * 更新基線噪音值
   */
  updateBaselineNoise(baselineNoise: number): void {
    this.baselineNoise = baselineNoise;
  }

  /**
   * 計算靜音閾值
   */
  getSilenceThreshold(): number {
    return this.baselineNoise + NOISE_CALIBRATION_CONFIG.SILENCE_THRESHOLD_OFFSET;
  }

  /**
   * 計算語音閾值（正常模式）
   */
  getVoiceThreshold(): number {
    return this.baselineNoise + NOISE_CALIBRATION_CONFIG.VOICE_THRESHOLD_OFFSET;
  }

  /**
   * 計算TTS模式下的動態語音閾值
   */
  getTtsVoiceThreshold(options: {
    ttsStartTime: number;
    ttsVolumeSamples: number[];
  }): number {
    const { ttsStartTime, ttsVolumeSamples } = options;
    
    // TTS剛開始播放的前1秒使用較高閾值避免初始波動誤判
    const timeSinceStart = Date.now() - ttsStartTime;
    if (timeSinceStart < NOISE_CALIBRATION_CONFIG.TTS_PROTECTION_PERIOD) {
      return this.baselineNoise + NOISE_CALIBRATION_CONFIG.TTS_PROTECTION_THRESHOLD; // 保護期使用較高閾值
    }
    
    // 動態計算：基於收集到的TTS音量數據
    if (ttsVolumeSamples.length > NOISE_CALIBRATION_CONFIG.TTS_MIN_SAMPLES) {
      const avgTtsVolume = ttsVolumeSamples.reduce((sum, vol) => sum + vol, 0) / ttsVolumeSamples.length;
      const maxTtsVolume = Math.max(...ttsVolumeSamples);
      // 使用平衡的倍數：取平均值的倍數或最大值的倍數，選較大者
      const balancedThreshold = Math.max(
        avgTtsVolume * NOISE_CALIBRATION_CONFIG.TTS_AVG_MULTIPLIER,
        maxTtsVolume * NOISE_CALIBRATION_CONFIG.TTS_MAX_MULTIPLIER,
        this.baselineNoise + NOISE_CALIBRATION_CONFIG.TTS_MIN_DYNAMIC_THRESHOLD
      );
      return balancedThreshold;
    }
    // 如果還沒收集到足夠數據，使用中等固定值
    return this.baselineNoise + NOISE_CALIBRATION_CONFIG.TTS_MEDIUM_THRESHOLD;
  }

  /**
   * 計算搶話閾值（用於TTS播放時的打斷檢測）
   * 搶話閾值 = 基礎閾值 + 搶話增量
   */
  getInterruptThreshold(): number {
    return this.baselineNoise + NOISE_CALIBRATION_CONFIG.INTERRUPT_THRESHOLD_OFFSET;
  }

  /**
   * 檢查當前音量是否觸發搶話
   */
  shouldInterrupt(currentVolume: number, isTtsPlaying: boolean): boolean {
    if (!isTtsPlaying) return false;
    
    const baseThreshold = this.getVoiceThreshold();
    const interruptThreshold = this.getInterruptThreshold();
    
    // 兩階段檢測：
    // 1. 首先音量需要超過基礎閾值（檢測到有聲音）
    // 2. 然後音量需要超過搶話閾值（確認是想要打斷）
    return currentVolume >= baseThreshold && currentVolume >= interruptThreshold;
  }

  /**
   * 根據當前狀態獲取適當的語音閾值
   */
  getCurrentVoiceThreshold(isTtsPlaying: boolean, ttsOptions?: {
    ttsStartTime: number;
    ttsVolumeSamples: number[];
  }): number {
    if (isTtsPlaying && ttsOptions) {
      return this.getTtsVoiceThreshold(ttsOptions);
    }
    return this.getVoiceThreshold();
  }
}

/**
 * 創建噪音校準器的工廠函數
 */
export function createNoiseCalibrator(options: NoiseCalibrationOptions): NoiseCalibrator {
  return new NoiseCalibrator(options);
}

/**
 * 創建閾值計算器的工廠函數
 */
export function createThresholdCalculator(baselineNoise: number): ThresholdCalculator {
  return new ThresholdCalculator(baselineNoise);
}

/**
 * 噪音校準相關常量
 */
export const NOISE_CALIBRATION_CONFIG = {
  /** 預設校準持續時間（毫秒） */
  DEFAULT_CALIBRATION_DURATION: 3000,
  /** 預設最小基線噪音值 */
  DEFAULT_MIN_BASELINE_NOISE: 10,
  /** 預設採樣間隔（毫秒） */
  DEFAULT_SAMPLING_INTERVAL: 50,
  /** 靜音閾值增量 */
  SILENCE_THRESHOLD_OFFSET: 10,
  /** 正常語音閾值增量 */
  VOICE_THRESHOLD_OFFSET: 15,
  /** 搶話閾值增量（TTS播放時用於檢測打斷） */
  INTERRUPT_THRESHOLD_OFFSET: 50,
  /** TTS 保護期閾值增量 */
  TTS_PROTECTION_THRESHOLD: 20,
  /** TTS 中等閾值增量 */
  TTS_MEDIUM_THRESHOLD: 15,
  /** TTS 最小動態閾值增量 */
  TTS_MIN_DYNAMIC_THRESHOLD: 30,
  /** TTS 平均值倍數 */
  TTS_AVG_MULTIPLIER: 1.4,
  /** TTS 最大值倍數 */
  TTS_MAX_MULTIPLIER: 1.2,
  /** TTS 保護期時間（毫秒） */
  TTS_PROTECTION_PERIOD: 1000,
  /** TTS 最小樣本數 */
  TTS_MIN_SAMPLES: 8
} as const;
