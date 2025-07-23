'use client';

import React, { useRef, useEffect } from 'react';
import { Message } from '../../../lib/replyManager';
import MessageBubble from './MessageBubble';
import EmptyState from './EmptyState';

interface ChatRoomProps {
  messages: Message[];
  conversationStarted: boolean;
  className?: string;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ 
  messages, 
  conversationStarted,
  className 
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自動滾動到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div 
      className={className}
      style={{ 
        flex: 1,
        padding: '80px 20px 180px 20px',
        display: 'flex',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #2c5f5f 0%, #1a4040 50%, #0d2626 100%)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          height: 'calc(100vh - 200px)',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          margin: '0 auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {messages.length === 0 ? (
          <div style={{ 
            flex: 1, 
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <EmptyState conversationStarted={conversationStarted} />
          </div>
        ) : (
          <div style={{ 
            flex: 1, 
            padding: '20px',
            overflow: 'auto'
          }}>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatRoom;
