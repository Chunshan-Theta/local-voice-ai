'use client';

import React from 'react';
import { Language } from '../utils/agentFactory';
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

      {/* 語言切換按鈕 */}
      <LanguageSwitcher
        currentLanguage={currentLanguage}
        onLanguageChange={onLanguageChange}
      />
    </>
  );
};

export default TopToolbar;
