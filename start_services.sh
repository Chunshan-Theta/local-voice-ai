#!/bin/bash

# 語音AI服務啟動腳本
echo "🚀 啟動本地語音AI服務..."

# 檢查是否在正確目錄
if [ ! -f "package.json" ]; then
    echo "❌ 請在項目根目錄執行此腳本"
    exit 1
fi

# 創建tmp目錄
mkdir -p tmp

# 啟動Whisper服務
echo "📡 啟動Whisper語音辨識服務..."
cd whisper-service

# 檢查虛擬環境
if [ ! -d "venv" ]; then
    echo "🔧 創建Python虛擬環境..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# 在背景啟動Whisper服務
echo "🎤 Whisper服務啟動中 (port 5001)..."
python3 app.py &
WHISPER_PID=$!

# 回到主目錄
cd ..

# 等待Whisper服務啟動
echo "⏳ 等待Whisper服務就緒..."
sleep 5

# 啟動Next.js前端
echo "🌐 啟動Next.js前端服務 (port 3000)..."
npm run dev &
NEXTJS_PID=$!

echo ""
echo "✅ 服務啟動完成！"
echo "📱 前端: http://localhost:3000"
echo "🎙️  Whisper API: http://localhost:5001"
echo ""
echo "按 Ctrl+C 停止所有服務"

# 等待用戶中斷
wait $NEXTJS_PID

# 清理進程
echo "🛑 停止服務..."
kill $WHISPER_PID 2>/dev/null
kill $NEXTJS_PID 2>/dev/null
echo "✅ 服務已停止" 