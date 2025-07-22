import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import type { ConversationMessage } from '../lib/ollama';
import { 
  createNoiseCalibrator, 
  createThresholdCalculator, 
  type NoiseCalibrator, 
  type ThresholdCalculator,
  NOISE_CALIBRATION_CONFIG 
} from '../lib/noiseCalibrator';
import { 
  createTtsManager, 
  type TtsManager, 
  TTS_CONFIG 
} from '../lib/ttsManager';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  isPlaying?: boolean;
}

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationStarted, setConversationStarted] = useState(false);
  
  // TTS 相關狀態
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsVoice, setTtsVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [ttsRate, setTtsRate] = useState(1.0);
  const [ttsVolume, setTtsVolume] = useState(0.8);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
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
  const volumeCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const noiseCalibrationRef = useRef<NoiseCalibrator | null>(null);
  const thresholdCalculatorRef = useRef<ThresholdCalculator | null>(null);
  const ttsManagerRef = useRef<TtsManager | null>(null);

  // 語音活動檢測參數
  const SILENCE_DURATION = 2000; // 2秒靜音後自動發送
  const MIN_RECORDING_TIME = 1000; // 最短錄音時間 1秒

  // 音頻流管理
  const audioStreamRef = useRef<MediaStream | null>(null);

  const isListeningRef = useRef(false);
  const hasDetectedVoiceRef = useRef(false);
  const baselineNoiseRef = useRef(10);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初始化TTS管理器
  useEffect(() => {
    if (!ttsManagerRef.current) {
      ttsManagerRef.current = createTtsManager(
        {
          enabled: ttsEnabled,
          voice: ttsVoice,
          rate: ttsRate,
          volume: ttsVolume,
          pitch: 1.0
        },
        {
          onStart: (text, messageId) => {
            console.log('🔇 TTS開始播放');
            // 停止當前錄音（如果有的話）
            if (isListeningRef.current) {
              stopListening();
            }
            
            if (messageId) {
              setMessages(prev => prev.map(msg => 
                msg.id === messageId ? { ...msg, isPlaying: true } : { ...msg, isPlaying: false }
              ));
            }
          },
          onEnd: (messageId) => {
            console.log('✅ TTS播放完成');
            setMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
            
            // TTS結束後自動開始錄音
            setTimeout(() => {
              console.log('🎤 TTS結束後自動開始錄音');
              if (conversationStarted && !loading && !isListeningRef.current) {
                startListening();
              }
            }, 500);
          },
          onError: (error, messageId) => {
            console.error('❌ TTS 錯誤:', error.error);
            setMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
            
            // TTS錯誤後也要重新開始錄音
            setTimeout(() => {
              console.log('🎤 TTS錯誤後自動開始錄音');
              if (conversationStarted && !loading && !isListeningRef.current) {
                startListening();
              }
            }, 500);
          },
          onSpeakingChange: (speaking) => {
            setIsSpeaking(speaking);
          }
        }
      );

      // 獲取可用語音列表
      const voices = ttsManagerRef.current.getAvailableVoices();
      setAvailableVoices(voices);
      
      // 如果自動選擇了語音，同步狀態
      const currentVoice = ttsManagerRef.current.getOptions().voice;
      if (currentVoice) {
        setTtsVoice(currentVoice);
      }
    }

    return () => {
      if (ttsManagerRef.current) {
        ttsManagerRef.current.destroy();
      }
    };
  }, []);

  // 同步TTS設置到管理器
  useEffect(() => {
    if (ttsManagerRef.current) {
      ttsManagerRef.current.updateOptions({
        enabled: ttsEnabled,
        voice: ttsVoice,
        rate: ttsRate,
        volume: ttsVolume,
        pitch: 1.0
      });
    }
  }, [ttsEnabled, ttsVoice, ttsRate, ttsVolume]);

  // 初始化噪音校準器和閾值計算器
  useEffect(() => {
    if (!noiseCalibrationRef.current) {
      noiseCalibrationRef.current = createNoiseCalibrator({
        calibrationDuration: NOISE_CALIBRATION_CONFIG.DEFAULT_CALIBRATION_DURATION,
        minBaselineNoise: NOISE_CALIBRATION_CONFIG.DEFAULT_MIN_BASELINE_NOISE,
        samplingInterval: NOISE_CALIBRATION_CONFIG.DEFAULT_SAMPLING_INTERVAL,
        onProgress: (progress, currentVolume) => {
          setCalibrationProgress(progress);
          setCurrentVolume(currentVolume);
        },
        onComplete: (baselineNoise) => {
          setBaselineNoise(baselineNoise);
          baselineNoiseRef.current = baselineNoise;
          setIsCalibrating(false);
          setCurrentVolume(0);
          
          // 初始化或更新閾值計算器
          if (!thresholdCalculatorRef.current) {
            thresholdCalculatorRef.current = createThresholdCalculator(baselineNoise);
          } else {
            thresholdCalculatorRef.current.updateBaselineNoise(baselineNoise);
          }
        },
        onError: (error) => {
          console.error('校準錯誤:', error);
          setError('校準失敗，將使用預設值');
          setIsCalibrating(false);
        }
      });
    }

    // 如果還沒有閾值計算器，用當前基線噪音初始化
    if (!thresholdCalculatorRef.current) {
      thresholdCalculatorRef.current = createThresholdCalculator(baselineNoise);
    }
  }, []);

  // 計算動態閾值 - 使用閾值計算器
  const getSilenceThreshold = () => {
    if (thresholdCalculatorRef.current) {
      return thresholdCalculatorRef.current.getSilenceThreshold();
    }
    return baselineNoiseRef.current + 0.5; // 降級處理
  };
  
  const getVoiceThreshold = () => {
    if (thresholdCalculatorRef.current) {
      const isTtsPlaying = ttsManagerRef.current ? ttsManagerRef.current.isSpeaking() : false;
      return thresholdCalculatorRef.current.getCurrentVoiceThreshold(isTtsPlaying);
    }
    
    // 簡化的降級處理邏輯
    return baselineNoiseRef.current + 1;
  };

  // 當有新的 AI 回應時，檢查是否需要自動重新開始錄音
  useEffect(() => {
    if (messages.length > 0 && conversationStarted && !loading) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === 'ai' && !lastMessage.isLoading) {
        // 檢查TTS是否啟用，如果啟用則等待TTS完成後再開始錄音
        if (ttsEnabled && lastMessage.content.trim()) {
          console.log('🗣️ AI回應完成，TTS將自動朗讀，等待TTS結束後開始錄音');
          // TTS結束時會自動開始錄音
        } else {
          // 如果沒有啟用TTS，直接開始錄音
          console.log('🎤 TTS未啟用，直接開始錄音');
          const timer = setTimeout(() => {
            if (!isListeningRef.current) {
              startListening();
            }
          }, 1000);
          
          return () => clearTimeout(timer);
        }
      }
    }
  }, [messages, conversationStarted, loading, ttsEnabled]);

  // 自動滾動到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // TTS 相關函數
  const speakText = (text: string, messageId?: string) => {
    if (ttsManagerRef.current) {
      ttsManagerRef.current.speak(text, messageId);
    }
  };

  const stopSpeaking = () => {
    if (ttsManagerRef.current) {
      ttsManagerRef.current.stop();
    }
    setMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
  };

  // 創建音頻流
  const createAudioStream = async () => {
    if (audioStreamRef.current) {
      // 如果已經有流，先清理
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,  // 啟用回音消除，避免錄到TTS聲音
        noiseSuppression: true,  // 啟用噪音抑制
        autoGainControl: true,   // 啟用自動增益控制
        sampleRate: 16000,       // 設置合適的採樣率
        channelCount: 1,         // 單聲道
      } 
    });

    audioStreamRef.current = stream;
    streamRef.current = stream;
    
    console.log('🎤 創建音頻流');
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

  // 環境音校準 - 使用噪音校準器模組
  const calibrateEnvironmentalNoise = async () => {
    try {
      setIsCalibrating(true);
      setCalibrationProgress(0);
      
      // 校準時必須停止TTS播放，因為需要安靜環境
      stopSpeaking();
      
      // 創建統一音頻流
      const stream = await createAudioStream();
      const analyser = setupAudioAnalyser(stream);

      // 使用噪音校準器進行校準
      if (noiseCalibrationRef.current) {
        await noiseCalibrationRef.current.startCalibration(analyser);
        console.log(`✅ 環境音校準完成，語音閾值: ${(baselineNoiseRef.current + 1).toFixed(1)}`);
      } else {
        throw new Error('噪音校準器未初始化');
      }
      
    } catch (err) {
      console.error('校準錯誤:', err);
      setError('校準失敗，將使用預設值');
      setIsCalibrating(false);
    }
  };

  const startListening = async () => {
    try {
      console.log('🎤 開始錄音');
      
      // 如果已經在錄音，先停止
      if (isListeningRef.current) {
        console.log('⚠️ 已在錄音中，先停止現有錄音');
        stopListening();
      }
      
      setError(null);
      audioChunksRef.current = [];
      setHasDetectedVoice(false);
      hasDetectedVoiceRef.current = false;
      
      // 創建或使用現有音頻流
      let stream = audioStreamRef.current;
      
      if (!stream || !stream.active) {
        console.log('⚠️ 創建新的音頻流');
        stream = await createAudioStream();
        setupAudioAnalyser(stream);
      } else {
        console.log('✅ 使用現有音頻流');
        
        // 檢查音頻上下文是否還活躍
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          console.log('🔄 重新設置音頻分析器');
          setupAudioAnalyser(stream);
        }
      }

      // 創建MediaRecorder
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
      
      // 啟動音量監控（如果還沒有啟動的話）
      if (!volumeCheckIntervalRef.current) {
        console.log('🔄 啟動音量監控');
        startVolumeMonitoring();
      }
      
      console.log('🎤 錄音已啟動');
      
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
    
    // 不停止音量監控！只清理錄音相關的計時器
    if (silenceTimerRef.current) {
      console.log('🕐 清理靜音計時器:', silenceTimerRef.current);
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    // 重要：保持音量監控運行，只停止錄音
    console.log('🔄 停止錄音但保持音頻資源和音量監控活躍');
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
    setConversationStarted(false);
    stopRecording();
    stopVolumeMonitoring(); // 對話結束時才真正停止音量監控
    stopSpeaking(); // 停止TTS播放
    setMessages([]);
    
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
    // 校準完成後立即開始持續音量監控
    setTimeout(() => {
      console.log('🔄 校準完成，開始持續音量監控和錄音');
      // 先啟動音量監控
      if (!volumeCheckIntervalRef.current) {
        startVolumeMonitoring();
      }
      // 然後開始錄音
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

      // 步驟4：添加AI回覆消息（loading狀態）
      const aiMessageId = `ai_${Date.now()}`;
      const aiMessage: Message = {
        id: aiMessageId,
        type: 'ai',
        content: '正在思考回覆...',
        timestamp: new Date(),
        isLoading: true,
      };
      setMessages(prev => [...prev, aiMessage]);

      // 步驟3：構建對話歷史（不包含當前對話）
      const conversationHistory: ConversationMessage[] = messages
        .filter(msg => !msg.isLoading && msg.content.trim() && msg.content !== '正在轉錄語音...' && msg.content !== '正在思考回覆...')
        .slice(-10) // 只保留最近 10 條消息避免過長
        .map(msg => ({
          role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
          content: msg.content
        }));

      console.log('Conversation history:', conversationHistory);

      // 步驟4：獲取AI回覆
      const replyResponse = await axios.post('/api/reply', {
        message: transcript,
        conversationHistory: conversationHistory,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      });

      const { reply } = replyResponse.data;

      // 更新AI消息的回覆結果
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, content: reply, isLoading: false }
          : msg
      ));

      // 如果啟用了TTS，自動朗讀AI回覆
      if (ttsEnabled && reply.trim()) {
        setTimeout(() => {
          speakText(reply, aiMessageId);
        }, 500); // 稍微延遲以確保UI更新完成
      }

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

  // 簡化的音量檢測循環
  const startVolumeMonitoring = () => {
    console.log('🔄 啟動音量監控');
    
    if (volumeCheckIntervalRef.current) {
      console.log('🛑 清除舊的音量監控');
      clearInterval(volumeCheckIntervalRef.current);
    }

    volumeCheckIntervalRef.current = setInterval(() => {
      const hasAnalyser = !!analyserRef.current;
      const currentIsListening = isListeningRef.current;
      
      // 只有在錄音模式且有分析器時才進行音量檢測
      if (!hasAnalyser || !currentIsListening) {
        return;
      }

      const dataArray = new Uint8Array(analyserRef.current!.frequencyBinCount);
      analyserRef.current!.getByteFrequencyData(dataArray);
      
      // 計算音量
      const sum = Array.from(dataArray).reduce((a, b) => a + b, 0);
      const average = sum / dataArray.length;
      
      setCurrentVolume(average);
      
      const silenceThreshold = getSilenceThreshold();
      const voiceThreshold = getVoiceThreshold();
      
      // 語音檢測邏輯 - 簡化版
      const isVoiceDetected = average >= voiceThreshold;
      
      if (isVoiceDetected) {
        if (!hasDetectedVoiceRef.current) {
          console.log('� 檢測到語音！', { 
            average: average.toFixed(1), 
            voiceThreshold: voiceThreshold.toFixed(1)
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
      } else if (hasDetectedVoiceRef.current && currentIsListening) {
        // 開始靜音倒數
        if (!silenceTimerRef.current) {
          console.log('🔴 開始靜音倒數...', { 
            currentVolume: average.toFixed(1), 
            voiceThreshold: voiceThreshold.toFixed(1)
          });
          
          silenceTimerRef.current = setTimeout(() => {
            console.log('⏰ 靜音時間到，自動發送錄音');
            silenceTimerRef.current = null;
            
            try {
              stopRecording();
            } catch (error) {
              console.error('❌ stopRecording 執行錯誤:', error);
            }
          }, SILENCE_DURATION);
        }
      }
    }, 100);
    
    console.log('✅ 音量監控定時器已設置');
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
      <h1>本地語音 AI 助手 🧠</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        智慧對話記憶 + 真人化回應。自動校準環境音，智慧檢測語音活動。AI 會記住對話內容，回應後自動重新開始錄音。
      </p>
      
      {/* 音量監控 */}
      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem', color: '#666' }}>音量監控</span>
          <span style={{ fontSize: '0.8rem', color: '#666' }}>
            當前: {currentVolume.toFixed(1)}
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
        {(isListening || isCalibrating || conversationStarted) && (
          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
            靜音閾值: {getSilenceThreshold().toFixed(1)} | 語音閾值: {getVoiceThreshold().toFixed(1)}
            {isSpeaking && (
              <span style={{ color: '#9c27b0', marginLeft: '10px' }}>
                🗣️ TTS播放中
              </span>
            )}
            {!isSpeaking && isListening && (
              <span style={{ color: '#28a745', marginLeft: '10px' }}>
                🎤 錄音模式
              </span>
            )}
            {!isSpeaking && !isListening && conversationStarted && !isCalibrating && (
              <span style={{ color: '#007bff', marginLeft: '10px' }}>
                🔊 等待語音輸入
              </span>
            )}
            {hasDetectedVoice && (
              <span style={{ color: '#28a745', marginLeft: '10px' }}>✅ 語音已檢測</span>
            )}
          </div>
        )}
      </div>

      {/* TTS 設置 */}
      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '8px', display: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="tts-enabled"
              checked={ttsEnabled}
              onChange={(e) => setTtsEnabled(e.target.checked)}
            />
            <label htmlFor="tts-enabled" style={{ fontSize: '0.9rem', color: '#666' }}>
              🗣️ 自動朗讀
            </label>
          </div>

          {availableVoices.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: '#666' }}>語音:</label>
              <select
                value={ttsVoice?.name || ''}
                onChange={(e) => {
                  const voice = availableVoices.find(v => v.name === e.target.value);
                  setTtsVoice(voice || null);
                }}
                style={{ fontSize: '0.8rem', padding: '0.25rem' }}
              >
                {availableVoices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: '#666' }}>語速:</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={ttsRate}
              onChange={(e) => setTtsRate(parseFloat(e.target.value))}
              style={{ width: '60px' }}
            />
            <span style={{ fontSize: '0.8rem', color: '#666', minWidth: '30px' }}>
              {ttsRate.toFixed(1)}x
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: '#666' }}>音量:</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={ttsVolume}
              onChange={(e) => setTtsVolume(parseFloat(e.target.value))}
              style={{ width: '60px' }}
            />
            <span style={{ fontSize: '0.8rem', color: '#666', minWidth: '30px' }}>
              {Math.round(ttsVolume * 100)}%
            </span>
          </div>

          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.8rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              🔇 停止朗讀
            </button>
          )}
        </div>
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
              請保持安靜 {Math.ceil((NOISE_CALIBRATION_CONFIG.DEFAULT_CALIBRATION_DURATION - (calibrationProgress / 100 * NOISE_CALIBRATION_CONFIG.DEFAULT_CALIBRATION_DURATION)) / 1000)} 秒，讓系統學習環境音...
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
            
            {/* 手動開始錄音按鈕 */}
            {!isListening && !loading && (
              <button
                onClick={startListening}
                style={{
                  padding: '1rem 1.5rem',
                  fontSize: '1rem',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                🎤 開始錄音
              </button>
            )}
            
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
              : `🎤 錄音模式 - 等待語音輸入...（當前音量: ${currentVolume.toFixed(1)}, 需要超過: ${getVoiceThreshold().toFixed(1)}）`
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
            🔄 等待語音輸入或TTS播放...
            {isSpeaking && (
              <span style={{ marginLeft: '10px', color: '#28a745' }}>
                🗣️ TTS播放中
              </span>
            )}
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
                  {message.isPlaying && <span>🔊</span>}
                  
                  {/* AI消息的播放按鈕 */}
                  {message.type === 'ai' && !message.isLoading && message.content.trim() && (
                    <button
                      onClick={() => {
                        if (message.isPlaying) {
                          stopSpeaking();
                        } else {
                          speakText(message.content, message.id);
                        }
                      }}
                      style={{
                        padding: '0.2rem 0.4rem',
                        fontSize: '0.7rem',
                        backgroundColor: message.isPlaying ? '#dc3545' : '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        opacity: 0.8,
                      }}
                    >
                      {message.isPlaying ? '🔇' : '🔊'}
                    </button>
                  )}
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
        <p>✅ 連接到 Gemma3:1b 模型生成回覆</p>
        <p>🗣️ 使用瀏覽器原生 Web Speech API 進行語音合成</p>
        <p>🔄 AI 回應後自動重新開始錄音，實現連續對話</p>
        <p>🧠 智慧對話記憶：AI 會記住最近的對話內容，讓交談更自然</p>
        <p>🎭 真人化回應：使用專門的提示詞讓 AI 回答更像真人對話</p>
        <p>🔇 語音檢測：基本音量檢測功能，錄音時檢測語音活動</p>
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