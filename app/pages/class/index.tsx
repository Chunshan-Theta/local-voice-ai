'use client';

import React, { useState, useEffect, useRef } from "react";
import { 
  createNoiseCalibrator, 
  createThresholdCalculator, 
  type NoiseCalibrator, 
  type ThresholdCalculator,
  NOISE_CALIBRATION_CONFIG 
} from '../../lib/noiseCalibrator';
import { 
  createTtsManager, 
  type TtsManager
} from '../../lib/ttsManager';
import { 
  createReplyManager, 
  type ReplyManager, 
  type Message,
  formatReplyError,
  isAudioValid
} from '../../lib/replyManager';

// Import from the existing types system
import { AgentConfig } from "./types";
import { UserInfoModal, type UserInfo, ChatRoom, TopToolbar, BottomControlPanel } from "./components";
import { AgentConfigManager } from "./utils/agentConfigManager";
import { type Language } from "./utils/agentFactory";

function ClassChatPage() {
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [clientLanguage, setClientLanguage] = useState<Language>('zh');
  const [userInfo, setUserInfo] = useState<UserInfo>({ email: '', uname: '' });
  const [isUserInfoValid, setIsUserInfoValid] = useState(false);
  const [showUserInfoModal, setShowUserInfoModal] = useState(true);

  // 語音相關狀態
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  
  // TTS 相關狀態
  const [ttsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // 音頻檢測相關狀態
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  const [calibrationProgress, setCalibrationProgress] = useState<number>(0);
  const [hasDetectedVoice, setHasDetectedVoice] = useState(false);
  const [waitingForVoiceAfterTts, setWaitingForVoiceAfterTts] = useState(false);
  
  // 打斷相關狀態
  const [isInterrupting, setIsInterrupting] = useState(false);
  
  // 報告相關狀態
  const [showReportButton, setShowReportButton] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  
  // refs管理
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const continuousVolumeCheckRef = useRef<NodeJS.Timeout | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const noiseCalibrationRef = useRef<NoiseCalibrator | null>(null);
  const thresholdCalculatorRef = useRef<ThresholdCalculator | null>(null);
  const ttsManagerRef = useRef<TtsManager | null>(null);
  const replyManagerRef = useRef<ReplyManager | null>(null);

  const isListeningRef = useRef(false);
  const hasDetectedVoiceRef = useRef(false);
  const waitingForVoiceAfterTtsRef = useRef(false);
  const conversationStartedRef = useRef(false);
  const baselineNoiseRef = useRef(10);
  const recordingStartTimeRef = useRef<number>(0);
  
  const isInterruptingRef = useRef(false);
  const interruptCheckCountRef = useRef(0);

  // 常數
  const SILENCE_DURATION = 1000; // 2秒靜音後自動發送
  const MIN_RECORDING_DURATION = 1000; // 最小錄音時間：1秒

  // Agent 配置載入 - 使用 AgentConfigManager
  useEffect(() => {
    if (!clientLanguage) {
      return;
    }

    try {
      setLocalLoading(true);
      setError(null);

      // 使用 AgentConfigManager 載入範例配置
      const agentManager = AgentConfigManager.getInstance();
      const exampleConfig = agentManager.loadExampleConfig(clientLanguage);
      setAgentConfig(exampleConfig);
      
      console.log('✅ 已載入範例 Agent 配置:', exampleConfig.name);
    } catch (err) {
      console.error('載入 Agent 配置錯誤:', err);
      setError('無法載入 Agent 配置');
    } finally {
      setLocalLoading(false);
    }
  }, [clientLanguage]);

  // 處理用戶信息提交
  const handleUserInfoSubmit = (userInfo: UserInfo) => {
    setUserInfo(userInfo);
    setIsUserInfoValid(true);
    setShowUserInfoModal(false);
  };

  // 簡化TTS管理器初始化
  useEffect(() => {
    if (!ttsManagerRef.current) {
      ttsManagerRef.current = createTtsManager(
        {
          enabled: ttsEnabled,
          voice: null,
          rate: 1.0,
          volume: 0.8,
          pitch: 1.0
        },
        {
          onStart: (text, messageId) => {
            console.log('🔇 TTS開始播放');
            // 停止當前錄音（如果有的話）
            if (isListeningRef.current) {
              console.log('⏹️ TTS開始時停止錄音');
              stopListening();
            }
            
            // TTS開始時清除等待狀態
            if (waitingForVoiceAfterTtsRef.current) {
              console.log('🔄 TTS開始時清除等待語音觸發狀態');
              setWaitingForVoiceAfterTts(false);
              waitingForVoiceAfterTtsRef.current = false;
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
            
            // TTS結束後等待語音輸入
            setTimeout(() => {
              console.log('🎤 TTS結束後等待語音輸入');
              console.log(`條件檢查: conversationStarted=${conversationStartedRef.current}, isListeningRef=${isListeningRef.current}`);
              if (conversationStartedRef.current && !isListeningRef.current) {
                console.log('✅ 條件滿足，設置等待語音觸發狀態');
                setWaitingForVoiceAfterTts(true);
                waitingForVoiceAfterTtsRef.current = true;
              } else {
                console.log('❌ 條件不滿足，無法設置等待語音觸發狀態');
                console.log(`  - conversationStarted: ${conversationStartedRef.current}`);
                console.log(`  - isListening: ${isListeningRef.current}`);
              }
            }, 500);
          },
          onError: (error, messageId) => {
            console.error('❌ TTS 錯誤:', error.error);
            setMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
            
            // TTS錯誤後也要等待語音輸入
            setTimeout(() => {
              console.log('🎤 TTS錯誤後等待語音輸入');
              console.log(`條件檢查: conversationStarted=${conversationStartedRef.current}, isListeningRef=${isListeningRef.current}`);
              if (conversationStartedRef.current && !isListeningRef.current) {
                console.log('✅ 條件滿足，設置等待語音觸發狀態');
                setWaitingForVoiceAfterTts(true);
                waitingForVoiceAfterTtsRef.current = true;
              } else {
                console.log('❌ 條件不滿足，無法設置等待語音觸發狀態');
                console.log(`  - conversationStarted: ${conversationStartedRef.current}`);
                console.log(`  - isListening: ${isListeningRef.current}`);
              }
            }, 500);
          },
          onSpeakingChange: (speaking) => {
            setIsSpeaking(speaking);
          }
        }
      );
    }

    return () => {
      if (ttsManagerRef.current) {
        ttsManagerRef.current.destroy();
      }
      if (replyManagerRef.current) {
        replyManagerRef.current.destroy();
      }
      stopContinuousVolumeMonitoring();
      
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // 初始化回覆管理器
  useEffect(() => {
    if (!replyManagerRef.current) {
      replyManagerRef.current = createReplyManager(
        {
          maxHistoryLength: 10,
          timeout: 60000,
        },
        {
          onTranscriptionStart: (messageId) => {
            const userMessage: Message = {
              id: messageId,
              type: 'user',
              content: '正在轉錄語音...',
              timestamp: new Date(),
              isLoading: true,
            };
            setMessages(prev => [...prev, userMessage]);
          },
          onTranscriptionComplete: (messageId, transcript) => {
            setMessages(prev => prev.map(msg => 
              msg.id === messageId 
                ? { ...msg, content: transcript, isLoading: false }
                : msg
            ));
          },
          onReplyStart: (messageId) => {
            const aiMessage: Message = {
              id: messageId,
              type: 'ai',
              content: '正在思考回覆...',
              timestamp: new Date(),
              isLoading: true,
            };
            setMessages(prev => [...prev, aiMessage]);
          },
          onReplyComplete: (messageId, reply) => {
            setMessages(prev => prev.map(msg => 
              msg.id === messageId 
                ? { ...msg, content: reply, isLoading: false }
                : msg
            ));
          },
          onError: (error, messageId) => {
            console.error('Reply 錯誤:', error);
            setError(formatReplyError(error));
            
            // 移除loading中的消息
            if (messageId) {
              setMessages(prev => prev.filter(msg => msg.id !== messageId || !msg.isLoading));
            }
            
            // 如果是語音轉錄錯誤，更新用戶消息為錯誤提示，然後2秒後移除
            if (error.includes('未識別到有效語音') && messageId) {
              setMessages(prev => prev.map(msg => 
                msg.id === messageId 
                  ? { ...msg, content: '🔇 未識別到有效語音，請重新說話...', isLoading: false }
                  : msg
              ));
              
              // 2秒後移除這個錯誤消息
              setTimeout(() => {
                setMessages(prev => prev.filter(msg => msg.id !== messageId));
              }, 2000);
            }
            
            // 語音轉錄錯誤後，如果對話已開始，重新進入等待語音觸發狀態
            setTimeout(() => {
              if (conversationStartedRef.current && !isListeningRef.current) {
                console.log('🔄 語音轉錄錯誤後，重新進入等待語音觸發狀態');
                setWaitingForVoiceAfterTts(true);
                waitingForVoiceAfterTtsRef.current = true;
                // 清除錯誤信息，避免一直顯示
                setError(null);
              }
            }, 2000); // 2秒後清除錯誤並重新進入等待狀態
          },
          onSpeakReply: (text, messageId) => {
            if (ttsEnabled && text.trim()) {
              setTimeout(() => {
                speakText(text, messageId);
              }, 500);
            }
          }
        }
      );
    }

    return () => {
      if (replyManagerRef.current) {
        replyManagerRef.current.destroy();
      }
    };
  }, [ttsEnabled]);

  // 初始化並啟動持續音量監測
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
          baselineNoiseRef.current = baselineNoise;
          setIsCalibrating(false);
          
          if (!thresholdCalculatorRef.current) {
            thresholdCalculatorRef.current = createThresholdCalculator(baselineNoise);
          } else {
            thresholdCalculatorRef.current.updateBaselineNoise(baselineNoise);
          }
          
          // 校準完成後自動開始持續音量監測
          startContinuousVolumeMonitoring();
        },
        onError: (error) => {
          console.error('校準錯誤:', error);
          setError('校準失敗，將使用預設值');
          setIsCalibrating(false);
          // 即使校準失敗也要開始音量監測
          startContinuousVolumeMonitoring();
        }
      });
    }

    if (!thresholdCalculatorRef.current) {
      thresholdCalculatorRef.current = createThresholdCalculator(baselineNoiseRef.current);
    }

    // 組件初始化時就開始持續音量監測
    const initializeContinuousMonitoring = async () => {
      try {
        await createAudioStream();
        startContinuousVolumeMonitoring();
      } catch (error) {
        console.log('等待用戶交互後再啟動音量監測');
      }
    };
    
    initializeContinuousMonitoring();

    // 清理函數
    return () => {
      stopContinuousVolumeMonitoring();
    };
  }, []);

  // 計算動態閾值 - 使用閾值計算器
  const getVoiceThreshold = () => {
    if (thresholdCalculatorRef.current) {
      const isTtsPlaying = ttsManagerRef.current ? ttsManagerRef.current.isSpeaking() : false;
      return thresholdCalculatorRef.current.getCurrentVoiceThreshold(isTtsPlaying);
    }
    
    // 簡化的降級處理邏輯
    return baselineNoiseRef.current + NOISE_CALIBRATION_CONFIG.VOICE_THRESHOLD_OFFSET;
  };

  // 獲取搶話閾值
  const getInterruptThreshold = () => {
    if (thresholdCalculatorRef.current) {
      return thresholdCalculatorRef.current.getInterruptThreshold();
    }
    return baselineNoiseRef.current + NOISE_CALIBRATION_CONFIG.INTERRUPT_THRESHOLD_OFFSET;
  };

  // 檢查是否應該打斷 TTS
  const shouldInterruptTts = (currentVolume: number): boolean => {
    const isTtsPlaying = ttsManagerRef.current ? ttsManagerRef.current.isSpeaking() : false;
    if (!isTtsPlaying || isInterruptingRef.current || isListeningRef.current) {
      return false;
    }
    
    if (thresholdCalculatorRef.current) {
      return thresholdCalculatorRef.current.shouldInterrupt(currentVolume, isTtsPlaying);
    }
    
    // 降級處理：手動實現打斷邏輯
    const baseThreshold = getVoiceThreshold();
    const interruptThreshold = getInterruptThreshold();
    return currentVolume >= baseThreshold && currentVolume >= interruptThreshold;
  };

  // 執行打斷 TTS 的動作
  const performTtsInterrupt = () => {
    console.log('🚨 檢測到搶話，打斷 TTS 播放');
    setIsInterrupting(true);
    isInterruptingRef.current = true;
    
    // 停止 TTS 播放
    if (ttsManagerRef.current) {
      ttsManagerRef.current.stop();
    }
    
    // 重置打斷檢測計數
    interruptCheckCountRef.current = 0;
    
    // 立即開始錄音
    setTimeout(() => {
      console.log('🎤 打斷後開始錄音');
      setIsInterrupting(false);
      isInterruptingRef.current = false;
      startListening();
    }, 100);
  };

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

  // 簡化音頻流創建
  const createAudioStream = async () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1,
      } 
    });

    audioStreamRef.current = stream;
    return stream;
  };

  // 簡化音頻分析器設置
  const setupAudioAnalyser = (stream: MediaStream) => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext();
    }
    
    if (!analyserRef.current) {
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.8;
    }
    
    return analyserRef.current;
  };

  // 簡化環境音校準
  const calibrateEnvironmentalNoise = async () => {
    try {
      setIsCalibrating(true);
      setCalibrationProgress(0);
      stopSpeaking();
      
      // 使用現有的音頻流或創建新的
      let stream = audioStreamRef.current;
      if (!stream || !stream.active) {
        stream = await createAudioStream();
      }
      
      const analyser = setupAudioAnalyser(stream);

      if (noiseCalibrationRef.current) {
        await noiseCalibrationRef.current.startCalibration(analyser);
      } else {
        throw new Error('噪音校準器未初始化');
      }
      
    } catch (err) {
      console.error('校準錯誤:', err);
      setError('校準失敗，將使用預設值');
      setIsCalibrating(false);
      // 即使校準失敗也要確保持續監測正在運行
      if (!continuousVolumeCheckRef.current) {
        startContinuousVolumeMonitoring();
      }
    }
  };

  const startListening = async () => {
    try {
      // 開始錄音時停止TTS播放
      if (isSpeaking) {
        stopSpeaking();
      }
      
      // 開始錄音時清除等待狀態
      setWaitingForVoiceAfterTts(false);
      waitingForVoiceAfterTtsRef.current = false;
      
      // 如果已經在錄音，先停止
      if (isListeningRef.current) {
        stopListening();
      }
      
      setError(null);
      audioChunksRef.current = [];
      setHasDetectedVoice(false);
      hasDetectedVoiceRef.current = false;
      
      // 創建或使用現有音頻流
      let stream = audioStreamRef.current;
      
      if (!stream || !stream.active) {
        stream = await createAudioStream();
        setupAudioAnalyser(stream);
      } else if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        setupAudioAnalyser(stream);
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
      recordingStartTimeRef.current = Date.now(); // 記錄開始錄音的時間
      
      // startListening 時不自動設置 conversationStarted
      // 這應該由 startConversation 或其他明確的流程控制
      console.log(`🎤 startListening: conversationStarted=${conversationStartedRef.current}`);
      
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
    
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    stopListening();
  };

  const endConversation = () => {
    console.log('🛑 結束對話 - 設置 conversationStarted = false');
    setConversationStarted(false);
    conversationStartedRef.current = false;
    stopRecording();
    // 不停止持續監測，保持音量監控運行
    stopSpeaking();
    
    // 如果有對話內容，顯示生成報告按鈕
    if (messages.length > 0) {
      setShowReportButton(true);
    } else {
      setMessages([]);
    }
    
    setWaitingForVoiceAfterTts(false);
    waitingForVoiceAfterTtsRef.current = false;
    
    setHasDetectedVoice(false);
    hasDetectedVoiceRef.current = false;
  };

  const startConversation = async () => {
    await calibrateEnvironmentalNoise();
    setTimeout(() => {
      console.log('🎤 校準完成，進入等待語音觸發模式');
      console.log('✅ 設置 conversationStarted = true');
      setConversationStarted(true);
      conversationStartedRef.current = true;
      setWaitingForVoiceAfterTts(true);
      waitingForVoiceAfterTtsRef.current = true;
    }, 500);
  };

  const processAudio = async () => {
    setLoading(true);
    setError(null);

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // 檢查錄音時長
      const recordingDuration = Date.now() - recordingStartTimeRef.current;
      console.log(`🎤 錄音時長: ${recordingDuration}ms`);
      
      // 如果錄音時間小於最小時長，視為誤判
      if (recordingDuration < MIN_RECORDING_DURATION) {
        console.log(`⚠️ 錄音時間過短 (<${MIN_RECORDING_DURATION}ms)，視為誤判，重新進入等待語音觸發狀態`);
        setError('錄音時間過短，請說話時間長一點');
        setLoading(false);
        
        // 重新進入等待語音觸發狀態
        if (conversationStartedRef.current) {
          setTimeout(() => {
            console.log('🔄 短錄音後重新進入等待語音觸發狀態');
            setWaitingForVoiceAfterTts(true);
            waitingForVoiceAfterTtsRef.current = true;
            // 清除錯誤提示
            setError(null);
          }, 2000); // 2秒後清除錯誤並重新進入等待狀態
        }
        return;
      }
      
      if (!isAudioValid(audioBlob)) {
        setLoading(false);
        return;
      }

      if (!replyManagerRef.current) {
        throw new Error('回覆管理器未初始化');
      }

      // 使用replyManager處理音頻
      await replyManagerRef.current.processAudio(audioBlob, messages);

    } catch (err) {
      console.error('處理錯誤:', err);
    } finally {
      setLoading(false);
      
      if (conversationStartedRef.current && !isListeningRef.current) {
        console.log('🎤 音頻處理完成，準備等待TTS播放和語音觸發');
      }
    }
  };

  // 持續音量監測 - 獨立於錄音狀態
  const startContinuousVolumeMonitoring = async () => {
    try {
      // 如果已經在監測，先停止
      if (continuousVolumeCheckRef.current) {
        clearInterval(continuousVolumeCheckRef.current);
      }

      // 確保有音頻流和分析器
      let stream = audioStreamRef.current;
      if (!stream || !stream.active) {
        stream = await createAudioStream();
        setupAudioAnalyser(stream);
      } else if (!analyserRef.current) {
        setupAudioAnalyser(stream);
      }

      continuousVolumeCheckRef.current = setInterval(() => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setCurrentVolume(average);
        
        // 打斷邏輯：TTS 播放時檢測搶話
        if (ttsManagerRef.current && ttsManagerRef.current.isSpeaking() && 
            !isListeningRef.current && !isInterruptingRef.current) {
          
          if (shouldInterruptTts(average)) {
            interruptCheckCountRef.current++;
            console.log(`🔍 檢測到可能的搶話 (${interruptCheckCountRef.current}/3): 音量=${average.toFixed(1)}, 搶話閾值=${getInterruptThreshold().toFixed(1)}`);
            
            // 連續3次檢測到搶話才執行打斷（避免誤判）
            if (interruptCheckCountRef.current >= 3) {
              performTtsInterrupt();
              return; // 執行打斷後直接返回，不繼續其他邏輯
            }
          } else {
            // 重置計數器
            if (interruptCheckCountRef.current > 0) {
              interruptCheckCountRef.current = 0;
            }
          }
        }
        
        // 如果正在錄音，同時進行語音檢測邏輯
        if (isListeningRef.current) {
          const voiceThreshold = getVoiceThreshold();
          const isVoiceDetected = average >= voiceThreshold;
          
          if (isVoiceDetected) {
            if (!hasDetectedVoiceRef.current) {
              setHasDetectedVoice(true);
              hasDetectedVoiceRef.current = true;
            }
            
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else if (hasDetectedVoiceRef.current) {
            if (!silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                silenceTimerRef.current = null;
                stopRecording();
              }, SILENCE_DURATION);
            }
          }
        }
        
        // 如果正在等待TTS後的語音輸入，檢測是否超過閾值
        if (waitingForVoiceAfterTtsRef.current && !isListeningRef.current) {
          const voiceThreshold = getVoiceThreshold();
          // 減少日志輸出頻率，只在檢測到語音或每隔幾秒輸出一次
          const shouldLog = average >= voiceThreshold || (Math.round(Date.now() / 1000) % 3 === 0);
          if (shouldLog) {
            console.log(`🔍 等待語音檢測中... 當前音量: ${average.toFixed(1)}, 閾值: ${voiceThreshold.toFixed(1)}`);
          }
          
          if (average >= voiceThreshold) {
            console.log('🎤 檢測到語音，自動開始錄音');
            setWaitingForVoiceAfterTts(false);
            waitingForVoiceAfterTtsRef.current = false;
            // 使用 setTimeout 避免在當前函數執行中調用 startListening
            setTimeout(() => {
              startListening();
            }, 50);
          }
        }
      }, 100);
      
      console.log('✅ 持續音量監測已啟動');
    } catch (error) {
      console.error('啟動持續音量監測失敗:', error);
    }
  };

  const stopContinuousVolumeMonitoring = () => {
    if (continuousVolumeCheckRef.current) {
      clearInterval(continuousVolumeCheckRef.current);
      continuousVolumeCheckRef.current = null;
      console.log('❌ 持續音量監測已停止');
    }
  };

  // 生成對話報告
  const generateReport = async () => {
    if (messages.length === 0) return;
    
    setGeneratingReport(true);
    try {
      // 準備對話數據
      const timeline = messages
        .filter(msg => !msg.isLoading && msg.content.trim())
        .map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

      // 儲存到 localStorage（簡化版的報告功能）
      const reportData = {
        timeline,
        agentInfo: {
          name: agentConfig?.name,
          criteria: agentConfig?.criteria
        },
        userInfo,
        timestamp: new Date().toISOString()
      };

      localStorage.setItem('conversationReport', JSON.stringify(reportData));
      
      // 顯示成功訊息
      alert('對話報告已生成並儲存！\n\n您可以在瀏覽器的 localStorage 中找到詳細報告數據。');
      
    } catch (error) {
      console.error('生成報告錯誤:', error);
      alert('生成報告時發生錯誤，請稍後再試。');
    } finally {
      setGeneratingReport(false);
    }
  };

  // 清除所有數據並重新開始
  const startNewConversation = () => {
    setMessages([]);
    setShowReportButton(false);
    setError(null);
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      background: '#2F4F4F',
      position: 'relative'
    }}>
      {/* 頂部工具列 */}
      <TopToolbar
        showNotification={!isUserInfoValid || !agentConfig || localLoading || !!error}
        localLoading={localLoading}
        error={error}
        agentConfig={agentConfig}
        currentLanguage={clientLanguage}
        onLanguageChange={setClientLanguage}
      />

      {/* 用戶信息輸入模態（如果需要） */}
      <UserInfoModal 
        isVisible={showUserInfoModal}
        onSubmit={handleUserInfoSubmit}
      />

      {/* 主要聊天區域 */}
      {isUserInfoValid && agentConfig && !localLoading && (
        <>
          {/* 聊天記錄區域 */}
          <ChatRoom 
            messages={messages}
            conversationStarted={conversationStarted}
          />

          {/* 底部控制面板 */}
          <BottomControlPanel
            isCalibrating={isCalibrating}
            calibrationProgress={calibrationProgress}
            isListening={isListening}
            isSpeaking={isSpeaking}
            waitingForVoiceAfterTts={waitingForVoiceAfterTts}
            conversationStarted={conversationStarted}
            loading={loading}
            generatingReport={generatingReport}
            showReportButton={showReportButton}
            messagesLength={messages.length}
            onStartListening={startListening}
            onStopRecording={stopRecording}
            onStartConversation={startConversation}
            onEndConversation={endConversation}
            onGenerateReport={generateReport}
            onStartNewConversation={startNewConversation}
          />
        </>
      )}
      
      {/* CSS Styles */}
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

export default ClassChatPage;