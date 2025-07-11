#!/usr/bin/env python3
"""
GPU 版本 TTS API 測試腳本
測試 GPU 加速的語音合成服務
"""

import requests
import json
import time
import os
from pathlib import Path

# 設定
BASE_URL = "http://localhost:8000/v1"
OUTPUT_DIR = Path("test_outputs")
OUTPUT_DIR.mkdir(exist_ok=True)

def test_gpu_status():
    """測試 GPU 狀態端點"""
    print("🔍 測試 GPU 狀態...")
    try:
        response = requests.get(f"{BASE_URL}/gpu-status")
        if response.status_code == 200:
            gpu_info = response.json()
            print("✅ GPU 狀態正常")
            print(f"   GPU 可用: {gpu_info.get('gpu_available', 'N/A')}")
            print(f"   GPU 名稱: {gpu_info.get('gpu_name', 'N/A')}")
            print(f"   GPU 記憶體: {gpu_info.get('gpu_memory_total_gb', 'N/A')} GB")
            print(f"   GPU 使用率: {gpu_info.get('gpu_utilization', 'N/A')}")
            return True
        else:
            print(f"❌ GPU 狀態端點錯誤: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ GPU 狀態測試失敗: {e}")
        return False

def test_models():
    """測試模型端點"""
    print("\n🔍 測試模型端點...")
    try:
        response = requests.get(f"{BASE_URL}/models")
        if response.status_code == 200:
            models = response.json()
            print("✅ 模型端點正常")
            print(f"   可用模型: {models['data'][0]['id']}")
            return True
        else:
            print(f"❌ 模型端點錯誤: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 模型測試失敗: {e}")
        return False

def test_tts(text, filename, speed=1.0):
    """測試 TTS 端點"""
    print(f"\n🔍 測試 TTS 合成: '{text}'")
    try:
        start_time = time.time()
        
        payload = {
            "model": "suno/bark",
            "input": text,
            "response_format": "wav",
            "speed": speed
        }
        
        response = requests.post(
            f"{BASE_URL}/audio/speech",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            output_path = OUTPUT_DIR / filename
            with open(output_path, "wb") as f:
                f.write(response.content)
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            print(f"✅ TTS 合成成功")
            print(f"   處理時間: {processing_time:.2f} 秒")
            print(f"   輸出文件: {output_path}")
            print(f"   文件大小: {len(response.content)} bytes")
            return True
        else:
            print(f"❌ TTS 合成失敗: {response.status_code}")
            print(f"   錯誤內容: {response.text}")
            return False
    except Exception as e:
        print(f"❌ TTS 測試失敗: {e}")
        return False

def performance_test():
    """性能測試"""
    print("\n🚀 GPU 性能測試...")
    
    test_cases = [
        ("你好，這是一個簡單的測試。", "gpu_simple_test.wav"),
        ("今天天氣很好，我們去公園散步吧。這是一個稍微長一點的句子測試。", "gpu_medium_test.wav"),
        ("人工智能技術在語音合成領域取得了重大突破。深度學習模型可以生成非常自然的語音，並且支持多種語言。GPU 加速使得推理速度大幅提升。", "gpu_long_test.wav"),
    ]
    
    total_time = 0
    success_count = 0
    
    for i, (text, filename) in enumerate(test_cases, 1):
        print(f"\n第 {i} 個測試案例:")
        start_time = time.time()
        
        if test_tts(text, filename):
            success_count += 1
            
        end_time = time.time()
        case_time = end_time - start_time
        total_time += case_time
        
        print(f"   案例處理時間: {case_time:.2f} 秒")
    
    if success_count > 0:
        avg_time = total_time / success_count
        print(f"\n📊 性能統計:")
        print(f"   成功案例: {success_count}/{len(test_cases)}")
        print(f"   總處理時間: {total_time:.2f} 秒")
        print(f"   平均處理時間: {avg_time:.2f} 秒")

def main():
    """主測試函數"""
    print("🎙️ GPU 版本 TTS API 測試")
    print("=" * 40)
    
    # 檢查服務是否可用
    try:
        response = requests.get(f"{BASE_URL}/gpu-status", timeout=5)
        if response.status_code != 200:
            print("❌ 服務不可用，請先啟動 GPU 服務")
            print("   運行: ./deploy_gpu_tts.sh start")
            return
    except Exception as e:
        print(f"❌ 無法連接到服務: {e}")
        print("   請確保服務正在運行: ./deploy_gpu_tts.sh start")
        return
    
    # 運行測試
    tests_passed = 0
    total_tests = 3
    
    if test_gpu_status():
        tests_passed += 1
    
    if test_models():
        tests_passed += 1
    
    if test_tts("GPU 版本測試中文語音合成", "gpu_basic_test.wav"):
        tests_passed += 1
    
    # 性能測試
    performance_test()
    
    # 總結
    print("\n" + "=" * 40)
    print(f"🎯 測試結果: {tests_passed}/{total_tests} 通過")
    
    if tests_passed == total_tests:
        print("🎉 所有測試通過！GPU 版本 TTS 服務運行正常")
    else:
        print("⚠️  部分測試失敗，請檢查服務狀態")
    
    print(f"\n📁 輸出文件位於: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
