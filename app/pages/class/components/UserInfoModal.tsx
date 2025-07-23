'use client';

import React, { useState } from 'react';

export interface UserInfo {
  email: string;
  uname: string;
}

interface UserInfoModalProps {
  isVisible: boolean;
  onSubmit: (userInfo: UserInfo) => void;
}

const UserInfoModal: React.FC<UserInfoModalProps> = ({ isVisible, onSubmit }) => {
  const [userInfo, setUserInfo] = useState<UserInfo>({ email: '', uname: '' });

  const handleSubmit = () => {
    if (userInfo.email.trim() && userInfo.uname.trim()) {
      onSubmit(userInfo);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userInfo.email.trim() && userInfo.uname.trim()) {
      handleSubmit();
    }
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    }}>
      <div style={{
        backgroundColor: '#2F4F4F',
        padding: '40px',
        borderRadius: '12px',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <h3 style={{ 
          margin: '0 0 30px 0', 
          textAlign: 'center', 
          color: 'white',
          fontSize: '18px',
          fontWeight: '400'
        }}>
          請輸入您的資訊
        </h3>
        
        <div style={{ marginBottom: '20px' }}>
          <input
            type="email"
            value={userInfo.email}
            onChange={(e) => setUserInfo(prev => ({ ...prev, email: e.target.value }))}
            onKeyPress={handleKeyPress}
            placeholder="電子郵件"
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: '#1C3A3A',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              color: 'white',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '30px' }}>
          <input
            type="text"
            value={userInfo.uname}
            onChange={(e) => setUserInfo(prev => ({ ...prev, uname: e.target.value }))}
            onKeyPress={handleKeyPress}
            placeholder="姓名"
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: '#1C3A3A',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              color: 'white',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={!userInfo.email.trim() || !userInfo.uname.trim()}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: userInfo.email.trim() && userInfo.uname.trim() ? '#5CBAA4' : '#6B8E9A',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            color: 'white',
            cursor: userInfo.email.trim() && userInfo.uname.trim() ? 'pointer' : 'not-allowed',
            fontWeight: '500',
            transition: 'background-color 0.2s ease'
          }}
        >
          開始
        </button>

        {/* CSS Styles */}
        <style jsx>{`
          input::placeholder {
            color: rgba(255, 255, 255, 0.6) !important;
          }
          
          input:focus {
            background-color: #2A4A4A !important;
            box-shadow: 0 0 0 2px rgba(92, 186, 164, 0.3) !important;
          }
        `}</style>
      </div>
    </div>
  );
};

export default UserInfoModal;
