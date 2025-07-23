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

// Simple language type definition
type Language = 'zh' | 'en';

interface UserInfo {
  email: string;
  uname: string;
}

// Helper function to create example agent config
function createExampleAgentConfig(lang: Language): AgentConfig {
  const instructions = lang === 'zh' 
    ? `你是一個友善、專業的 AI 語音助手。請用自然、親切的方式與用戶對話。

## 你的角色
- 你是一個智能語音助手，能夠理解並回應用戶的各種問題
- 你擅長進行自然對話，提供有用的信息和建議
- 你會用中文與用戶交流

## 對話風格
- 保持友善、耐心的態度
- 回答要簡潔明了，避免過長的回應
- 適當使用表情符號讓對話更生動
- 如果不確定某些信息，請誠實說明

## 注意事項
- 請用中文回應
- 保持對話的自然流暢
- 避免重複或機械性的回答`
    : `You are a friendly and professional AI voice assistant. Please communicate with users in a natural and warm manner.

## Your Role
- You are an intelligent voice assistant capable of understanding and responding to various user questions
- You excel at natural conversation and providing helpful information and suggestions
- You communicate with users in English

## Conversation Style
- Maintain a friendly and patient attitude
- Keep responses concise and clear, avoiding overly long responses
- Use appropriate emojis to make conversations more lively
- If uncertain about information, please be honest about it

## Important Notes
- Please respond in English
- Keep conversations natural and smooth
- Avoid repetitive or mechanical responses`;

  return {
    name: lang === 'zh' ? '智能語音助手' : 'Smart Voice Assistant',
    publicDescription: lang === 'zh' 
      ? '一個友善的AI語音助手，能夠進行自然對話並提供有用的信息' 
      : 'A friendly AI voice assistant capable of natural conversation and providing helpful information',
    instructions,
    tools: [],
    toolLogic: {},
    lang: lang,
    voice: 'echo',
    criteria: lang === 'zh' 
      ? '評估對話的自然度、有用性和用戶滿意度' 
      : 'Evaluate conversation naturalness, usefulness, and user satisfaction'
  };
}

function ClassChatPage() {
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [clientLanguage, setClientLanguage] = useState<Language>('zh');
  const [userInfo, setUserInfo] = useState<UserInfo>({ email: '', uname: '' });
  const [isUserInfoValid, setIsUserInfoValid] = useState(false);

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const isInterruptingRef = useRef(false);
  const interruptCheckCountRef = useRef(0);

  // 常數
  const SILENCE_DURATION = 2000; // 2秒靜音後自動發送
  const MIN_RECORDING_DURATION = 1000; // 最小錄音時間：1秒

  // Agent 配置載入 - 直接創建範例配置
  useEffect(() => {
    if (!clientLanguage) {
      return;
    }

    try {
      setLocalLoading(true);
      setError(null);

      // 直接創建範例 Agent 配置
      const exampleConfig = createExampleAgentConfig(clientLanguage);
      setAgentConfig(exampleConfig);
      
      console.log('✅ 已載入範例 Agent 配置:', exampleConfig.name);
    } catch (err) {
      console.error('載入 Agent 配置錯誤:', err);
      setError('無法載入 Agent 配置');
    } finally {
      setLocalLoading(false);
    }
  }, [clientLanguage]);

  // 用戶信息驗證
  useEffect(() => {
    const isValid = userInfo.email.trim() !== '' && userInfo.uname.trim() !== '';
    setIsUserInfoValid(isValid);
  }, [userInfo]);

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
      // 組件卸載時才停止持續監測
      stopContinuousVolumeMonitoring();
      
      // 清理音頻資源
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
  const getSilenceThreshold = () => {
    if (thresholdCalculatorRef.current) {
      return thresholdCalculatorRef.current.getSilenceThreshold();
    }
    return baselineNoiseRef.current + NOISE_CALIBRATION_CONFIG.SILENCE_THRESHOLD_OFFSET; // 降級處理
  };
  
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
      
      // 持續音量監測應該已經在運行，不需要重複啟動
      
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
    stopVolumeMonitoring(); // 只停止錄音相關的監測
    stopSpeaking();
    
    // 如果有對話內容，顯示生成報告按鈕
    if (messages.length > 0) {
      setShowReportButton(true);
    } else {
      setMessages([]);
    }
    
    // 清除等待狀態
    setWaitingForVoiceAfterTts(false);
    waitingForVoiceAfterTtsRef.current = false;
    
    // 不關閉音頻流和分析器，保持持續監測
    // 只重置語音檢測狀態
    setHasDetectedVoice(false);
    hasDetectedVoiceRef.current = false;
  };

  const startConversation = async () => {
    await calibrateEnvironmentalNoise();
    setTimeout(() => {
      // 持續音量監測應該已經在運行
      // 第一次對話也設置為等待語音觸發模式
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
      // 錯誤處理已在replyManager的callback中處理，這裡不需要重複處理
      // 但如果是網絡錯誤等其他錯誤，也要確保能重新進入等待狀態
    } finally {
      setLoading(false);
      
      // 音頻處理完成後，如果對話已開始且沒有在錄音，準備等待TTS完成或重新等待語音觸發
      if (conversationStartedRef.current && !isListeningRef.current) {
        console.log('🎤 音頻處理完成，準備等待TTS播放和語音觸發');
        // 如果沒有錯誤，等待狀態將由TTS的onEnd回調設置
        // 如果有錯誤，等待狀態將由replyManager的onError回調設置
      }
    }
  };

  const getVolumeBarColor = () => {
    if (isCalibrating) return '#ffc107';
    if (isInterrupting) return '#e91e63'; // 粉紅色 - 打斷中
    if (!isListening && !waitingForVoiceAfterTts) return '#6c757d';
    
    const voiceThreshold = getVoiceThreshold();
    const silenceThreshold = getSilenceThreshold();
    const interruptThreshold = getInterruptThreshold();
    
    // TTS 播放時的特殊顏色
    if (ttsManagerRef.current && ttsManagerRef.current.isSpeaking()) {
      if (currentVolume >= interruptThreshold) return '#ff5722'; // 深橙色 - 觸發搶話閾值
      if (currentVolume >= voiceThreshold) return '#ff9800'; // 橙色 - 接近搶話閾值
      return '#9c27b0'; // 紫色 - TTS 播放中
    }
    
    if (currentVolume >= voiceThreshold) return '#28a745'; // 綠色 - 語音
    if (currentVolume >= silenceThreshold) return '#fd7e14'; // 橙色 - 中等
    return '#dc3545'; // 紅色 - 靜音
  };

  const getVolumePercentage = () => {
    const maxDisplayVolume = Math.max(getVoiceThreshold() * 2, 100);
    return Math.min((currentVolume / maxDisplayVolume) * 100, 100);
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
        
        // 詳細的狀態調試信息（每5秒輸出一次）
        // if (Math.round(Date.now() / 1000) % 5 === 0) {
        //   console.log(`📊 狀態檢查: 
        //     - waitingForVoiceAfterTts: ${waitingForVoiceAfterTtsRef.current}
        //     - isListening: ${isListeningRef.current} 
        //     - isSpeaking: ${ttsManagerRef.current ? ttsManagerRef.current.isSpeaking() : 'unknown'}
        //     - isInterrupting: ${isInterruptingRef.current}
        //     - 當前音量: ${average.toFixed(1)}
        //     - 語音閾值: ${getVoiceThreshold().toFixed(1)}
        //     - 搶話閾值: ${getInterruptThreshold().toFixed(1)}`);
        // }
        
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

  // 簡化的音量檢測循環（保留用於向後兼容）
  const startVolumeMonitoring = () => {
    // 現在直接使用持續監測
    if (!continuousVolumeCheckRef.current) {
      startContinuousVolumeMonitoring();
    }
  };

  const stopVolumeMonitoring = () => {
    // 不再停止持續監測，只清理錄音相關的定時器
    if (continuousVolumeCheckRef.current) {
      clearInterval(continuousVolumeCheckRef.current);
      continuousVolumeCheckRef.current = null;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-TW', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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
      background: 'linear-gradient(135deg, #2d5a6b 0%, #4a7c7e 100%)',
      position: 'relative'
    }}>
      {/* 頂部訊息提示區域 */}
      {(!isUserInfoValid || !agentConfig || localLoading || error) && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(26, 42, 52, 0.9)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '20px',
          fontSize: '14px',
          zIndex: 10,
          maxWidth: '90%',
          textAlign: 'center'
        }}>
          {localLoading ? '載入中...' : 
           error ? error : 
           !agentConfig ? '系統初始化中...' : 
           '請先填寫個人資訊以開始使用'}
        </div>
      )}

      {/* 語言切換按鈕 - 右上角 */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 10
      }}>
        <button
          onClick={() => setClientLanguage(clientLanguage === 'zh' ? 'en' : 'zh')}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 12px',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          {clientLanguage.toUpperCase()}
        </button>
      </div>

      {/* 用戶信息輸入模態（如果需要） */}
      {!isUserInfoValid && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '15px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 20px 0', textAlign: 'center', color: '#333' }}>
              請填寫個人資訊
            </h3>
            <div style={{ marginBottom: '15px' }}>
              <input
                type="email"
                value={userInfo.email}
                onChange={(e) => setUserInfo(prev => ({ ...prev, email: e.target.value }))}
                placeholder="請輸入您的 Email"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                value={userInfo.uname}
                onChange={(e) => setUserInfo(prev => ({ ...prev, uname: e.target.value }))}
                placeholder="請輸入您的用戶名"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 主要聊天區域 */}
      {isUserInfoValid && agentConfig && !localLoading && (
        <>
          {/* 聊天記錄區域 */}
          <div style={{ 
            flex: 1,
            padding: '80px 20px 120px 20px',
            overflow: 'auto'
          }}>
            {messages.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                color: 'rgba(255, 255, 255, 0.7)', 
                marginTop: '40vh',
                fontSize: '16px'
              }}>
                {conversationStarted ? '🎤 開始說話來進行對話...' : '點擊開始按鈕來開始對話'}
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: '15px'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '80%',
                      padding: '12px 16px',
                      borderRadius: '18px',
                      backgroundColor: message.type === 'user' 
                        ? 'rgba(255, 255, 255, 0.9)' 
                        : 'rgba(255, 255, 255, 0.1)',
                      color: message.type === 'user' ? '#333' : 'white',
                      fontSize: '16px',
                      lineHeight: '1.4',
                      opacity: message.isLoading ? 0.7 : 1,
                      border: message.type === 'ai' ? '1px solid rgba(255, 255, 255, 0.2)' : 'none'
                    }}
                  >
                    {message.content}
                    {message.isLoading && (
                      <span style={{ marginLeft: '8px' }}>⏳</span>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 底部控制區域 */}
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(45, 90, 107, 0.95)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
          }}>
            {/* 輸入區域和控制按鈕 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              justifyContent: 'center'
            }}>
              {/* 輸入框（顯示狀態） */}
              <div style={{
                flex: 1,
                maxWidth: '300px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                padding: '12px 16px',
                borderRadius: '25px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                {isCalibrating ? `校準中... ${Math.round(calibrationProgress)}%` :
                 isListening ? '🎤 錄音中...' :
                 isSpeaking ? '🗣️ AI 回應中...' :
                 waitingForVoiceAfterTts ? '等待您的語音...' :
                 conversationStarted ? '等待語音輸入' : '請點擊開始對話'}
              </div>

              {/* 錄音按鈕（綠色方塊） */}
              {conversationStarted && (
                <button
                  onClick={!isListening ? startListening : stopRecording}
                  disabled={isCalibrating || loading}
                  style={{
                    width: '50px',
                    height: '50px',
                    backgroundColor: isListening ? '#ff4444' : '#4CAF50',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isCalibrating || loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px'
                  }}
                >
                  {isListening ? '⏹️' : '🎤'}
                </button>
              )}

              {/* 開始對話按鈕（藍色三角形） */}
              {!conversationStarted && (
                <button
                  onClick={startConversation}
                  disabled={loading || isCalibrating}
                  style={{
                    width: '50px',
                    height: '50px',
                    backgroundColor: '#2196F3',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: loading || isCalibrating ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    color: 'white'
                  }}
                >
                  ▶️
                </button>
              )}
            </div>

            {/* 結束並開始分析按鈕 */}
            {conversationStarted && messages.length > 0 && (
              <button
                onClick={() => {
                  endConversation();
                  setTimeout(generateReport, 500);
                }}
                disabled={generatingReport}
                style={{
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '25px',
                  padding: '12px 30px',
                  fontSize: '16px',
                  cursor: generatingReport ? 'not-allowed' : 'pointer',
                  alignSelf: 'center',
                  fontWeight: 'bold'
                }}
              >
                {generatingReport ? '⏳ 分析中...' : '結束並開始分析'}
              </button>
            )}

            {/* 重新開始按鈕（當對話結束時） */}
            {!conversationStarted && showReportButton && (
              <button
                onClick={startNewConversation}
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '25px',
                  padding: '12px 30px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  alignSelf: 'center',
                  fontWeight: 'bold'
                }}
              >
                � 開始新對話
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ClassChatPage;