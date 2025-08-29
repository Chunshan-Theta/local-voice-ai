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

# 測試 STT Health
echo "📡 STT Health 服務:"
response=$(curl -s --max-time 5 http://localhost:8000/stt/health 2>&1)
if [ $? -eq 0 ]; then
    echo "✅ 狀態: 正常"
    echo "📄 回應: $response"
else
    echo "❌ 狀態: 異常"
    echo "📄 錯誤: $response"
fi
echo "--------------------------------"

# 測試 STT Transcribe (使用 host.docker.internal)
echo "📡 STT Transcribe 服務 (host.docker.internal):"
# 檢查是否有測試音檔
test_audio_file=""
if [ -f "BreezyVoice/data/example.wav" ]; then
    test_audio_file="BreezyVoice/data/example.wav"
elif [ -f "app/tmp/cho9xzbwv36juy38webte5ked.webm" ]; then
    test_audio_file="app/tmp/cho9xzbwv36juy38webte5ked.webm"
fi

if [ -n "$test_audio_file" ]; then
    echo "🎵 使用測試音檔: $test_audio_file"
    response=$(curl -s --max-time 10 -X POST -F "audio=@$test_audio_file" http://host.docker.internal:8000/stt/transcribe 2>&1)
    if [ $? -eq 0 ]; then
        echo "✅ 狀態: 正常"
        echo "📄 回應: $response"
    else
        echo "❌ 狀態: 異常"
        echo "📄 錯誤: $response"
    fi
else
    echo "⚠️  找不到測試音檔，跳過 transcribe 測試"
fi
echo "--------------------------------"

# 測試 STT Transcribe (使用 localhost)
echo "📡 STT Transcribe 服務 (localhost):"
if [ -n "$test_audio_file" ]; then
    echo "🎵 使用測試音檔: $test_audio_file"
    response=$(curl -s --max-time 10 -X POST -F "audio=@$test_audio_file" http://localhost:8000/stt/transcribe 2>&1)
    if [ $? -eq 0 ]; then
        echo "✅ 狀態: 正常"
        echo "📄 回應: $response"
    else
        echo "❌ 狀態: 異常"
        echo "📄 錯誤: $response"
    fi
else
    echo "⚠️  找不到測試音檔，跳過 transcribe 測試"
fi
echo "--------------------------------"

echo "🎯 測試完成"
