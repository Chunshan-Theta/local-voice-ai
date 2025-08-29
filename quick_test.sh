#!/bin/bash
# 測試三個服務連結

echo "測試本地語音AI服務..."
echo "================================"

# 測試 TTS
echo "📡 TTS 服務:"
response=$(curl -s --max-time 5 http://localhost:8000/tts/ 2>&1)
if [ $? -eq 0 ]; then
    echo "✅ 狀態: 正常"
    echo "📄 回應: $response"
else
    echo "❌ 狀態: 異常"
    echo "📄 錯誤: $response"
fi
echo "--------------------------------"

# 測試 LLM
echo "📡 LLM 服務:"
response=$(curl -s --max-time 5 http://localhost:8000/llm/ 2>&1)
if [ $? -eq 0 ]; then
    echo "✅ 狀態: 正常"
    echo "📄 回應: $response"
else
    echo "❌ 狀態: 異常"
    echo "📄 錯誤: $response"
fi
echo "--------------------------------"

# 測試 STT
echo "📡 STT 服務:"
response=$(curl -s --max-time 5 http://localhost:8000/stt/health 2>&1)
if [ $? -eq 0 ]; then
    echo "✅ 狀態: 正常"
    echo "📄 回應: $response"
else
    echo "❌ 狀態: 異常"
    echo "📄 錯誤: $response"
fi
echo "--------------------------------"

echo "🎯 測試完成"
