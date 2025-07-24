'use client';

import React, { useState, useEffect } from 'react';

export type SystemStatus = 'initializing' | 'ready' | 'recording' | 'processing' | 'error' | 'offline';

export interface SystemState {
  status: SystemStatus;
  isOnline: boolean;
  batteryLevel?: number;
  signalStrength: number;
  lastActivity: Date | null;
  errorMessage?: string;
}

interface SystemStatusIndicatorProps {
  systemState: SystemState;
  onRefresh?: () => void;
  showDetails?: boolean;
  compact?: boolean;
}

const SystemStatusIndicator: React.FC<SystemStatusIndicatorProps> = ({
  systemState,
  onRefresh,
  showDetails = false,
  compact = false
}) => {
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const getStatusInfo = (status: SystemStatus) => {
    switch (status) {
      case 'initializing':
        return { color: '#FF9800', icon: '⚡', text: '初始化中' };
      case 'ready':
        return { color: '#4CAF50', icon: '✓', text: '就緒' };
      case 'recording':
        return { color: '#2196F3', icon: '🎤', text: '錄音中' };
      case 'processing':
        return { color: '#9C27B0', icon: '⚙️', text: '處理中' };
      case 'error':
        return { color: '#F44336', icon: '⚠️', text: '錯誤' };
      case 'offline':
        return { color: '#757575', icon: '📡', text: '離線' };
      default:
        return { color: '#757575', icon: '?', text: '未知' };
    }
  };

  const getSignalBars = (strength: number) => {
    const bars = [];
    for (let i = 0; i < 4; i++) {
      bars.push(
        <div
          key={i}
          style={{
            width: '3px',
            height: `${4 + i * 2}px`,
            background: i < Math.floor(strength / 25) ? '#4CAF50' : 'rgba(0, 0, 0, 0.2)',
            borderRadius: '1px',
            transition: 'background-color 0.3s ease'
          }}
        />
      );
    }
    return bars;
  };

  const getBatteryColor = (level: number) => {
    if (level > 50) return '#4CAF50';
    if (level > 20) return '#FF9800';
    return '#F44336';
  };

  const statusInfo = getStatusInfo(systemState.status);

  if (compact) {
    return (
      <div
        style={{
          position: 'fixed',
          top: '60px',
          right: '20px',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          padding: '6px 10px',
          borderRadius: '12px',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          cursor: showDetails ? 'pointer' : 'default'
        }}
        onClick={() => showDetails && setShowDetailPanel(!showDetailPanel)}
      >
        {/* 狀態指示器 */}
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: statusInfo.color,
            animation: systemState.status === 'recording' || systemState.status === 'processing' ? 'pulse 2s infinite' : 'none'
          }}
        />

        {/* 信號強度 */}
        <div style={{
          display: 'flex',
          alignItems: 'end',
          gap: '1px',
          height: '12px'
        }}>
          {getSignalBars(systemState.signalStrength)}
        </div>

        {/* 電池指示器 */}
        {systemState.batteryLevel !== undefined && (
          <div style={{
            width: '16px',
            height: '8px',
            border: '1px solid #ccc',
            borderRadius: '2px',
            position: 'relative',
            background: 'white'
          }}>
            <div style={{
              position: 'absolute',
              right: '-3px',
              top: '2px',
              width: '2px',
              height: '4px',
              background: '#ccc',
              borderRadius: '0 1px 1px 0'
            }} />
            <div style={{
              width: `${systemState.batteryLevel}%`,
              height: '100%',
              background: getBatteryColor(systemState.batteryLevel),
              borderRadius: '1px',
              transition: 'width 0.3s ease'
            }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '60px',
      right: '20px',
      zIndex: 999
    }}>
      {/* 主要狀態顯示 */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          padding: '12px 16px',
          borderRadius: '16px',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
          cursor: showDetails ? 'pointer' : 'default'
        }}
        onClick={() => showDetails && setShowDetailPanel(!showDetailPanel)}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {/* 狀態圖示和文字 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: statusInfo.color,
                animation: systemState.status === 'recording' || systemState.status === 'processing' ? 'pulse 2s infinite' : 'none'
              }}
            />
            <span style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#333'
            }}>
              {statusInfo.text}
            </span>
          </div>

          {/* 系統指標 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            {/* 網路狀態 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ fontSize: '12px' }}>📶</span>
              <div style={{
                display: 'flex',
                alignItems: 'end',
                gap: '1px',
                height: '12px'
              }}>
                {getSignalBars(systemState.signalStrength)}
              </div>
            </div>

            {/* 電池狀態 */}
            {systemState.batteryLevel !== undefined && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ fontSize: '12px' }}>🔋</span>
                <div style={{
                  width: '20px',
                  height: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '2px',
                  position: 'relative',
                  background: 'white'
                }}>
                  <div style={{
                    position: 'absolute',
                    right: '-3px',
                    top: '2px',
                    width: '2px',
                    height: '6px',
                    background: '#ccc',
                    borderRadius: '0 1px 1px 0'
                  }} />
                  <div style={{
                    width: `${systemState.batteryLevel}%`,
                    height: '100%',
                    background: getBatteryColor(systemState.batteryLevel),
                    borderRadius: '1px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <span style={{
                  fontSize: '11px',
                  color: '#666'
                }}>
                  {systemState.batteryLevel}%
                </span>
              </div>
            )}

            {/* 重新整理按鈕 */}
            {onRefresh && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#666',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                🔄
              </button>
            )}
          </div>
        </div>

        {/* 錯誤訊息 */}
        {systemState.status === 'error' && systemState.errorMessage && (
          <div style={{
            marginTop: '8px',
            padding: '6px 8px',
            background: 'rgba(244, 67, 54, 0.1)',
            border: '1px solid rgba(244, 67, 54, 0.2)',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#d32f2f'
          }}>
            {systemState.errorMessage}
          </div>
        )}
      </div>

      {/* 詳細資訊面板 */}
      {showDetailPanel && showDetails && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998
            }}
            onClick={() => setShowDetailPanel(false)}
          />
          
          <div style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            marginTop: '8px',
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            zIndex: 999,
            minWidth: '250px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <h4 style={{
              margin: '0 0 12px 0',
              fontSize: '16px',
              color: '#333',
              fontWeight: '600'
            }}>
              系統狀態詳情
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#666' }}>當前狀態:</span>
                <span style={{ 
                  fontSize: '14px', 
                  color: statusInfo.color,
                  fontWeight: '500'
                }}>
                  {statusInfo.icon} {statusInfo.text}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#666' }}>網路連線:</span>
                <span style={{ 
                  fontSize: '14px',
                  color: systemState.isOnline ? '#4CAF50' : '#F44336'
                }}>
                  {systemState.isOnline ? '✓ 已連線' : '✗ 離線'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#666' }}>信號強度:</span>
                <span style={{ fontSize: '14px', color: '#333' }}>
                  {systemState.signalStrength}%
                </span>
              </div>

              {systemState.batteryLevel !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>電池電量:</span>
                  <span style={{ 
                    fontSize: '14px',
                    color: getBatteryColor(systemState.batteryLevel)
                  }}>
                    {systemState.batteryLevel}%
                  </span>
                </div>
              )}

              {systemState.lastActivity && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>最後活動:</span>
                  <span style={{ fontSize: '14px', color: '#333' }}>
                    {systemState.lastActivity.toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.7;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
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
  );
};

export default SystemStatusIndicator;
