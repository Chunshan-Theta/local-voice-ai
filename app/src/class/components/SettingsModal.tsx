'use client';

import React, { useState } from 'react';
import { Language } from '../utils/agentFactory';

export interface AppSettings {
  language: Language;
  volume: number;
  noiseReduction: boolean;
  autoSend: boolean;
  theme: 'light' | 'dark' | 'auto';
  voiceActivation: boolean;
  showAdvancedControls: boolean;
  notifications: {
    sound: boolean;
    desktop: boolean;
    vibration: boolean;
  };
  recording: {
    quality: 'low' | 'medium' | 'high';
    format: 'webm' | 'mp3' | 'wav';
    autoStop: number; // seconds
  };
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

const defaultSettings: AppSettings = {
  language: 'zh',
  volume: 50,
  noiseReduction: true,
  autoSend: false,
  theme: 'auto',
  voiceActivation: false,
  showAdvancedControls: false,
  notifications: {
    sound: true,
    desktop: false,
    vibration: false
  },
  recording: {
    quality: 'medium',
    format: 'webm',
    autoStop: 60
  }
};

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState<'general' | 'audio' | 'advanced'>('general');

  if (!isOpen) return null;

  const handleSettingChange = (path: string, value: any) => {
    const newSettings = { ...localSettings };
    const keys = path.split('.');
    let current: any = newSettings;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    setLocalSettings(newSettings);
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(defaultSettings);
  };

  const TabButton = ({ tab, label }: { tab: typeof activeTab, label: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      style={{
        padding: '8px 16px',
        border: 'none',
        background: activeTab === tab ? '#4CAF50' : 'transparent',
        color: activeTab === tab ? 'white' : '#666',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      {label}
    </button>
  );

  const SettingRow = ({ 
    label, 
    description, 
    children 
  }: { 
    label: string, 
    description?: string, 
    children: React.ReactNode 
  }) => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
          {label}
        </div>
        {description && (
          <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
            {description}
          </div>
        )}
      </div>
      <div style={{ marginLeft: '16px' }}>
        {children}
      </div>
    </div>
  );

  return (
    <>
      {/* 背景遮罩 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          animation: 'fadeIn 0.3s ease-out'
        }}
        onClick={onClose}
      />

      {/* 設定視窗 */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          borderRadius: '16px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'hidden',
          zIndex: 1001,
          animation: 'slideIn 0.3s ease-out',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題列 */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '600',
            color: '#333'
          }}>
            應用程式設定
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        {/* 標籤頁 */}
        <div style={{
          padding: '16px 24px 0',
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
        }}>
          <TabButton tab="general" label="一般設定" />
          <TabButton tab="audio" label="語音設定" />
          <TabButton tab="advanced" label="進階設定" />
        </div>

        {/* 設定內容 */}
        <div style={{
          padding: '20px 24px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {activeTab === 'general' && (
            <div>
              <SettingRow 
                label="介面語言" 
                description="選擇應用程式的顯示語言"
              >
                <select
                  value={localSettings.language}
                  onChange={(e) => handleSettingChange('language', e.target.value as Language)}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </SettingRow>

              <SettingRow 
                label="主題模式" 
                description="選擇應用程式的外觀主題"
              >
                <select
                  value={localSettings.theme}
                  onChange={(e) => handleSettingChange('theme', e.target.value)}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="light">淺色模式</option>
                  <option value="dark">深色模式</option>
                  <option value="auto">跟隨系統</option>
                </select>
              </SettingRow>

              <SettingRow 
                label="自動發送" 
                description="錄音結束後自動發送訊息"
              >
                <input
                  type="checkbox"
                  checked={localSettings.autoSend}
                  onChange={(e) => handleSettingChange('autoSend', e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </SettingRow>

              <SettingRow 
                label="聲音通知" 
                description="播放通知音效"
              >
                <input
                  type="checkbox"
                  checked={localSettings.notifications.sound}
                  onChange={(e) => handleSettingChange('notifications.sound', e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </SettingRow>

              <SettingRow 
                label="桌面通知" 
                description="顯示桌面彈出通知"
              >
                <input
                  type="checkbox"
                  checked={localSettings.notifications.desktop}
                  onChange={(e) => handleSettingChange('notifications.desktop', e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </SettingRow>
            </div>
          )}

          {activeTab === 'audio' && (
            <div>
              <SettingRow 
                label="音量" 
                description="調整播放音量"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={localSettings.volume}
                    onChange={(e) => handleSettingChange('volume', parseInt(e.target.value))}
                    style={{ width: '100px' }}
                  />
                  <span style={{ fontSize: '12px', minWidth: '35px' }}>
                    {localSettings.volume}%
                  </span>
                </div>
              </SettingRow>

              <SettingRow 
                label="噪音抑制" 
                description="自動降低背景噪音"
              >
                <input
                  type="checkbox"
                  checked={localSettings.noiseReduction}
                  onChange={(e) => handleSettingChange('noiseReduction', e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </SettingRow>

              <SettingRow 
                label="語音激活" 
                description="偵測到語音時自動開始錄音"
              >
                <input
                  type="checkbox"
                  checked={localSettings.voiceActivation}
                  onChange={(e) => handleSettingChange('voiceActivation', e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </SettingRow>

              <SettingRow 
                label="錄音品質" 
                description="選擇錄音的音質等級"
              >
                <select
                  value={localSettings.recording.quality}
                  onChange={(e) => handleSettingChange('recording.quality', e.target.value)}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="low">低品質</option>
                  <option value="medium">中品質</option>
                  <option value="high">高品質</option>
                </select>
              </SettingRow>

              <SettingRow 
                label="自動停止錄音" 
                description="錄音超過指定時間後自動停止"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="range"
                    min="10"
                    max="300"
                    step="10"
                    value={localSettings.recording.autoStop}
                    onChange={(e) => handleSettingChange('recording.autoStop', parseInt(e.target.value))}
                    style={{ width: '100px' }}
                  />
                  <span style={{ fontSize: '12px', minWidth: '40px' }}>
                    {localSettings.recording.autoStop}秒
                  </span>
                </div>
              </SettingRow>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div>
              <SettingRow 
                label="顯示進階控制" 
                description="在介面上顯示更多控制選項"
              >
                <input
                  type="checkbox"
                  checked={localSettings.showAdvancedControls}
                  onChange={(e) => handleSettingChange('showAdvancedControls', e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </SettingRow>

              <SettingRow 
                label="錄音格式" 
                description="選擇錄音檔案的儲存格式"
              >
                <select
                  value={localSettings.recording.format}
                  onChange={(e) => handleSettingChange('recording.format', e.target.value)}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="webm">WebM (推薦)</option>
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV</option>
                </select>
              </SettingRow>

              <SettingRow 
                label="震動回饋" 
                description="在支援的裝置上啟用震動回饋"
              >
                <input
                  type="checkbox"
                  checked={localSettings.notifications.vibration}
                  onChange={(e) => handleSettingChange('notifications.vibration', e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </SettingRow>

              <div style={{ 
                padding: '16px 0', 
                borderTop: '1px solid rgba(0, 0, 0, 0.1)',
                marginTop: '16px'
              }}>
                <button
                  onClick={handleReset}
                  style={{
                    background: 'rgba(244, 67, 54, 0.1)',
                    border: '1px solid rgba(244, 67, 54, 0.3)',
                    borderRadius: '8px',
                    color: '#d32f2f',
                    padding: '8px 16px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(244, 67, 54, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(244, 67, 54, 0.1)';
                  }}
                >
                  🔄 重置為預設設定
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 底部按鈕 */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(0, 0, 0, 0.1)',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              background: 'white',
              color: '#666',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              background: '#4CAF50',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#45a049';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#4CAF50';
            }}
          >
            儲存設定
          </button>
        </div>

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translate(-50%, -60%);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%);
            }
          }
        `}</style>
      </div>
    </>
  );
};

export default SettingsModal;
