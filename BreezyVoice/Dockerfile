FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

# 設置工作目錄
WORKDIR /app

# 安裝系統依賴
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    gcc \
    g++ \
    make \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 創建 Python 符號連結
RUN ln -s /usr/bin/python3 /usr/bin/python

# 複製依賴文件
COPY requirements.txt .

# 升級 pip 並安裝 Python 依賴
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# 複製應用程式碼
COPY api.py .
COPY start.py .

# 創建快取目錄
RUN mkdir -p /app/hf_cache
RUN mkdir -p /app/results
RUN mkdir -p /app/test_outputs

# 設置環境變量
ENV TRANSFORMERS_CACHE=/app/hf_cache
ENV HF_HOME=/app/hf_cache
ENV TTS_MODEL_PATH=suno/bark
ENV PORT=8000
ENV CUDA_VISIBLE_DEVICES=0
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility

# 暴露端口
EXPOSE 8000

# 啟動命令
CMD ["python", "start.py"]
