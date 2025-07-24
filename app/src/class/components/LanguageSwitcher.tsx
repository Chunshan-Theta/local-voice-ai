'use client';

import React, { useState } from 'react';
import { Language } from '../utils/agentFactory';

export interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
}

interface LanguageSwitcherProps {
  currentLanguage: Language;
  onLanguageChange: (language: Language) => void;
  className?: string;
  disabled?: boolean;
  compact?: boolean;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇳' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' }
];

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  currentLanguage,
  onLanguageChange,
  className,
  disabled = false,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const currentOption = LANGUAGE_OPTIONS.find(option => option.code === currentLanguage) 
    || { code: currentLanguage, name: currentLanguage.toUpperCase(), nativeName: currentLanguage.toUpperCase(), flag: '🌐' };

  const handleLanguageSelect = (language: Language) => {
    onLanguageChange(language);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  // 簡單模式 - 只在兩種語言間切換
  if (compact) {
    const handleSimpleToggle = () => {
      const newLanguage: Language = currentLanguage === 'zh' ? 'en' : 'zh';
      onLanguageChange(newLanguage);
    };

    return (
      <div 
        className={className}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 10
        }}
      >
        <button
          onClick={handleSimpleToggle}
          disabled={disabled}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 12px',
            fontSize: '14px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            transition: 'background-color 0.2s ease',
            opacity: disabled ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            }
          }}
        >
          <span>{currentOption.flag}</span>
          <span>{currentLanguage.toUpperCase()}</span>
        </button>
      </div>
    );
  }

  // 完整下拉選單模式
  return (
    <div 
      className={className}
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 10
      }}
    >
      <div style={{
        position: 'relative',
        display: 'inline-block'
      }}>
        <button
          onClick={toggleDropdown}
          disabled={disabled}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: '20px',
            color: 'white',
            padding: '8px 12px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: disabled ? 0.5 : 1,
            transition: 'all 0.2s ease',
            fontWeight: 'bold'
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }
          }}
        >
          <span>{currentOption.flag}</span>
          <span>{currentOption.nativeName}</span>
          <span style={{ 
            fontSize: '10px', 
            transition: 'transform 0.2s ease', 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' 
          }}>▼</span>
        </button>

        {isOpen && (
          <>
            {/* 背景遮罩 */}
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 999
              }}
              onClick={() => setIsOpen(false)}
            />
            
            <div style={{
              position: 'absolute',
              top: '100%',
              right: '0',
              marginTop: '5px',
              background: 'white',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
              zIndex: 1000,
              minWidth: '200px',
              maxHeight: '300px',
              overflowY: 'auto',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div style={{
                padding: '8px 12px',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                fontSize: '11px',
                color: '#666',
                fontWeight: '600'
              }}>
                選擇語言
              </div>
              
              {LANGUAGE_OPTIONS.map((option) => (
                <button
                  key={option.code}
                  onClick={() => handleLanguageSelect(option.code)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: 'none',
                    background: option.code === currentLanguage ? 'rgba(26, 42, 52, 0.1)' : 'transparent',
                    color: '#333',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (option.code !== currentLanguage) {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (option.code !== currentLanguage) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{option.flag}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontWeight: option.code === currentLanguage ? '600' : '500',
                      fontSize: '13px'
                    }}>
                      {option.nativeName}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>{option.name}</div>
                  </div>
                  {option.code === currentLanguage && (
                    <span style={{ color: '#4CAF50', fontSize: '14px' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        <style jsx>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default LanguageSwitcher;
