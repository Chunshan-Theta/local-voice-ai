'use client';

import React from 'react';
import { Message } from '../../../lib/replyManager';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  return (
    <div
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
  );
};

export default MessageBubble;
