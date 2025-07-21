#!/usr/bin/env python3
import requests
import json
import time
import sys

def test_ollama_connection(base_url="http://localhost:11434"):
    """測試 Ollama 服務連接"""
    try:
        print(f"🔗 Testing connection to {base_url}")
        response = requests.get(f"{base_url}/api/tags", timeout=10)
        if response.status_code == 200:
            print("✅ Ollama service is accessible")
            models = response.json()
            print(f"📋 Available models: {len(models.get('models', []))}")
            for model in models.get('models', []):
                print(f"   - {model['name']}")
            return True
        else:
            print(f"❌ Failed to connect: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

def pull_model(model_name="llama3.2:1b", base_url="http://localhost:11434"):
    """拉取模型"""
    try:
        print(f"⬇️ Pulling model: {model_name}")
        url = f"{base_url}/api/pull"
        payload = {"name": model_name}
        
        response = requests.post(url, json=payload, stream=True, timeout=300)
        
        if response.status_code == 200:
            print("✅ Pull request sent successfully")
            
            # 處理流式響應
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode('utf-8'))
                        if 'status' in data:
                            print(f"📥 {data['status']}")
                            if 'completed' in data and 'total' in data:
                                progress = (data['completed'] / data['total']) * 100
                                print(f"   Progress: {progress:.1f}%")
                        if data.get('status') == 'success':
                            print("✅ Model pulled successfully!")
                            return True
                    except json.JSONDecodeError:
                        continue
        else:
            print(f"❌ Pull failed: HTTP {response.status_code}")
            print(response.text)
            return False
            
    except Exception as e:
        print(f"❌ Pull failed: {e}")
        return False

def test_model_generation(model_name="llama3.2:1b", base_url="http://localhost:11434"):
    """測試模型生成"""
    try:
        print(f"🧠 Testing model generation with {model_name}")
        url = f"{base_url}/api/generate"
        payload = {
            "model": model_name,
            "prompt": "Hello, how are you?",
            "stream": False
        }
        
        response = requests.post(url, json=payload, timeout=60)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Model generation successful!")
            print(f"📝 Response: {result.get('response', 'No response')}")
            return True
        else:
            print(f"❌ Generation failed: HTTP {response.status_code}")
            print(response.text)
            return False
            
    except Exception as e:
        print(f"❌ Generation failed: {e}")
        return False

def main():
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
    else:
        base_url = "http://localhost:11434"
    
    print("🚀 Ollama Service Test")
    print("=" * 50)
    
    # 測試連接
    if not test_ollama_connection(base_url):
        print("❌ Cannot connect to Ollama service")
        sys.exit(1)
    
    # 拉取模型
    model_name = "llama3.2:1b"  # 使用較小的模型進行測試
    print(f"\n⬇️ Attempting to pull model: {model_name}")
    
    if pull_model(model_name, base_url):
        print("\n🧠 Testing model generation...")
        test_model_generation(model_name, base_url)
    else:
        print("❌ Model pull failed, skipping generation test")
    
    print("\n🏁 Test completed")

if __name__ == "__main__":
    main()
