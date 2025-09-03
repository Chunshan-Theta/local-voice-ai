'use client';

import React from 'react';
import { Language } from '../types';
import TopNotificationBar from './TopNotificationBar';
import LanguageSwitcher from './LanguageSwitcher';

interface TopToolbarProps {
  // 通知欄相關 props
  showNotification: boolean;
  localLoading: boolean;
  error: string | null;
  agentConfig: any;
  notificationMessage?: string;
  
  // 語言切換相關 props
  currentLanguage: Language;
  onLanguageChange: (language: Language) => void;
}

const TopToolbar: React.FC<TopToolbarProps> = ({
  showNotification,
  localLoading,
  error,
  agentConfig,
  notificationMessage,
  currentLanguage,
  onLanguageChange
}) => {
  const navigateToSettings = () => {
    window.location.href = '/agent-config';
  };

  return (
    <>
      {/* 頂部訊息提示區域 */}
      <TopNotificationBar
        isVisible={showNotification}
        localLoading={localLoading}
        error={error}
        agentConfig={agentConfig}
        message={notificationMessage}
      />

      {/* 頂部工具列 */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        zIndex: 1000
      }}>
        {/* 設定按鈕 */}
        <button
          onClick={navigateToSettings}
          style={{
            padding: '8px 16px',
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#495057',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 1)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          🎭 劇本設定
        </button>

        {/* 語言切換按鈕 */}
        <LanguageSwitcher
          currentLanguage={currentLanguage}
          onLanguageChange={onLanguageChange}
        />
      </div>
    </>
  );
};

export default TopToolbar;
