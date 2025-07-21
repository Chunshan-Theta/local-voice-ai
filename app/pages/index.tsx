import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import type { ConversationMessage } from '../lib/ollama';

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
  const [ttsVolumeLevel, setTtsVolumeLevel] = useState<number>(0); // 監控TTS實際音量
  const [ttsStartTime, setTtsStartTime] = useState<number>(0); // TTS開始時間
  
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
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ttsVolumeSamplesRef = useRef<number[]>([]);
  const previousVolumeRef = useRef<number>(0);
  const volumeChangeCountRef = useRef<number>(0);

  // 語音活動檢測參數
  const SILENCE_DURATION = 2000; // 2秒靜音後自動發送
  const MIN_RECORDING_TIME = 1000; // 最短錄音時間 1秒
  const CALIBRATION_DURATION = 3000; // 3秒校準時間

  // 新增：持續的音頻流管理
  const audioStreamRef = useRef<MediaStream | null>(null);

  const isListeningRef = useRef(false);
  const hasDetectedVoiceRef = useRef(false);
  const baselineNoiseRef = useRef(10);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初始化 TTS 語音列表
  useEffect(() => {
    // 確保在瀏覽器環境中運行
    if (typeof window === 'undefined' || !speechSynthesis) return;

    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      setAvailableVoices(voices);
      
      // 優先選擇中文語音
      const chineseVoice = voices.find(voice => 
        voice.lang.includes('zh') || 
        voice.lang.includes('cmn') ||
        voice.name.includes('Chinese') ||
        voice.name.includes('中文')
      );
      
      if (chineseVoice) {
        setTtsVoice(chineseVoice);
        console.log('🗣️ 選擇中文語音:', chineseVoice.name, chineseVoice.lang);
      } else if (voices.length > 0) {
        setTtsVoice(voices[0]);
        console.log('🗣️ 選擇預設語音:', voices[0].name, voices[0].lang);
      }
    };

    // 語音列表可能需要時間載入
    if (speechSynthesis.getVoices().length === 0) {
      speechSynthesis.addEventListener('voiceschanged', loadVoices);
    } else {
      loadVoices();
    }

    return () => {
      if (speechSynthesis) {
        speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      }
    };
  }, []);

  // 監聽語音合成狀態
  useEffect(() => {
    // 確保在瀏覽器環境中運行
    if (typeof window === 'undefined' || !speechSynthesis) return;

    const checkSpeaking = () => {
      setIsSpeaking(speechSynthesis.speaking);
    };

    const interval = setInterval(checkSpeaking, 100);
    return () => clearInterval(interval);
  }, []);

  // 計算動態閾值 - 使用 ref 確保最新值
  const getSilenceThreshold = () => baselineNoiseRef.current + 0.5; // 進一步降低
  const getVoiceThreshold = () => {
    // 如果TTS正在播放，根據實際TTS音量動態設置閾值
    if (typeof window !== 'undefined' && speechSynthesis && speechSynthesis.speaking) {
      // TTS剛開始播放的前1秒使用較高閾值避免初始波動誤判
      const timeSinceStart = Date.now() - ttsStartTime;
      if (timeSinceStart < 1000) {
        return baselineNoiseRef.current + 20; // 前1秒使用較高閾值
      }
      
      // 動態計算：基於收集到的TTS音量數據
      if (ttsVolumeSamplesRef.current.length > 8) {
        const avgTtsVolume = ttsVolumeSamplesRef.current.reduce((sum, vol) => sum + vol, 0) / ttsVolumeSamplesRef.current.length;
        const maxTtsVolume = Math.max(...ttsVolumeSamplesRef.current);
        // 使用平衡的倍數：取平均值的1.4倍或最大值的1.2倍，選較大者
        const balancedThreshold = Math.max(
          avgTtsVolume * 1.4,
          maxTtsVolume * 1.2,
          baselineNoiseRef.current + 30
        );
        return balancedThreshold;
      }
      // 如果還沒收集到足夠數據，使用中等固定值
      return baselineNoiseRef.current + 15;
    }
    return baselineNoiseRef.current + 1;   // 正常情況下的語音閾值
  };

  // 當有新的 AI 回應時，自動重新開始錄音（即使TTS在播放也開始錄音監聽）
  useEffect(() => {
    if (messages.length > 0 && conversationStarted && !loading && !isListening) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === 'ai' && !lastMessage.isLoading) {
        const timer = setTimeout(() => {
          startListening();
        }, 1000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [messages, conversationStarted, loading, isListening]);

  // 自動滾動到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // TTS 相關函數
  const speakText = (text: string, messageId?: string) => {
    // 確保在瀏覽器環境中運行
    if (typeof window === 'undefined' || !speechSynthesis) return;

    // 停止當前播放
    speechSynthesis.cancel();
    
    if (!text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtteranceRef.current = utterance;

    // 設置語音參數
    if (ttsVoice) {
      utterance.voice = ttsVoice;
    }
    utterance.rate = ttsRate;
    utterance.volume = ttsVolume;
    utterance.pitch = 1;

    // 事件監聽
    utterance.onstart = () => {
      console.log('🗣️ 開始朗讀:', text.substring(0, 50) + '...');
      console.log('🔇 TTS開始，語音檢測將使用動態閾值');
      setTtsStartTime(Date.now()); // 記錄TTS開始時間
      // 重置音量變化計數
      volumeChangeCountRef.current = 0;
      previousVolumeRef.current = 0;
      if (messageId) {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, isPlaying: true } : { ...msg, isPlaying: false }
        ));
      }
    };

    utterance.onend = () => {
      const avgTtsVolume = ttsVolumeSamplesRef.current.length > 0 
        ? (ttsVolumeSamplesRef.current.reduce((sum, vol) => sum + vol, 0) / ttsVolumeSamplesRef.current.length).toFixed(1)
        : 'N/A';
      console.log(`✅ 朗讀完成，收集到${ttsVolumeSamplesRef.current.length}個音量樣本，平均TTS音量: ${avgTtsVolume}`);
      console.log('🔄 語音檢測閾值恢復正常:', baselineNoiseRef.current + 1);
      setMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
      currentUtteranceRef.current = null;
    };

    utterance.onerror = (event) => {
      console.error('❌ TTS 錯誤:', event.error);
      setMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
      currentUtteranceRef.current = null;
    };

    speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    // 確保在瀏覽器環境中運行
    if (typeof window === 'undefined' || !speechSynthesis) return;

    speechSynthesis.cancel();
    setMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
    currentUtteranceRef.current = null;
  };

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
      
      // 校準時必須停止TTS播放，因為需要安靜環境
      stopSpeaking();
      
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
      
      // 注意：不再自動停止TTS，允許TTS播放時進行錄音監聽
      
      console.log('🎤 開始錄音 - 檢查現有資源（TTS可能仍在播放）');
      
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
    setConversationStarted(false);
    stopRecording();
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
      
      // 如果TTS正在播放，收集音量數據用於學習
      const ttsPlaying = typeof window !== 'undefined' && speechSynthesis ? speechSynthesis.speaking : false;
      if (ttsPlaying) {
        ttsVolumeSamplesRef.current.push(average);
        setTtsVolumeLevel(average);
        
        // 計算音量變化率，檢測突然的音量增加
        const volumeChange = Math.abs(average - previousVolumeRef.current);
        if (volumeChange > 2) { // 如果音量變化超過2（降低門檻）
          volumeChangeCountRef.current++;
        }
        previousVolumeRef.current = average;
        
        // 保持最近100個樣本
        if (ttsVolumeSamplesRef.current.length > 100) {
          ttsVolumeSamplesRef.current = ttsVolumeSamplesRef.current.slice(-100);
        }
      } else {
        // TTS停止時重置變化計數
        volumeChangeCountRef.current = 0;
        previousVolumeRef.current = 0;
      }
      
      const silenceThreshold = getSilenceThreshold();
      const voiceThreshold = getVoiceThreshold();
      
      // 每秒打印一次詳細信息
      if (checkCount % 10 === 0) {
        const avgTtsVolume = ttsVolumeSamplesRef.current.length > 0 
          ? (ttsVolumeSamplesRef.current.reduce((sum, vol) => sum + vol, 0) / ttsVolumeSamplesRef.current.length).toFixed(1)
          : 'N/A';
        console.log(`🔊 第${checkCount}次檢查: 平均=${average.toFixed(1)}, 最大=${maxValue.toFixed(1)}, 語音閾值=${voiceThreshold.toFixed(1)}, TTS播放=${ttsPlaying}`);
        console.log(`📊 音頻狀態: 上下文=${audioContextState}, 流活躍=${streamActive}, 監聽中=${currentIsListening}`);
        console.log(`📈 TTS音量監控: 當前=${average.toFixed(1)}, 平均TTS音量=${avgTtsVolume}, 樣本數=${ttsVolumeSamplesRef.current.length}`);
        const timeSinceStart = Date.now() - ttsStartTime;
        if (ttsPlaying) {
          if (timeSinceStart < 1000) {
            console.log(`🎯 保護期閾值: 基準=${baselineNoiseRef.current}, 使用閾值=${voiceThreshold.toFixed(1)} (TTS開始${timeSinceStart}ms)`);
          } else if (ttsVolumeSamplesRef.current.length > 8) {
            const maxTtsVolume = Math.max(...ttsVolumeSamplesRef.current);
            console.log(`🎯 動態閾值: 基準=${baselineNoiseRef.current}, TTS平均=${avgTtsVolume}, TTS最大=${maxTtsVolume.toFixed(1)}, 計算閾值=${voiceThreshold.toFixed(1)}`);
          } else {
            console.log(`🎯 等待數據閾值: 基準=${baselineNoiseRef.current}, 使用閾值=${voiceThreshold.toFixed(1)} (樣本數${ttsVolumeSamplesRef.current.length})`);
          }
        } else {
          console.log(`🎯 正常閾值: 基準=${baselineNoiseRef.current}, 使用閾值=${voiceThreshold.toFixed(1)}`);
        }
      }
      
      // 語音檢測邏輯 - 只依賴平均值，忽略最大值波動
      const isVoiceDetected = average >= voiceThreshold; // 只使用平均值檢測
      
      // 每次都記錄語音檢測結果（用於調試）
      if (checkCount % 5 === 0) { // 每500ms記錄一次
        const ttsPlaying = typeof window !== 'undefined' && speechSynthesis ? speechSynthesis.speaking : false;
        const avgTtsVolume = ttsVolumeSamplesRef.current.length > 0 
          ? ttsVolumeSamplesRef.current.reduce((sum, vol) => sum + vol, 0) / ttsVolumeSamplesRef.current.length
          : 0;
        console.log('🔍 語音檢測詳情:', {
          average: average.toFixed(1),
          maxValue: maxValue.toFixed(1),
          voiceThreshold: voiceThreshold.toFixed(1),
          normalThreshold: (baselineNoiseRef.current + 1).toFixed(1),
          dynamicTtsThreshold: ttsPlaying && ttsVolumeSamplesRef.current.length > 8 
            ? Math.max(avgTtsVolume * 1.6, Math.max(...ttsVolumeSamplesRef.current) * 1.3, baselineNoiseRef.current + 10).toFixed(1)
            : 'N/A',
          fallbackTtsThreshold: (baselineNoiseRef.current + 15).toFixed(1),
          volumeChangeCount: volumeChangeCountRef.current,
          avgTtsVolume: avgTtsVolume.toFixed(1),
          ttsPlaying,
          isVoiceDetectedByAverage: average >= voiceThreshold,
          isVoiceDetected,
          hasDetectedVoiceBefore: hasDetectedVoiceRef.current,
          checkCount
        });
      }
      
      if (isVoiceDetected) {
        // 🔥 核心功能：如果TTS正在播放且檢測到語音，增加額外驗證後停止TTS
        if (typeof window !== 'undefined' && speechSynthesis && speechSynthesis.speaking) {
          // 額外驗證：檢查是否真的是人聲打斷
          const timeSinceStart = Date.now() - ttsStartTime;
          const hasSignificantVolumeChange = volumeChangeCountRef.current > 1; // 有顯著音量變化（降低門檻）
          const isAboveThreshold = average > getVoiceThreshold(); // 超過基本閾值即可
          
          if (timeSinceStart > 500 && (hasSignificantVolumeChange || isAboveThreshold)) {
            console.log('🔇 檢測到用戶說話，立即停止TTS播放', {
              timeSinceStart,
              hasSignificantVolumeChange,
              isAboveThreshold,
              currentVolume: average.toFixed(1),
              threshold: getVoiceThreshold().toFixed(1)
            });
            stopSpeaking();
          } else {
            console.log('⚠️ 疑似誤判，不停止TTS', {
              timeSinceStart,
              hasSignificantVolumeChange,
              isAboveThreshold,
              volumeChangeCount: volumeChangeCountRef.current
            });
          }
        }
        
        if (!hasDetectedVoiceRef.current) {
          console.log('🟢 檢測到語音！', { 
            average: average.toFixed(1), 
            max: maxValue.toFixed(1),
            trigger: average >= voiceThreshold ? 'average' : 'maxValue',
            ttsWasPlaying: speechSynthesis.speaking
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
              {isSpeaking && ttsVolumeLevel > 0 && (
                <span style={{ marginLeft: '10px', color: '#9c27b0' }}>
                  | TTS音量: {ttsVolumeLevel.toFixed(1)}
                </span>
              )}
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
            {isSpeaking && (
              <span style={{ color: '#9c27b0', marginLeft: '10px' }}>
                🗣️ TTS模式（動態閾值:{getVoiceThreshold().toFixed(1)}）
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
            {isSpeaking && !hasDetectedVoice && (
              <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: '#28a745' }}>
                💡 TTS正在播放，請稍微大聲說話來打斷（動態閾值: {getVoiceThreshold().toFixed(1)}）
                <br />
                <span style={{ color: '#9c27b0' }}>
                  🔊 實時：TTS音量{ttsVolumeLevel.toFixed(1)}，系統已自動調整檢測閾值
                  {ttsVolumeSamplesRef.current.length > 5 && (
                    <span>（基於{ttsVolumeSamplesRef.current.length}個樣本）</span>
                  )}
                </span>
              </div>
            )}
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
            {isSpeaking && (
              <span style={{ marginLeft: '10px', color: '#28a745' }}>
                🗣️ TTS播放中，您可隨時說話打斷
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