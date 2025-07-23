'use client';

import React from 'react';

export type NotificationType = 'loading' | 'error' | 'info' | 'success';

interface TopNotificationBarProps {
  isVisible: boolean;
  localLoading: boolean;
  error: string | null;
  agentConfig: any;
  message?: string;
  type?: NotificationType;
  onClose?: () => void;
}

const TopNotificationBar: React.FC<TopNotificationBarProps> = ({
  isVisible,
  localLoading,
  error,
  agentConfig,
  message,
  type = 'info',
  onClose
}) => {
  if (!isVisible) return null;

  const getDisplayMessage = () => {
    if (message) return message;
    if (localLoading) return '載入中...';
    if (error) return error;
    if (!agentConfig) return '系統初始化中...';
    return '請先填寫個人資訊以開始使用';
  };

  const getBackgroundColor = () => {
    if (error) return 'rgba(244, 67, 54, 0.9)'; // 紅色 - 錯誤
    if (localLoading) return 'rgba(255, 193, 7, 0.9)'; // 黃色 - 載入中
    if (type === 'success') return 'rgba(76, 175, 80, 0.9)'; // 綠色 - 成功
    return 'rgba(26, 42, 52, 0.9)'; // 預設深藍色
  };

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: getBackgroundColor(),
      color: 'white',
      padding: '10px 20px',
      borderRadius: '20px',
      fontSize: '14px',
      zIndex: 10,
      maxWidth: '90%',
      textAlign: 'center',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      animation: 'slideDown 0.3s ease-out'
    }}>
      {/* 載入動畫 */}
      {localLoading && (
        <div style={{
          width: '16px',
          height: '16px',
          border: '2px solid transparent',
          borderTop: '2px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      )}
      
      {/* 訊息文字 */}
      <span>{getDisplayMessage()}</span>
      
      {/* 關閉按鈕 */}
      {onClose && !localLoading && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '0',
            marginLeft: '5px'
          }}
        >
          ×
        </button>
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TopNotificationBar;
