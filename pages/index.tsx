import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

interface ChatResult {
  transcript: string;
  reply: string;
}

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState<ChatResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationStarted, setConversationStarted] = useState(false);
  
  // 環境音檢測相關狀態
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [baselineNoise, setBaselineNoise] = useState<number>(20);
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  const [calibrationProgress, setCalibrationProgress] = useState<number>(0);
  const [hasDetectedVoice, setHasDetectedVoice] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const calibrationDataRef = useRef<number[]>([]);
  const volumeCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 語音活動檢測參數
  const SILENCE_DURATION = 3000; // 3秒靜音後自動發送
  const MIN_RECORDING_TIME = 1000; // 最短錄音時間 1秒
  const CALIBRATION_DURATION = 3000; // 3秒校準時間

  // 計算動態閾值
  const getSilenceThreshold = () => baselineNoise + 1; // 進一步降低
  const getVoiceThreshold = () => baselineNoise + 3;   // 大幅降低語音閾值

  // 新增：持續的音頻流管理
  const audioStreamRef = useRef<MediaStream | null>(null);

  const isListeningRef = useRef(false);
  const hasDetectedVoiceRef = useRef(false);

  // 當有新的 AI 回應時，自動重新開始錄音
  useEffect(() => {
    if (result && conversationStarted && !loading && !isListening) {
      const timer = setTimeout(() => {
        startListening();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [result, conversationStarted, loading, isListening]);

  // 創建持續的音頻流 - 校準和錄音共用
  const createAudioStream = async () => {
    if (audioStreamRef.current) {
      // 如果已經有流，先清理
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      } 
    });

    audioStreamRef.current = stream;
    streamRef.current = stream;
    
    console.log('🎤 創建統一音頻流，軌道設置:', stream.getAudioTracks()[0].getSettings());
    return stream;
  };

  // 設置音頻分析器 - 校準和錄音共用
  const setupAudioAnalyser = (stream: MediaStream) => {
    // 只有在沒有音頻上下文或上下文已關閉時才創建新的
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      console.log('🔄 創建新的音頻上下文');
      audioContextRef.current = new AudioContext();
    } else {
      console.log('✅ 復用現有音頻上下文');
    }
    
    // 只有在沒有分析器時才創建新的
    if (!analyserRef.current) {
      console.log('🔄 創建新的音頻分析器');
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      console.log('🔊 音頻分析器設置完成，頻率數據大小:', analyserRef.current.frequencyBinCount);
    } else {
      console.log('✅ 復用現有音頻分析器');
    }
    
    return analyserRef.current;
  };

  // 環境音校準 - 使用統一音頻流
  const calibrateEnvironmentalNoise = async () => {
    try {
      setIsCalibrating(true);
      setCalibrationProgress(0);
      calibrationDataRef.current = [];
      
      // 創建統一音頻流
      const stream = await createAudioStream();
      const analyser = setupAudioAnalyser(stream);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const calibrationStart = Date.now();
      const calibrationInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const sum = Array.from(dataArray).reduce((a, b) => a + b, 0);
        const average = sum / dataArray.length;
        
        calibrationDataRef.current.push(average);
        setCurrentVolume(average);
        
        const elapsed = Date.now() - calibrationStart;
        const progress = Math.min((elapsed / CALIBRATION_DURATION) * 100, 100);
        setCalibrationProgress(progress);
        
        if (elapsed >= CALIBRATION_DURATION) {
          clearInterval(calibrationInterval);
          
          // 計算環境音基準
          const samples = calibrationDataRef.current;
          const mean = samples.reduce((sum, val) => sum + val, 0) / samples.length;
          const baseline = Math.max(mean, 10);
          
          setBaselineNoise(baseline);
          console.log(`✅ 環境音校準完成: ${baseline.toFixed(1)} (使用統一音軌)`);
          
          setIsCalibrating(false);
          setCurrentVolume(0);
          
          // 重要：校準完成後不關閉音頻流，繼續用於錄音
        }
      }, 50);
      
    } catch (err) {
      console.error('校準錯誤:', err);
      setError('校準失敗，將使用預設值');
      setIsCalibrating(false);
    }
  };

  const startListening = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      setHasDetectedVoice(false);
      hasDetectedVoiceRef.current = false;
      
      console.log('🎤 開始錄音 - 檢查現有資源');
      
      // 檢查是否已有音頻流（校準時創建的）
      let stream = audioStreamRef.current;
      
      if (!stream || !stream.active) {
        console.log('⚠️ 沒有活躍音頻流，重新創建');
        stream = await createAudioStream();
        setupAudioAnalyser(stream);
      } else {
        console.log('✅ 使用校準時的音頻流');
        
        // 檢查音頻上下文是否還活躍
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          console.log('🔄 音頻上下文已關閉，重新設置分析器');
          setupAudioAnalyser(stream);
        } else {
          console.log('✅ 音頻上下文和分析器都可用');
        }
      }

      // 使用現有的音頻流進行錄音
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          await processAudio();
        }
      };

      mediaRecorder.start(100);
      setIsListening(true);
      isListeningRef.current = true;
      
      if (!conversationStarted) {
        setConversationStarted(true);
      }
      
      // 啟動音量監控（使用相同的分析器）
      startVolumeMonitoring();
      
      console.log('🎤 錄音和音量監控已啟動 - 統一音軌架構');
      
    } catch (err) {
      console.error('錄音錯誤:', err);
      setError('無法訪問麥克風，請檢查權限設置');
    }
  };

  const stopListening = () => {
    setIsListening(false);
    isListeningRef.current = false;
    setCurrentVolume(0);
    setHasDetectedVoice(false);
    hasDetectedVoiceRef.current = false;
    
    stopVolumeMonitoring();
    
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    // 重要：不關閉音頻上下文和音頻流，保持持續可用
    console.log('🔄 停止錄音但保持音頻資源活躍');
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    stopListening();
  };

  const endConversation = () => {
    setConversationStarted(false);
    stopRecording();
    setResult(null);
    
    // 對話結束時才真正關閉所有音頻資源
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    
    // 清理引用
    analyserRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
    
    console.log('🛑 對話結束，所有音頻資源已清理');
  };

  const startConversation = async () => {
    await calibrateEnvironmentalNoise();
    setTimeout(() => {
      startListening();
    }, 500);
  };

  const processAudio = async () => {
    setLoading(true);
    setError(null);

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      if (audioBlob.size < 1000) {
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      const response = await axios.post('/api/chat', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000,
      });

      const { transcript, reply } = response.data;
      setResult({ transcript, reply });

    } catch (err) {
      console.error('處理錯誤:', err);
      setError(err instanceof Error ? err.message : '處理失敗');
    } finally {
      setLoading(false);
    }
  };

  const getVolumeBarColor = () => {
    if (isCalibrating) return '#ffc107';
    if (!isListening) return '#6c757d';
    
    const voiceThreshold = getVoiceThreshold();
    const silenceThreshold = getSilenceThreshold();
    
    if (currentVolume >= voiceThreshold) return '#28a745'; // 綠色 - 語音
    if (currentVolume >= silenceThreshold) return '#fd7e14'; // 橙色 - 中等
    return '#dc3545'; // 紅色 - 靜音
  };

  const getVolumePercentage = () => {
    const maxDisplayVolume = Math.max(getVoiceThreshold() * 2, 100);
    return Math.min((currentVolume / maxDisplayVolume) * 100, 100);
  };

  // 音量檢測循環 - 修復閉包問題
  const startVolumeMonitoring = () => {
    console.log('🔄 startVolumeMonitoring 被調用');
    
    if (volumeCheckIntervalRef.current) {
      console.log('🛑 清除舊的音量監控');
      clearInterval(volumeCheckIntervalRef.current);
    }

    let checkCount = 0;

    volumeCheckIntervalRef.current = setInterval(() => {
      checkCount++;
      
      // 詳細的狀態檢查 - 使用 ref 避免閉包問題
      const hasAnalyser = !!analyserRef.current;
      const currentIsListening = isListeningRef.current;
      const audioContextState = audioContextRef.current?.state;
      const streamActive = audioStreamRef.current?.active;
      
      if (!hasAnalyser || !currentIsListening) {
        if (checkCount % 10 === 0) { // 每秒打印一次
          console.log('⚠️ 音量檢測條件不滿足:', { 
            checkCount,
            hasAnalyser, 
            currentIsListening,
            audioContextState,
            streamActive
          });
        }
        return;
      }

      const dataArray = new Uint8Array(analyserRef.current!.frequencyBinCount);
      analyserRef.current!.getByteFrequencyData(dataArray);
      
      // 計算音量
      const sum = Array.from(dataArray).reduce((a, b) => a + b, 0);
      const average = sum / dataArray.length;
      const maxValue = Math.max(...Array.from(dataArray));
      
      setCurrentVolume(average);
      
      const silenceThreshold = getSilenceThreshold();
      const voiceThreshold = getVoiceThreshold();
      
      // 每秒打印一次詳細信息
      if (checkCount % 10 === 0) {
        console.log(`🔊 第${checkCount}次檢查: 平均=${average.toFixed(1)}, 最大=${maxValue.toFixed(1)}, 語音閾值=${voiceThreshold}`);
        console.log(`📊 音頻狀態: 上下文=${audioContextState}, 流活躍=${streamActive}, 監聽中=${currentIsListening}`);
        console.log(`📈 音頻數據樣本前5個:`, Array.from(dataArray.slice(0, 5)));
      }
      
      // 語音檢測邏輯
      const isVoiceDetected = average >= voiceThreshold || maxValue >= voiceThreshold * 1.2;
      
      if (isVoiceDetected) {
        if (!hasDetectedVoiceRef.current) {
          console.log('🟢 檢測到語音！', { average: average.toFixed(1), max: maxValue.toFixed(1) });
          setHasDetectedVoice(true);
          hasDetectedVoiceRef.current = true;
        }
        
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else if (average < silenceThreshold && hasDetectedVoiceRef.current) {
        if (!silenceTimerRef.current) {
          console.log('🔴 開始靜音倒數...');
          silenceTimerRef.current = setTimeout(() => {
            console.log('⏰ 靜音時間到，自動發送錄音');
            stopRecording();
          }, SILENCE_DURATION);
        }
      }
    }, 100);
    
    console.log('✅ 音量監控定時器已設置，ID:', volumeCheckIntervalRef.current);
  };

  const stopVolumeMonitoring = () => {
    if (volumeCheckIntervalRef.current) {
      clearInterval(volumeCheckIntervalRef.current);
      volumeCheckIntervalRef.current = null;
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>本地語音 AI 助手</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        自動校準環境音，智慧檢測語音活動。AI 回應後會自動重新開始錄音。
      </p>
      
      {/* 音量監控 */}
      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem', color: '#666' }}>音量監控</span>
          <span style={{ fontSize: '0.8rem', color: '#666' }}>
            環境音: {baselineNoise.toFixed(1)} | 當前: {currentVolume.toFixed(1)}
          </span>
        </div>
        <div style={{ 
          width: '100%', 
          height: '8px', 
          backgroundColor: '#e9ecef', 
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${getVolumePercentage()}%`,
            height: '100%',
            backgroundColor: getVolumeBarColor(),
            transition: 'all 0.1s ease'
          }} />
        </div>
        {(isListening || isCalibrating) && (
          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
            靜音閾值: {getSilenceThreshold().toFixed(1)} | 語音閾值: {getVoiceThreshold().toFixed(1)}
            {hasDetectedVoice && (
              <span style={{ color: '#28a745', marginLeft: '10px' }}>✅ 語音已檢測</span>
            )}
          </div>
        )}
      </div>
      
      <div style={{ marginBottom: '2rem' }}>
        {isCalibrating ? (
          <div style={{ textAlign: 'center' }}>
            <button
              disabled
              style={{
                padding: '1rem 2rem',
                fontSize: '1.2rem',
                backgroundColor: '#ffc107',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'not-allowed',
              }}
            >
              🔧 校準環境音中... {Math.round(calibrationProgress)}%
            </button>
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.5rem', 
              backgroundColor: '#fff3cd', 
              borderRadius: '4px',
              fontSize: '0.9rem',
              color: '#856404'
            }}>
              請保持安靜 {Math.ceil((CALIBRATION_DURATION - (calibrationProgress / 100 * CALIBRATION_DURATION)) / 1000)} 秒，讓系統學習環境音...
            </div>
          </div>
        ) : !conversationStarted ? (
          <button
            onClick={startConversation}
            disabled={loading}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.2rem',
              backgroundColor: loading ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            🎙️ 校準並開始對話
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              onClick={isListening ? stopRecording : startListening}
              disabled={loading}
              style={{
                padding: '1rem 2rem',
                fontSize: '1.2rem',
                backgroundColor: isListening ? '#dc3545' : loading ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                position: 'relative',
                animation: isListening ? 'pulse 1s infinite' : 'none',
              }}
            >
              {loading ? '處理中...' : isListening ? '🎤 正在聆聽...' : '🎙️ 繼續錄音'}
            </button>
            
            <button
              onClick={endConversation}
              style={{
                padding: '1rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              🛑 結束對話
            </button>

            <button
              onClick={calibrateEnvironmentalNoise}
              disabled={isListening || loading}
              style={{
                padding: '1rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#ffc107',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: (isListening || loading) ? 'not-allowed' : 'pointer',
              }}
            >
              🔧 重新校準
            </button>
          </div>
        )}
        
        {isListening && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.5rem', 
            backgroundColor: hasDetectedVoice ? '#d4edda' : '#fff3cd', 
            borderRadius: '4px',
            fontSize: '0.9rem',
            color: hasDetectedVoice ? '#155724' : '#856404'
          }}>
            {hasDetectedVoice 
              ? `🟢 已檢測到語音，停止說話 ${SILENCE_DURATION/1000} 秒後會自動發送...` 
              : `🟡 等待語音輸入...（當前音量: ${currentVolume.toFixed(1)}, 需要超過: ${getVoiceThreshold().toFixed(1)}）`
            }
          </div>
        )}

        {conversationStarted && !isListening && !loading && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.5rem', 
            backgroundColor: '#d1ecf1', 
            borderRadius: '4px',
            fontSize: '0.9rem',
            color: '#0c5460'
          }}>
            🔄 AI 回應完成後會自動重新開始錄音...
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          錯誤：{error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{
            padding: '1rem',
            backgroundColor: '#d4edda',
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            <h3>🗣️ 你說的話：</h3>
            <p style={{ fontSize: '1.1rem', margin: '0.5rem 0' }}>{result.transcript}</p>
          </div>
          
          <div style={{
            padding: '1rem',
            backgroundColor: '#d1ecf1',
            borderRadius: '4px'
          }}>
            <h3>🤖 AI 回覆：</h3>
            <p style={{ fontSize: '1.1rem', margin: '0.5rem 0' }}>{result.reply}</p>
          </div>
        </div>
      )}

      <div style={{ marginTop: '3rem', fontSize: '0.9rem', color: '#666' }}>
        <p>✅ 智慧環境音校準，可靠的音量檢測</p>
        <p>✅ 使用 Whisper Small 模型進行中文語音辨識</p>
        <p>✅ 連接到 Gemma3:4b 模型生成回覆</p>
        <p>🔄 AI 回應後自動重新開始錄音，實現連續對話</p>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
} 