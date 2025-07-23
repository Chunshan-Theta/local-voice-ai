'use client';

import React from 'react';

interface BottomControlPanelProps {
  // 狀態相關
  isCalibrating: boolean;
  calibrationProgress: number;
  isListening: boolean;
  isSpeaking: boolean;
  waitingForVoiceAfterTts: boolean;
  conversationStarted: boolean;
  loading: boolean;
  generatingReport: boolean;
  showReportButton: boolean;
  messagesLength: number;
  
  // 事件處理函數
  onStartListening: () => void;
  onStopRecording: () => void;
  onStartConversation: () => void;
  onEndConversation: () => void;
  onGenerateReport: () => void;
  onStartNewConversation: () => void;
}

const BottomControlPanel: React.FC<BottomControlPanelProps> = ({
  isCalibrating,
  calibrationProgress,
  isListening,
  isSpeaking,
  waitingForVoiceAfterTts,
  conversationStarted,
  loading,
  generatingReport,
  showReportButton,
  messagesLength,
  onStartListening,
  onStopRecording,
  onStartConversation,
  onEndConversation,
  onGenerateReport,
  onStartNewConversation
}) => {
  const getStatusText = () => {
    if (isCalibrating) return `校準中... ${Math.round(calibrationProgress)}%`;
    if (isListening) return '🎤 錄音中...';
    if (isSpeaking) return '🗣️ AI 回應中...';
    if (waitingForVoiceAfterTts) return '等待您的語音...';
    if (conversationStarted) return '等待語音輸入';
    return '請點擊開始對話';
  };

  const handleEndAndAnalyze = () => {
    onEndConversation();
    setTimeout(onGenerateReport, 500);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(47, 79, 79, 0.95)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px'
    }}>
      {/* 輸入區域和控制按鈕 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        justifyContent: 'center'
      }}>
        {/* 狀態顯示框 */}
        <div style={{
          flex: 1,
          maxWidth: '300px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '25px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          {getStatusText()}
        </div>

        {/* 錄音按鈕 */}
        {conversationStarted && (
          <button
            onClick={!isListening ? onStartListening : onStopRecording}
            disabled={isCalibrating || loading}
            style={{
              width: '50px',
              height: '50px',
              backgroundColor: isListening ? '#ff4444' : '#4CAF50',
              border: 'none',
              borderRadius: '8px',
              cursor: isCalibrating || loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isCalibrating && !loading) {
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCalibrating && !loading) {
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            {isListening ? '⏹️' : '🎤'}
          </button>
        )}

        {/* 開始對話按鈕 */}
        {!conversationStarted && (
          <button
            onClick={onStartConversation}
            disabled={loading || isCalibrating}
            style={{
              width: '50px',
              height: '50px',
              backgroundColor: '#2196F3',
              border: 'none',
              borderRadius: '50%',
              cursor: loading || isCalibrating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: 'white',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!loading && !isCalibrating) {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.backgroundColor = '#1976D2';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && !isCalibrating) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = '#2196F3';
              }
            }}
          >
            ▶️
          </button>
        )}
      </div>

      {/* 結束並開始分析按鈕 */}
      {conversationStarted && messagesLength > 0 && (
        <button
          onClick={handleEndAndAnalyze}
          disabled={generatingReport}
          style={{
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '25px',
            padding: '12px 30px',
            fontSize: '16px',
            cursor: generatingReport ? 'not-allowed' : 'pointer',
            alignSelf: 'center',
            fontWeight: 'bold',
            transition: 'all 0.2s ease',
            opacity: generatingReport ? 0.7 : 1
          }}
          onMouseEnter={(e) => {
            if (!generatingReport) {
              e.currentTarget.style.backgroundColor = '#d32f2f';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!generatingReport) {
              e.currentTarget.style.backgroundColor = '#f44336';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          {generatingReport ? '⏳ 分析中...' : '結束並開始分析'}
        </button>
      )}

      {/* 重新開始按鈕 */}
      {!conversationStarted && showReportButton && (
        <button
          onClick={onStartNewConversation}
          style={{
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '25px',
            padding: '12px 30px',
            fontSize: '16px',
            cursor: 'pointer',
            alignSelf: 'center',
            fontWeight: 'bold',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#45a049';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#4CAF50';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          🆕 開始新對話
        </button>
      )}
    </div>
  );
};

export default BottomControlPanel;
