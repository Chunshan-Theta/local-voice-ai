import { useState, useRef } from 'react';

interface ChatResult {
  transcript: string;
  reply: string;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [result, setResult] = useState<ChatResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
        await uploadAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setError('無法存取麥克風');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadAudio = async (audioBlob: Blob) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('上傳失敗');
      }

      const data: ChatResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '處理失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>本地語音 AI 助手</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={loading}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            backgroundColor: isRecording ? '#dc3545' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '處理中...' : isRecording ? '停止錄音' : '開始錄音'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          錯誤：{error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{
            padding: '1rem',
            backgroundColor: '#d4edda',
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            <h3>你說的話：</h3>
            <p>{result.transcript}</p>
          </div>
          
          <div style={{
            padding: '1rem',
            backgroundColor: '#d1ecf1',
            borderRadius: '4px'
          }}>
            <h3>AI 回覆：</h3>
            <p>{result.reply}</p>
          </div>
        </div>
      )}

      <div style={{ marginTop: '3rem', fontSize: '0.9rem', color: '#666' }}>
        <p>確保本地 Ollama 已啟動並載入 whisper 工具和 llama3 模型</p>
      </div>
    </div>
  );
} 