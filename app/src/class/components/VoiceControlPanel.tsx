'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface VoiceControlProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  disabled?: boolean;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  showAdvancedControls?: boolean;
}

export interface NoiseSettings {
  enabled: boolean;
  sensitivity: number;
  threshold: number;
}

const VoiceControlPanel: React.FC<VoiceControlProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  disabled = false,
  volume = 50,
  onVolumeChange,
  showAdvancedControls = false
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [noiseSettings, setNoiseSettings] = useState<NoiseSettings>({
    enabled: true,
    sensitivity: 70,
    threshold: 30
  });
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingTime(0);
    }

    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRecordingToggle = () => {
    if (disabled) return;
    
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    onVolumeChange?.(newVolume);
  };

  const handleNoiseSettingChange = (key: keyof NoiseSettings, value: boolean | number) => {
    setNoiseSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      borderRadius: '20px',
      padding: '15px 20px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    }}>
      {/* 錄音按鈕 */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={handleRecordingToggle}
          disabled={disabled}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: 'none',
            background: isRecording 
              ? 'linear-gradient(135deg, #ff4444, #cc0000)' 
              : 'linear-gradient(135deg, #4CAF50, #45a049)',
            color: 'white',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            opacity: disabled ? 0.5 : 1,
            boxShadow: isRecording 
              ? '0 0 0 4px rgba(255, 68, 68, 0.3)' 
              : '0 4px 12px rgba(76, 175, 80, 0.3)',
            animation: isRecording ? 'pulse 2s infinite' : 'none'
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        >
          {isRecording ? '⏹' : '🎤'}
        </button>

        {/* 錄音時間顯示 */}
        {isRecording && (
          <div style={{
            position: 'absolute',
            top: '-35px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 68, 68, 0.9)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
          }}>
            {formatTime(recordingTime)}
          </div>
        )}
      </div>

      {/* 音量控制 */}
      {onVolumeChange && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: '120px'
        }}>
          <span style={{ fontSize: '18px' }}>🔊</span>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            disabled={disabled}
            style={{
              width: '80px',
              height: '4px',
              borderRadius: '2px',
              background: `linear-gradient(to right, #4CAF50 0%, #4CAF50 ${volume}%, #ddd ${volume}%, #ddd 100%)`,
              outline: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1
            }}
          />
          <span style={{ 
            fontSize: '12px', 
            color: '#666', 
            minWidth: '35px',
            textAlign: 'right'
          }}>
            {volume}%
          </span>
        </div>
      )}

      {/* 高級設定按鈕 */}
      {showAdvancedControls && (
        <button
          onClick={() => setShowSettings(!showSettings)}
          disabled={disabled}
          style={{
            background: showSettings ? 'rgba(76, 175, 80, 0.2)' : 'rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '8px',
            padding: '8px 12px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            color: '#333',
            transition: 'all 0.2s ease',
            opacity: disabled ? 0.5 : 1
          }}
        >
          ⚙️ 設定
        </button>
      )}

      {/* 狀態指示器 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: isRecording 
            ? '#ff4444' 
            : disabled 
              ? '#999' 
              : '#4CAF50',
          animation: isRecording ? 'blink 1s infinite' : 'none'
        }} />
        <span style={{
          fontSize: '12px',
          color: '#666',
          fontWeight: '500'
        }}>
          {isRecording ? '錄音中' : disabled ? '已停用' : '待命'}
        </span>
      </div>

      {/* 高級設定面板 */}
      {showSettings && showAdvancedControls && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '0',
          right: '0',
          marginBottom: '10px',
          background: 'white',
          borderRadius: '12px',
          padding: '15px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(0, 0, 0, 0.1)'
        }}>
          <h4 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '14px', 
            color: '#333',
            fontWeight: '600'
          }}>
            語音設定
          </h4>

          {/* 噪音抑制 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: '#555',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={noiseSettings.enabled}
                onChange={(e) => handleNoiseSettingChange('enabled', e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              啟用噪音抑制
            </label>
          </div>

          {/* 靈敏度設定 */}
          {noiseSettings.enabled && (
            <>
              <div style={{ marginBottom: '8px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '4px'
                }}>
                  靈敏度: {noiseSettings.sensitivity}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={noiseSettings.sensitivity}
                  onChange={(e) => handleNoiseSettingChange('sensitivity', parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    height: '3px',
                    borderRadius: '2px',
                    background: `linear-gradient(to right, #4CAF50 0%, #4CAF50 ${noiseSettings.sensitivity}%, #ddd ${noiseSettings.sensitivity}%, #ddd 100%)`,
                    cursor: 'pointer'
                  }}
                />
              </div>

              <div style={{ marginBottom: '8px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '4px'
                }}>
                  門檻值: {noiseSettings.threshold}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={noiseSettings.threshold}
                  onChange={(e) => handleNoiseSettingChange('threshold', parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    height: '3px',
                    borderRadius: '2px',
                    background: `linear-gradient(to right, #FF9800 0%, #FF9800 ${noiseSettings.threshold}%, #ddd ${noiseSettings.threshold}%, #ddd 100%)`,
                    cursor: 'pointer'
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(255, 68, 68, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(255, 68, 68, 0);
          }
        }
        
        @keyframes blink {
          0%, 50% {
            opacity: 1;
          }
          51%, 100% {
            opacity: 0.3;
          }
        }
        
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          border: 2px solid #4CAF50;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          border: 2px solid #4CAF50;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
};

export default VoiceControlPanel;
