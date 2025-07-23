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
        padding: '80px 20px 120px 20px',
        overflow: 'auto'
      }}
    >
      {messages.length === 0 ? (
        <EmptyState conversationStarted={conversationStarted} />
      ) : (
        messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatRoom;
