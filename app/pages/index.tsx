import React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();

  const navigationCards = [
    {
      title: '簡單語音對話',
      description: '基本的語音識別和對話功能，適合初次使用',
      href: '/simple-speech',
      icon: '🎤',
      color: '#3B82F6',
      darkColor: '#1E40AF'
    },
    {
      title: '模擬下屬對話機器人',
      description: '結合 Agent 配置的智能語音對話',
      href: '/agent-chat',
      icon: '🤖💬',
      color: '#6366F1',
      darkColor: '#4338CA'
    },
    {
      title: 'TTS 語音對話',
      description: '包含文字轉語音功能的完整對話體驗',
      href: '/tts-speech',
      icon: '🔊',
      color: '#10B981',
      darkColor: '#047857'
    },
    // {
    //   title: '語音設定',
    //   description: '錄製語音參考樣本，提升語音合成效果',
    //   href: '/voice-setup',
    //   icon: '⚙️',
    //   color: '#8B5CF6',
    //   darkColor: '#5B21B6'
    // },
    // {
    //   title: '代理配置',
    //   description: '配置 AI 代理的行為和參數',
    //   href: '/agent-config',
    //   icon: '🤖',
    //   color: '#F59E0B',
    //   darkColor: '#D97706'
    // },
    // {
    //   title: '課堂模式',
    //   description: '專為課堂環境設計的語音互動功能',
    //   href: '/class',
    //   icon: '🎓',
    //   color: '#EF4444',
    //   darkColor: '#DC2626'
    // }
  ];

  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    position: 'relative' as const,
    overflow: 'hidden'
  };

  const backgroundDecoStyle = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    opacity: 0.1
  };

  const contentStyle = {
    position: 'relative' as const,
    zIndex: 1,
    padding: '60px 20px',
    maxWidth: '1200px',
    margin: '0 auto'
  };

  const headerStyle = {
    textAlign: 'center' as const,
    marginBottom: '60px'
  };

  const titleStyle = {
    fontSize: '3.5rem',
    fontWeight: 'bold',
    color: 'white',
    marginBottom: '20px',
    textShadow: '0 4px 20px rgba(0,0,0,0.3)'
  };

  const subtitleStyle = {
    fontSize: '1.25rem',
    color: 'rgba(255,255,255,0.9)',
    maxWidth: '600px',
    margin: '0 auto',
    lineHeight: 1.6
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '30px',
    marginBottom: '80px'
  };

  const cardStyle = (color: string, darkColor: string) => ({
    background: `linear-gradient(135deg, ${color} 0%, ${darkColor} 100%)`,
    borderRadius: '20px',
    padding: '30px',
    color: 'white',
    textDecoration: 'none',
    display: 'block',
    transition: 'all 0.3s ease',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
    position: 'relative' as const,
    overflow: 'hidden',
    cursor: 'pointer'
  });

  const cardHoverStyle = {
    transform: 'translateY(-10px)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
  };

  const iconStyle = {
    fontSize: '3rem',
    marginBottom: '15px',
    display: 'block'
  };

  const cardTitleStyle = {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '10px'
  };

  const cardDescStyle = {
    fontSize: '1rem',
    opacity: 0.9,
    lineHeight: 1.5
  };

  const featuresSectionStyle = {
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '20px',
    padding: '50px 30px',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.2)'
  };

  const featuresGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '40px',
    marginTop: '40px'
  };

  const featureStyle = {
    textAlign: 'center' as const,
    color: 'white'
  };

  const featureIconStyle = {
    fontSize: '3rem',
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '50%',
    width: '80px',
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px auto',
    backdropFilter: 'blur(5px)'
  };

  return (
    <div style={containerStyle}>
      {/* 背景裝飾 */}
      <div style={backgroundDecoStyle}>
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '10%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'float 6s ease-in-out infinite'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '20%',
          right: '10%',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'float 8s ease-in-out infinite reverse'
        }}></div>
      </div>

      <div style={contentStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{
            width: '100px',
            height: '100px',
            background: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 30px auto',
            fontSize: '3rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            🎙️
          </div>
          <h1 style={titleStyle}>本地語音 AI 助手</h1>
          <p style={subtitleStyle}>
            選擇您想要使用的功能模式，開始您的智能語音對話體驗
          </p>
        </div>

        {/* Navigation Cards */}
        <div style={gridStyle}>
          {navigationCards.map((card, index) => (
            <Link key={index} href={card.href} style={{ textDecoration: 'none' }}>
              <div 
                style={cardStyle(card.color, card.darkColor)}
                onMouseEnter={(e) => {
                  Object.assign(e.currentTarget.style, cardHoverStyle);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '-50px',
                  right: '-50px',
                  width: '100px',
                  height: '100px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%'
                }}></div>
                <span style={iconStyle}>{card.icon}</span>
                <h3 style={cardTitleStyle}>{card.title}</h3>
                <p style={cardDescStyle}>{card.description}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Features Section */}
        <div style={featuresSectionStyle}>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: 'white',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            主要特色功能
          </h2>
          <div style={featuresGridStyle}>
            {[
              {
                icon: '🎯',
                title: '本地運行',
                description: '完全在本地運行，保護您的隱私和數據安全'
              },
              {
                icon: '⚡',
                title: '即時回應',
                description: '優化的語音識別和合成，提供流暢的對話體驗'
              },
              {
                icon: '🔧',
                title: '高度可配置',
                description: '支持多種配置選項，滿足不同使用場景需求'
              }
            ].map((feature, index) => (
              <div key={index} style={featureStyle}>
                <div style={featureIconStyle}>
                  {feature.icon}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '10px' }}>
                  {feature.title}
                </h3>
                <p style={{ opacity: 0.9, lineHeight: 1.5 }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '60px',
          paddingTop: '30px',
          borderTop: '1px solid rgba(255,255,255,0.2)',
          color: 'rgba(255,255,255,0.8)'
        }}>
          <p style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>✨</span>
            本地語音 AI 助手 - 讓 AI 對話更自然、更私密
            <span style={{ fontSize: '1.2rem' }}>✨</span>
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </div>
  );
}