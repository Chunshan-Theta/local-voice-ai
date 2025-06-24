# 使用官方 Python 映像作為基礎
FROM python:3.9-slim

# 安裝系統依賴 (包含 ffmpeg)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 設置工作目錄
WORKDIR /app

# 複製需求檔案並安裝 Python 依賴
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製應用程式檔案
COPY app.py .

# 預下載 Whisper 模型
RUN python -c "import whisper; whisper.load_model('tiny')"

# 創建必要的目錄
RUN mkdir -p /root/.cache/whisper

# 暴露端口
EXPOSE 5000

# 健康檢查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# 使用 gunicorn 啟動應用，大幅增加超時時間
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--timeout", "300", "--worker-connections", "1000", "--preload", "app:app"] 