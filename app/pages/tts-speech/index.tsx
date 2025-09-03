import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import type { ConversationMessage } from '../../lib/ollama';
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

export default function Home() {
  const router = useRouter();
  
  // 簡化的狀態管理 - 移除自動檢測相關狀態
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationStarted, setConversationStarted] = useState(false);
  
  // TTS 相關狀態
  const [ttsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // 音量監控狀態（僅用於顯示）
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  
  // 簡化的 refs 管理 - 移除自動檢測相關的 refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ttsManagerRef = useRef<TtsManager | null>(null);
  const replyManagerRef = useRef<ReplyManager | null>(null);
  const volumeCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 簡化的 refs
  const isListeningRef = useRef(false);
  const conversationStartedRef = useRef(false);
  const recordingStartTimeRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 簡化TTS管理器初始化
  useEffect(() => {
    if (!ttsManagerRef.current) {
      ttsManagerRef.current = createTtsManager(
        {
          enabled: ttsEnabled,
          voice: null,
          rate: 1.5,
          volume: 0.8,
          pitch: 1.0
        },
        {
          onStart: (text, messageId) => {
            console.log('🔇 TTS開始播放');
            if (messageId) {
              setMessages(prev => prev.map(msg => 
                msg.id === messageId ? { ...msg, isPlaying: true } : { ...msg, isPlaying: false }
              ));
            }
          },
          onEnd: (messageId) => {
            console.log('✅ TTS播放完成');
            setMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
          },
          onError: (error, messageId) => {
            console.error('❌ TTS 錯誤:', error.error);
            setMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
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
            
            // 語音轉錄錯誤後不需要特殊處理，用戶可以再次點擊錄音
            setTimeout(() => {
              // 清除錯誤信息
              setError(null);
            }, 3000); // 3秒後清除錯誤
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

  // 初始化音頻流用於音量監控
  useEffect(() => {
    startVolumeMonitoring();
    
    return () => {
      stopVolumeMonitoring();
    };
  }, []);

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

  // 設置音頻分析器用於音量監控
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

  // 開始音量監控（僅用於顯示）
  const startVolumeMonitoring = async () => {
    try {
      let stream = audioStreamRef.current;
      if (!stream || !stream.active) {
        stream = await createAudioStream();
        setupAudioAnalyser(stream);
      }

      if (volumeCheckIntervalRef.current) {
        clearInterval(volumeCheckIntervalRef.current);
      }

      volumeCheckIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setCurrentVolume(average);
      }, 100);
      
    } catch (error) {
      console.error('啟動音量監測失敗:', error);
    }
  };

  const stopVolumeMonitoring = () => {
    if (volumeCheckIntervalRef.current) {
      clearInterval(volumeCheckIntervalRef.current);
      volumeCheckIntervalRef.current = null;
    }
  };

  // 手動控制錄音 - 點擊開始，再次點擊結束
  const toggleRecording = async () => {
    if (isListening) {
      // 結束錄音
      await stopRecording();
    } else {
      // 開始錄音
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      
      // 創建或使用現有音頻流
      let stream = audioStreamRef.current;
      if (!stream || !stream.active) {
        stream = await createAudioStream();
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
      recordingStartTimeRef.current = Date.now();
      
      console.log('🎤 開始錄音');
      
    } catch (err) {
      console.error('錄音錯誤:', err);
      setError('無法訪問麥克風，請檢查權限設置');
    }
  };

  const stopRecording = async () => {
    console.log('⏹️ 停止錄音');
    setIsListening(false);
    isListeningRef.current = false;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const startConversation = () => {
    console.log('✅ 開始對話');
    setConversationStarted(true);
    conversationStartedRef.current = true;
  };

  const endConversation = () => {
    console.log('🛑 結束對話');
    setConversationStarted(false);
    conversationStartedRef.current = false;
    
    if (isListening) {
      stopRecording();
    }
    stopSpeaking();
    setMessages([]);
    setError(null);
  };

  const processAudio = async () => {
    setLoading(true);
    setError(null);

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // 檢查錄音時長
      const recordingDuration = Date.now() - recordingStartTimeRef.current;
      console.log(`🎤 錄音時長: ${recordingDuration}ms`);
      
      // 最小錄音時長檢查
      if (recordingDuration < 500) {
        console.log(`⚠️ 錄音時間過短 (<500ms)，請說話時間長一點`);
        setError('錄音時間過短，請說話時間長一點');
        setLoading(false);
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
    }
  };

  const getVolumeBarColor = () => {
    if (isListening) return '#28a745'; // 綠色 - 錄音中
    if (isSpeaking) return '#9c27b0'; // 紫色 - TTS 播放中
    return '#6c757d'; // 灰色 - 待機
  };

  const getVolumePercentage = () => {
    const maxDisplayVolume = 100;
    return Math.min((currentVolume / maxDisplayVolume) * 100, 100);
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
      {/* 導航按鈕 */}
      <div style={{ 
        marginBottom: '1rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <button
          onClick={() => router.push('/voice-setup')}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'none',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          ⚙️ 語音設定
        </button>
      </div>
      
      <h1>手動語音 AI 助手 🎤</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        點擊式語音對話模式。點擊開始錄音，再次點擊結束錄音，AI 將自動進行語音轉錄、回覆生成和語音播放。
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
        <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
          {isListening && (
            <span style={{ color: '#28a745' }}>🎤 錄音中</span>
          )}
          {isSpeaking && !isListening && (
            <span style={{ color: '#9c27b0' }}>🗣️ TTS生成中</span>
          )}
          {!isSpeaking && !isListening && conversationStarted && (
            <span style={{ color: '#007bff' }}>🔊 等待錄音</span>
          )}
          {!conversationStarted && (
            <span style={{ color: '#6c757d' }}>📊 音量監測中</span>
          )}
        </div>
      </div>

      {/* 控制按鈕 */}
      <div style={{ marginBottom: '1rem' }}>
        {!conversationStarted ? (
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
            🎙️ 開始對話
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            
            {/* 錄音控制按鈕 */}
            <button
              onClick={toggleRecording}
              disabled={loading || isSpeaking}
              style={{
                padding: '1rem 1.5rem',
                fontSize: '1.2rem',
                backgroundColor: loading || isSpeaking ? '#6c757d' : isListening ? '#dc3545' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading || isSpeaking ? 'not-allowed' : 'pointer',
                minWidth: '160px'
              }}
            >
              {loading ? '⏳ 處理中...' : isListening ? '⏹️ 停止錄音' : '🎤 開始錄音'}
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
            backgroundColor: '#d4edda', 
            borderRadius: '4px',
            fontSize: '0.9rem',
            color: '#155724'
          }}>
            🎤 錄音中 - 點擊「停止錄音」按鈕結束錄音並發送...
          </div>
        )}

        {conversationStarted && !isListening && !loading && !isSpeaking && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.5rem', 
            backgroundColor: '#d1ecf1', 
            borderRadius: '4px',
            fontSize: '0.9rem',
            color: '#0c5460'
          }}>
            💬 點擊「開始錄音」按鈕來錄製您的語音消息
          </div>
        )}

        {isSpeaking && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.5rem', 
            backgroundColor: '#e2e3e5', 
            borderRadius: '4px',
            fontSize: '0.9rem',
            color: '#383d41'
          }}>
            🗣️ AI 正在回覆中，請等待播放完成後再錄音...
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: (error.includes('未識別到有效語音') || error.includes('錄音時間過短')) ? '#fff3cd' : '#f8d7da',
          color: (error.includes('未識別到有效語音') || error.includes('錄音時間過短')) ? '#856404' : '#721c24',
          borderRadius: '4px',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {error.includes('未識別到有效語音') ? (
            <>
              🎤 {error}，請重新錄音...
              <span style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: 'auto' }}>
                (3秒後自動清除)
              </span>
            </>
          ) : error.includes('錄音時間過短') ? (
            <>
              ⏱️ {error}
              <span style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: 'auto' }}>
                (3秒後自動清除)
              </span>
            </>
          ) : (
            <>錯誤：{error}</>
          )}
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
            🎤 點擊「開始錄音」按鈕來進行對話...
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