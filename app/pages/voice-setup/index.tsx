import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

const REFERENCE_TEXT = "你好，歡迎使用本地語音助手。請以自然的語調清楚地朗讀這段內容，系統將會學習您的聲音。";

export default function VoiceSetup() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const volumeCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // 清理資源
  useEffect(() => {
    return () => {
      stopRecording();
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // 創建音頻流和分析器
  const setupAudio = async () => {
    try {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
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

      // 設置音頻分析器
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

      return stream;
    } catch (err) {
      console.error('音頻設置錯誤:', err);
      setError('無法訪問麥克風，請檢查權限設置');
      throw err;
    }
  };

  // 開始音量監測
  const startVolumeMonitoring = () => {
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
  };

  // 停止音量監測
  const stopVolumeMonitoring = () => {
    if (volumeCheckIntervalRef.current) {
      clearInterval(volumeCheckIntervalRef.current);
      volumeCheckIntervalRef.current = null;
    }
    setCurrentVolume(0);
  };

  // 開始錄音
  const startRecording = async () => {
    try {
      setError(null);
      setSuccess(null);
      audioChunksRef.current = [];

      const stream = await setupAudio();
      
      // 嘗試使用 MP3 格式，如果不支持則使用 WebM
      let mimeType = 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported('audio/mpeg')) {
        mimeType = 'audio/mpeg';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
      
      console.log('🎵 使用錄音格式:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          // 使用錄音時選擇的 MIME 類型
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
          setHasRecording(true);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      recordingStartTimeRef.current = Date.now();

      // 開始錄音計時
      recordingTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
        setRecordingDuration(elapsed);
      }, 100);

      startVolumeMonitoring();

    } catch (err) {
      console.error('錄音錯誤:', err);
      setError('錄音失敗，請重試');
    }
  };

  // 停止錄音
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setIsRecording(false);
    stopVolumeMonitoring();
  };

  // 重新錄音
  const resetRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setHasRecording(false);
    setRecordingDuration(0);
    setError(null);
    setSuccess(null);
  };

  // 上傳音檔
  const uploadAudio = async () => {
    if (!audioUrl || !hasRecording) {
      setError('請先錄製音檔');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      // 獲取音檔 blob
      const response = await fetch(audioUrl);
      const audioBlob = await response.blob();

      // 檢查音頻格式，優先發送 MP3 兼容格式
      let finalBlob = audioBlob;
      let filename = 'reference_audio.mp3'; // 統一使用 MP3 文件名
      
      // 對於非 MP3 格式，創建一個新的 Blob 設置正確的 MIME 類型
      if (!audioBlob.type.includes('mpeg')) {
        console.log('🔄 設置音頻格式為 MP3 兼容格式...');
        // 創建一個設置為 MP3 MIME 類型的新 Blob
        finalBlob = new Blob([audioBlob], { type: 'audio/mpeg' });
      }

      // 創建表單數據
      const formData = new FormData();
      formData.append('audio_file', finalBlob, filename);
      formData.append('text_input', REFERENCE_TEXT);

      console.log('📤 上傳音頻格式:', audioBlob.type);
      console.log('📤 文件名:', filename);

      // 使用內部 API 代理
      const uploadResponse = await fetch('/api/voice-reference', {
        method: 'POST',
        body: formData,
      });

      const result = await uploadResponse.json();

      if (result.success) {
        setSuccess('聲音設定成功！您現在可以開始對話了。');
        // 3秒後自動跳轉到主頁面
        setTimeout(() => {
          router.push('/tts-speech');
        }, 3000);
      } else {
        setError(result.message || '上傳失敗');
      }

    } catch (err) {
      console.error('上傳錯誤:', err);
      setError('上傳失敗，請檢查網絡連接或稍後重試');
    } finally {
      setIsUploading(false);
    }
  };

  // 獲取音量條顏色
  const getVolumeBarColor = () => {
    if (currentVolume < 20) return '#dc3545'; // 紅色 - 太安靜
    if (currentVolume < 40) return '#ffc107'; // 黃色 - 適中
    return '#28a745'; // 綠色 - 良好
  };

  // 獲取錄音狀態提示
  const getRecordingStatusText = () => {
    if (!isRecording) return '';
    
    if (recordingDuration < 5) {
      return `錄音中... ${recordingDuration.toFixed(1)}秒 (至少需要5秒)`;
    } else if (recordingDuration <= 10) {
      return `錄音中... ${recordingDuration.toFixed(1)}秒 (建議錄音時間)`;
    } else {
      return `錄音中... ${recordingDuration.toFixed(1)}秒 (已超過建議時間，建議停止)`;
    }
  };

  // 獲取錄音狀態顏色
  const getRecordingStatusColor = () => {
    if (!isRecording) return '#666';
    if (recordingDuration < 5) return '#dc3545';
    if (recordingDuration <= 10) return '#28a745';
    return '#ffc107';
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
      {/* 導航欄 */}
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ 
          color: '#007bff', 
          textDecoration: 'none',
          fontSize: '0.9rem'
        }}>
          ← 返回主頁
        </Link>
      </div>

      <h1>🎙️ 聲音設定</h1>
      <p style={{ color: '#666', marginBottom: '2rem', lineHeight: '1.6' }}>
        為了提供更個人化的語音體驗，請錄製一段5-10秒的語音樣本。
        系統將學習您的聲音特徵，讓AI回應更貼近您的聲音。
      </p>

      {/* 朗讀文字 */}
      <div style={{ 
        marginBottom: '2rem', 
        padding: '1.5rem', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px',
        border: '2px solid #dee2e6'
      }}>
        <h3 style={{ marginBottom: '1rem', color: '#333' }}>📖 請朗讀以下文字：</h3>
        <div style={{ 
          fontSize: '1.1rem', 
          lineHeight: '1.8', 
          color: '#333',
          padding: '1rem',
          backgroundColor: 'white',
          borderRadius: '6px',
          border: '1px solid #dee2e6'
        }}>
          {REFERENCE_TEXT}
        </div>
        <div style={{ 
          marginTop: '1rem', 
          fontSize: '0.9rem', 
          color: '#666' 
        }}>
          💡 提示：請以自然、清楚的語調朗讀，避免背景噪音，從`你好`唸到`系統將會學習您的聲音特徵。`，必須完整唸完。
        </div>
      </div>

      {/* 音量監控 */}
      {(isRecording || currentVolume > 0) && (
        <div style={{ 
          marginBottom: '2rem', 
          padding: '1rem', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '8px' 
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '0.5rem' 
          }}>
            <span style={{ fontSize: '0.9rem', color: '#666' }}>音量監控</span>
            <span style={{ fontSize: '0.8rem', color: '#666' }}>
              {currentVolume.toFixed(1)}
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
              width: `${Math.min((currentVolume / 100) * 100, 100)}%`,
              height: '100%',
              backgroundColor: getVolumeBarColor(),
              transition: 'all 0.1s ease'
            }} />
          </div>
        </div>
      )}

      {/* 錄音控制 */}
      <div style={{ marginBottom: '2rem' }}>
        {!hasRecording ? (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isUploading}
              style={{
                padding: '1.5rem 3rem',
                fontSize: '1.3rem',
                backgroundColor: isRecording ? '#dc3545' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
              }}
            >
              {isRecording ? '⏹️ 停止錄音' : '🎤 開始錄音'}
            </button>
            
            {isRecording && (
              <div style={{ 
                marginTop: '1rem',
                fontSize: '1rem',
                color: getRecordingStatusColor(),
                fontWeight: 'bold'
              }}>
                {getRecordingStatusText()}
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            {/* 播放錄音 */}
            {audioUrl && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem', color: '#333' }}>🎵 預覽錄音：</h4>
                <audio controls style={{ width: '100%', maxWidth: '400px' }}>
                  <source src={audioUrl} type="audio/webm" />
                  您的瀏覽器不支持音頻播放
                </audio>
                <div style={{ 
                  marginTop: '0.5rem', 
                  fontSize: '0.9rem', 
                  color: '#666' 
                }}>
                  錄音時長: {recordingDuration.toFixed(1)} 秒
                </div>
              </div>
            )}

            {/* 操作按鈕 */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={resetRecording}
                disabled={isUploading}
                style={{
                  padding: '1rem 2rem',
                  fontSize: '1rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                }}
              >
                🔄 重新錄音
              </button>
              
              <button
                onClick={uploadAudio}
                disabled={isUploading}
                style={{
                  padding: '1rem 2rem',
                  fontSize: '1rem',
                  backgroundColor: isUploading ? '#6c757d' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                }}
              >
                {isUploading ? '⏳ 上傳中...' : '📤 確認並上傳'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 錯誤/成功消息 */}
      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          marginBottom: '1rem',
          border: '1px solid #f5c6cb'
        }}>
          ❌ {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#d4edda',
          color: '#155724',
          borderRadius: '4px',
          marginBottom: '1rem',
          border: '1px solid #c3e6cb'
        }}>
          ✅ {success}
          <div style={{ 
            marginTop: '0.5rem', 
            fontSize: '0.9rem', 
            opacity: 0.8 
          }}>
            3秒後自動跳轉到主頁面...
          </div>
        </div>
      )}

      {/* 使用說明 */}
      <div style={{ 
        marginTop: 'auto',
        padding: '1.5rem', 
        backgroundColor: '#e7f3ff', 
        borderRadius: '8px',
        border: '1px solid #b8daff'
      }}>
        <h4 style={{ marginBottom: '1rem', color: '#004085' }}>📋 使用說明：</h4>
        <ul style={{ 
          margin: 0, 
          paddingLeft: '1.5rem', 
          color: '#004085',
          lineHeight: '1.6'
        }}>
          <li>錄音時長建議為 5-10 秒</li>
          <li>請在安靜的環境中錄音</li>
          <li>以自然、清楚的語調朗讀</li>
          <li>避免背景噪音和回音</li>
          <li>設定完成後，AI將使用您的聲音特徵生成回應</li>
        </ul>
      </div>
    </div>
  );
}
