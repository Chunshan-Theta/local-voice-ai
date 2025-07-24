'use client';

import React from 'react';

interface EmptyStateProps {
  conversationStarted: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({ conversationStarted }) => {
  return (
    <div style={{ 
      textAlign: 'center', 
      color: 'rgba(255, 255, 255, 0.7)', 
      marginTop: '40vh',
      fontSize: '16px'
    }}>
      {conversationStarted ? '🎤 開始說話來進行對話...' : '點擊開始按鈕來開始對話'}
    </div>
  );
};

export default EmptyState;
