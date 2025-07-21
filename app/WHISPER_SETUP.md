# 本地 Whisper 語音辨識服務

這個專案現在使用 Docker Compose 運行本地的 Python Whisper 服務來進行語音辨識。

## 🚀 快速開始

### 1. 啟動 Whisper 服務

```bash
# 建立並啟動 Docker 容器
docker-compose up --build

# 或在背景運行
docker-compose up --build -d
```

第一次啟動時，Docker 會：
- 下載 Python 映像檔
- 安裝依賴套件 (Flask, OpenAI Whisper 等)
- 下載 Whisper base 模型 (~142MB)

### 2. 啟動 Next.js 應用

```bash
# 在另一個終端機視窗
npm run dev
```

### 3. 測試語音辨識

1. 前往 http://localhost:3000
2. 點擊「開始錄音」
3. 說話後點擊「停止錄音」
4. 系統會使用本地 Whisper 服務辨識你的聲音
5. 然後與 Gemma3:4b 模型對話

## 🔧 服務端點

- **Whisper 服務**: http://localhost:5000
- **健康檢查**: http://localhost:5000/health
- **語音辨識**: POST http://localhost:5000/transcribe

## 📁 專案結構

```
local-voice-ai/
├── whisper-service/          # Python Whisper 服務
│   ├── app.py               # Flask 應用
│   ├── requirements.txt     # Python 依賴
│   └── Dockerfile          # Docker 映像配置
├── docker-compose.yml       # Docker Compose 配置
├── lib/ollama.ts           # 修改為呼叫本地 Whisper
└── pages/                  # Next.js 頁面
```

## 🛠️ 管理指令

```bash
# 查看服務狀態
docker-compose ps

# 查看日誌
docker-compose logs whisper-service

# 停止服務
docker-compose down

# 完全清理（包含 volumes）
docker-compose down -v

# 重新建構映像檔
docker-compose build --no-cache
```

## 🔍 故障排除

### Whisper 服務無法啟動
- 檢查 Docker 是否正在運行
- 確保端口 5000 沒有被其他服務佔用

### 語音辨識失敗
- 確認 Whisper 服務健康狀態：`curl http://localhost:5000/health`
- 查看服務日誌：`docker-compose logs whisper-service`

### 模型下載緩慢
- 第一次啟動時會下載 Whisper 模型，請耐心等待
- 模型會快取在 Docker volume 中，後續啟動會較快

## 💡 優化建議

- 如果有 GPU，可以修改 Dockerfile 使用 CUDA 版本的 PyTorch
- 可以切換到更小的模型（tiny, small）或更大的模型（large）
- 生產環境建議使用 `docker-compose -f docker-compose.prod.yml` 