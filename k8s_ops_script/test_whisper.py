#!/usr/bin/env python3
import requests
import tempfile
import wave
import numpy as np
import os
import subprocess
import time
import sys
import signal

def create_test_audio():
    """創建一個簡單的測試音頻檔案"""
    sample_rate = 16000
    duration = 2  # 2 秒
    frequency = 440  # A4 音符
    
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    audio_data = np.sin(2 * np.pi * frequency * t)
    
    # 轉換為 16-bit PCM
    audio_data = (audio_data * 32767).astype(np.int16)
    
    # 創建臨時 WAV 檔案
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
        with wave.open(temp_file.name, 'w') as wav_file:
            wav_file.setnchannels(1)  # 單聲道
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(audio_data.tobytes())
        
        return temp_file.name

def test_whisper_service():
    """測試 Whisper 服務"""
    print("Creating test audio file...")
    audio_file_path = create_test_audio()
    
    try:
        print(f"Test audio file created: {audio_file_path}")
        print(f"File size: {os.path.getsize(audio_file_path)} bytes")
        
        # 測試健康檢查
        print("\nTesting health check...")
        health_response = requests.get('http://localhost:5001/health', timeout=5)
        print(f"Health check: {health_response.json()}")
        
        # 測試語音辨識
        print("\nTesting transcription...")
        with open(audio_file_path, 'rb') as audio_file:
            files = {'audio': ('test.wav', audio_file, 'audio/wav')}
            response = requests.post(
                'http://localhost/api/transcribe', 
                files=files, 
                timeout=60  # 1 分鐘超時
            )
        
        if response.status_code == 200:
            result = response.json()
            print(f"Transcription successful!")
            print(f"Result: {result}")
        else:
            print(f"Transcription failed: {response.status_code}")
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Test failed: {e}")
    finally:
        # 清理臨時檔案
        if os.path.exists(audio_file_path):
            os.unlink(audio_file_path)

if __name__ == '__main__':
    test_whisper_service() 