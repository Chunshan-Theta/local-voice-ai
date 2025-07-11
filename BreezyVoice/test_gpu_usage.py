#!/usr/bin/env python3
"""
測試 GPU 使用情況的腳本
"""
import torch
import requests
import time

def test_gpu_availability():
    """測試 GPU 可用性"""
    print("=== GPU 測試 ===")
    gpu_available = torch.cuda.is_available()
    print(f"GPU 可用: {gpu_available}")
    
    if gpu_available:
        gpu_count = torch.cuda.device_count()
        print(f"GPU 數量: {gpu_count}")
        
        for i in range(gpu_count):
            gpu_name = torch.cuda.get_device_name(i)
            gpu_memory = torch.cuda.get_device_properties(i).total_memory / (1024**3)
            print(f"GPU {i}: {gpu_name} ({gpu_memory:.2f} GB)")
        
        # 測試 GPU 張量操作
        print("\n測試 GPU 張量操作...")
        x = torch.randn(1000, 1000).cuda()
        y = torch.randn(1000, 1000).cuda()
        start_time = time.time()
        z = torch.mm(x, y)
        end_time = time.time()
        print(f"GPU 矩陣乘法耗時: {end_time - start_time:.4f} 秒")
        print(f"結果形狀: {z.shape}")
        
        # 清理 GPU 內存
        del x, y, z
        torch.cuda.empty_cache()
    else:
        print("GPU 不可用，將使用 CPU")

def test_api_gpu_status():
    """測試 API 的 GPU 狀態端點"""
    print("\n=== API GPU 狀態測試 ===")
    try:
        response = requests.get("http://localhost:8080/v1/gpu-status")
        if response.status_code == 200:
            data = response.json()
            print("API GPU 狀態:")
            for key, value in data.items():
                print(f"  {key}: {value}")
        else:
            print(f"API 請求失敗: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"無法連接到 API: {e}")
        print("請確保 API 服務正在運行 (python api.py)")

def test_tts_performance():
    """測試 TTS 性能"""
    print("\n=== TTS 性能測試 ===")
    test_texts = [
        "你好世界",
        "今天天氣真好",
        "人工智能技術正在快速發展",
        "This is a test of the text-to-speech system"
    ]
    
    for i, text in enumerate(test_texts):
        print(f"\n測試 {i+1}: {text}")
        try:
            start_time = time.time()
            response = requests.post(
                "http://localhost:8080/v1/audio/speech",
                json={
                    "model": "tts-1",
                    "input": text,
                    "voice": "alloy",
                    "speed": 1.0
                }
            )
            end_time = time.time()
            
            if response.status_code == 200:
                audio_size = len(response.content)
                print(f"  成功 - 耗時: {end_time - start_time:.2f}s, 音頻大小: {audio_size} bytes")
            else:
                print(f"  失敗 - 狀態碼: {response.status_code}")
                print(f"  錯誤: {response.text}")
        except requests.exceptions.RequestException as e:
            print(f"  請求失敗: {e}")

if __name__ == "__main__":
    test_gpu_availability()
    test_api_gpu_status()
    test_tts_performance()
