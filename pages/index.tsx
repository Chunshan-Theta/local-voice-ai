import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationStarted, setConversationStarted] = useState(false);
  
  // 環境音檢測相關狀態
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [baselineNoise, setBaselineNoise] = useState<number>(10);
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

  // 新增：持續的音頻流管理
  const audioStreamRef = useRef<MediaStream | null>(null);

  const isListeningRef = useRef(false);
  const hasDetectedVoiceRef = useRef(false);
  const baselineNoiseRef = useRef(10);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 計算動態閾值 - 使用 ref 確保最新值
  const getSilenceThreshold = () => baselineNoiseRef.current + 0.5; // 進一步降低
  const getVoiceThreshold = () => baselineNoiseRef.current + 1;   // 大幅降低語音閾值，只需比環境音高1即可

  // 當有新的 AI 回應時，自動重新開始錄音
  useEffect(() => {
    if (messages.length > 0 && conversationStarted && !loading && !isListening) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === 'ai' && !lastMessage.isLoading) {
        const timer = setTimeout(() => {
          // 雙重檢查對話狀態
          if (conversationStarted && !loading && !isListening) {
            console.log('🔄 AI 回覆完成，自動重新開始錄音');
            startListening();
          } else {
            console.log('⚠️ 對話狀態已改變，取消自動錄音');
          }
        }, 1000);
        
        return () => {
          clearTimeout(timer);
          console.log('🗑️ 清理自動錄音計時器');
        };
      }
    }
  }, [messages, conversationStarted, loading, isListening]);

  // 自動滾動到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          baselineNoiseRef.current = baseline; // 同時更新 ref
          console.log(`✅ 環境音校準完成: ${baseline.toFixed(1)} (使用統一音軌)，語音閾值: ${(baseline + 1).toFixed(1)}`);
          
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
    console.log('🛑 stopListening 被調用');
    
    setIsListening(false);
    isListeningRef.current = false;
    setCurrentVolume(0);
    setHasDetectedVoice(false);
    hasDetectedVoiceRef.current = false;
    
    stopVolumeMonitoring();
    
    if (silenceTimerRef.current) {
      console.log('🕐 清理靜音計時器:', silenceTimerRef.current);
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    // 重要：不關閉音頻上下文和音頻流，保持持續可用
    console.log('🔄 停止錄音但保持音頻資源活躍');
  };

  const stopRecording = () => {
    console.log('🎬 stopRecording 被調用');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('📹 停止 MediaRecorder');
      mediaRecorderRef.current.stop();
    } else {
      console.log('⚠️ MediaRecorder 不在錄音狀態:', mediaRecorderRef.current?.state);
    }
    
    stopListening();
  };

  const endConversation = () => {
    console.log('🛑 endConversation 被調用 - 開始清理所有資源');
    
    // 立即停止所有狀態
    setConversationStarted(false);
    setIsListening(false);
    setLoading(false);
    setError(null);
    setMessages([]);
    setHasDetectedVoice(false);
    setCurrentVolume(0);
    
    // 更新 refs
    isListeningRef.current = false;
    hasDetectedVoiceRef.current = false;
    
    // 強制停止錄音
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          console.log('🎬 強制停止 MediaRecorder');
          mediaRecorderRef.current.stop();
        }
      } catch (error) {
        console.warn('停止錄音時出錯:', error);
      }
      mediaRecorderRef.current = null;
    }
    
    // 清理所有定時器
    if (silenceTimerRef.current) {
      console.log('🕐 清理靜音計時器');
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (volumeCheckIntervalRef.current) {
      console.log('🔊 清理音量監控定時器');
      clearInterval(volumeCheckIntervalRef.current);
      volumeCheckIntervalRef.current = null;
    }
    
    // 清理音頻資源
    if (audioStreamRef.current) {
      console.log('🎤 關閉音頻流');
      audioStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 停止音軌:', track.kind);
      });
      audioStreamRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      console.log('🔊 關閉音頻上下文');
      audioContextRef.current.close().then(() => {
        console.log('✅ 音頻上下文已關閉');
      }).catch(error => {
        console.warn('關閉音頻上下文時出錯:', error);
      });
    }
    
    // 清理所有引用
    analyserRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
    audioChunksRef.current = [];
    calibrationDataRef.current = [];
    
    // 重置校準相關狀態
    setIsCalibrating(false);
    setCalibrationProgress(0);
    setBaselineNoise(10);
    baselineNoiseRef.current = 10;
    
    console.log('✅ 對話結束，所有資源已清理，回到初始狀態');
  };

  const startConversation = async () => {
    await calibrateEnvironmentalNoise();
    setTimeout(() => {
      startListening();
    }, 500);
  };

  const processAudio = async () => {
    // 檢查對話是否仍在進行中
    if (!conversationStarted) {
      console.log('⚠️ 對話已結束，取消音頻處理');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      if (audioBlob.size < 1000) {
        setLoading(false);
        return;
      }

      // 再次檢查對話狀態（防止在異步操作期間對話被結束）
      if (!conversationStarted) {
        console.log('⚠️ 對話在處理過程中被結束，取消操作');
        setLoading(false);
        return;
      }

      // 先添加一個用戶消息（loading狀態）
      const userMessageId = `user_${Date.now()}`;
      const userMessage: Message = {
        id: userMessageId,
        type: 'user',
        content: '正在轉錄語音...',
        timestamp: new Date(),
        isLoading: true,
      };
      setMessages(prev => [...prev, userMessage]);

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

      // 檢查對話是否仍在進行（轉錄完成後）
      if (!conversationStarted) {
        console.log('⚠️ 對話在轉錄過程中被結束，取消後續操作');
        setLoading(false);
        return;
      }

      // 更新用戶消息的轉錄結果
      setMessages(prev => prev.map(msg => 
        msg.id === userMessageId 
          ? { ...msg, content: transcript, isLoading: false }
          : msg
      ));

      // 如果轉錄結果為空，不進行AI回覆
      if (!transcript.trim() || transcript === '（未識別到語音）') {
        setLoading(false);
        return;
      }

      // 步驟2：添加AI回覆消息（loading狀態）
      const aiMessageId = `ai_${Date.now()}`;
      const aiMessage: Message = {
        id: aiMessageId,
        type: 'ai',
        content: '正在思考回覆...',
        timestamp: new Date(),
        isLoading: true,
      };
      setMessages(prev => [...prev, aiMessage]);

      // 再次檢查對話狀態（開始AI回覆前）
      if (!conversationStarted) {
        console.log('⚠️ 對話在AI回覆前被結束，取消操作');
        setLoading(false);
        return;
      }

      // 步驟3：獲取AI回覆
      const replyResponse = await axios.post('/api/reply', {
        message: transcript,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      });

      const { reply } = replyResponse.data;

      // 最終檢查對話狀態（AI回覆完成後）
      if (!conversationStarted) {
        console.log('⚠️ 對話在AI回覆過程中被結束，取消更新');
        setLoading(false);
        return;
      }

      // 更新AI消息的回覆結果
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, content: reply, isLoading: false }
          : msg
      ));

    } catch (err) {
      console.error('處理錯誤:', err);
      setError(err instanceof Error ? err.message : '處理失敗');
      
      // 移除loading中的消息
      setMessages(prev => prev.filter(msg => !msg.isLoading));
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
        console.log(`🎯 閾值檢查: baselineNoiseRef=${baselineNoiseRef.current}, baselineNoise state=${baselineNoise}, 計算的語音閾值=${voiceThreshold}`);
      }
      
      // 語音檢測邏輯 - 只依賴平均值，忽略最大值波動
      const isVoiceDetected = average >= voiceThreshold; // 只使用平均值檢測
      
      // 每次都記錄語音檢測結果（用於調試）
      if (checkCount % 5 === 0) { // 每500ms記錄一次
        console.log('🔍 語音檢測詳情:', {
          average: average.toFixed(1),
          maxValue: maxValue.toFixed(1),
          voiceThreshold: voiceThreshold.toFixed(1),
          isVoiceDetectedByAverage: average >= voiceThreshold,
          isVoiceDetected,
          hasDetectedVoiceBefore: hasDetectedVoiceRef.current,
          checkCount
        });
      }
      
      if (isVoiceDetected) {
        if (!hasDetectedVoiceRef.current) {
          console.log('🟢 檢測到語音！', { 
            average: average.toFixed(1), 
            max: maxValue.toFixed(1),
            trigger: average >= voiceThreshold ? 'average' : 'maxValue'
          });
          setHasDetectedVoice(true);
          hasDetectedVoiceRef.current = true;
        }
        
        // 清除靜音計時器
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
          console.log('🔄 檢測到語音，取消靜音倒數');
        }
      } else if (hasDetectedVoiceRef.current) {
        // 修改：只要檢測到語音後，音量低於語音閾值就開始靜音倒數
        if (!silenceTimerRef.current) {
          console.log('🔴 開始靜音倒數...', { 
            currentVolume: average.toFixed(1), 
            voiceThreshold: voiceThreshold.toFixed(1),
            silenceThreshold: silenceThreshold.toFixed(1),
            checkCount,
            timestamp: new Date().toISOString()
          });
          
          silenceTimerRef.current = setTimeout(() => {
            console.log('⏰ 靜音時間到，準備自動發送錄音', {
              timestamp: new Date().toISOString(),
              isListening: isListeningRef.current,
              mediaRecorderState: mediaRecorderRef.current?.state
            });
            
            // 確保在執行前清理計時器引用
            silenceTimerRef.current = null;
            
            try {
              stopRecording();
              console.log('✅ stopRecording 執行完成');
            } catch (error) {
              console.error('❌ stopRecording 執行錯誤:', error);
            }
          }, SILENCE_DURATION);
          
          console.log('🕐 靜音計時器已設置，ID:', silenceTimerRef.current);
        } else {
          // 每秒打印一次計時器狀態
          if (checkCount % 10 === 0) {
            console.log('⏳ 靜音計時器運行中...', {
              timerId: silenceTimerRef.current,
              remainingTime: `約 ${Math.ceil((SILENCE_DURATION - ((checkCount % 30) * 100)) / 1000)}秒`,
              checkCount
            });
          }
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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-TW', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      maxWidth: '800px', 
      margin: '0 auto',
      padding: '1rem'
    }}>
      <h1>本地語音 AI 助手</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        自動校準環境音，智慧檢測語音活動。AI 回應後會自動重新開始錄音。
      </p>
      
      {/* 音量監控 */}
      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
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
      
      {/* 控制按鈕 */}
      <div style={{ marginBottom: '1rem' }}>
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

      {/* 聊天記錄區域 */}
      <div style={{ 
        flex: 1, 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px', 
        padding: '1rem', 
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {messages.length === 0 && conversationStarted && (
          <div style={{ 
            textAlign: 'center', 
            color: '#666', 
            fontStyle: 'italic',
            marginTop: '2rem'
          }}>
            🎤 開始說話來進行對話...
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '1rem'
            }}
          >
            <div
              style={{
                maxWidth: '70%',
                padding: '1rem',
                borderRadius: '12px',
                backgroundColor: message.type === 'user' ? '#007bff' : '#e9ecef',
                color: message.type === 'user' ? 'white' : '#333',
                position: 'relative',
                opacity: message.isLoading ? 0.7 : 1,
              }}
            >
              <div style={{ 
                fontSize: '0.8rem', 
                opacity: 0.8, 
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>{message.type === 'user' ? '🗣️ 你' : '🤖 AI'}</span>
                <span>{formatTime(message.timestamp)}</span>
                {message.isLoading && <span>⏳</span>}
              </div>
              <div style={{ fontSize: '1rem', lineHeight: '1.4' }}>
                {message.content}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
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