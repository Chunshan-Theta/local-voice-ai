# Docker 部署指南

## 快速開始

### 1. 設置環境變數 (可選)

```bash
# 複製環境變數範例
cp env.example .env

# 編輯 .env 文件設置你的 Ollama 端點
# OLLAMA_BASE_URL=https://your-ollama-endpoint.com
```

### 2. 構建並運行容器

```bash
# 使用 docker-compose (推薦)
docker-compose up --build

# 如果遇到 GPG 錯誤，使用 Ubuntu 版本
docker build -f Dockerfile.ubuntu -t local-voice-ai .
docker run -p 3000:3000 -p 5001:5001 --env-file .env local-voice-ai

# 或者直接使用 Docker
docker build -t local-voice-ai .
docker run -p 3000:3000 -p 5001:5001 -e OLLAMA_BASE_URL=https://site.ollama.lazyinwork.com local-voice-ai
```

### 2. 自定義配置

```bash
# 設置環境變數
export OLLAMA_BASE_URL=https://your-ollama-endpoint.com
export WHISPER_MODEL=medium  # 可選：tiny, base, small, medium, large

# 使用 docker-compose
OLLAMA_BASE_URL=https://your-ollama-endpoint.com WHISPER_MODEL=medium docker-compose up --build

# 使用 Docker
docker run -p 3000:3000 -p 5001:5001 \
  -e OLLAMA_BASE_URL=https://your-ollama-endpoint.com \
  -e WHISPER_MODEL=medium \
  local-voice-ai
```

## 容器內容

### 預載服務
- ✅ Next.js 前端應用 (端口 3000)
- ✅ Python Whisper 語音辨識服務 (端口 5001)
- ✅ Whisper small 模型 (預先下載)

### 外部依賴
- 🌐 Ollama API (可配置端點)

## 健康檢查

容器啟動後，檢查服務狀態：

```bash
# Next.js health check
curl http://localhost:3000/api/health

# Whisper service health check  
curl http://localhost:5001/health
```

## 端口說明

- `3000`: Next.js 前端應用
- `5001`: Python Whisper 語音辨識服務

## 環境變數

| 變數名 | 默認值 | 說明 |
|--------|--------|------|
| `OLLAMA_BASE_URL` | `https://site.ollama.lazyinwork.com` | Ollama API 端點 |
| `WHISPER_MODEL` | `small` | Whisper 模型大小 (tiny/base/small/medium/large) |
| `NODE_ENV` | `production` | Node.js 環境 |

## 故障排除

### 容器啟動失敗
檢查 Docker 日誌：
```bash
docker-compose logs voice-ai
```

### Whisper 服務無法訪問
確認端口 5001 沒有被占用：
```bash
lsof -i :5001
```

### Ollama 連接失敗
檢查 OLLAMA_BASE_URL 環境變數是否正確設置 