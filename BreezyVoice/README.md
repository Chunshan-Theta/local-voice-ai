# 🎙️ BreezyVoice TTS API

基於 Hugging Face Transformers 的文本轉語音 (TTS) API 服務，支援中文和多種語言，GPU 優化。

## ✨ 特色功能

- 🎯 **OpenAI 兼容 API**: 保持與 OpenAI TTS API 相同的介面
- 🌏 **中文支援**: 完整的中文語音合成支援
- 🚀 **GPU 加速**: 自動檢測和使用 GPU，顯著提升推理速度
- 🔧 **多模型選擇**: 支援多種 TTS 模型
- 📊 **性能監控**: 內建 GPU 狀態監控
- 🐳 **Docker 支援**: 完整的容器化部署（GPU 支援）

## 🚀 快速開始

### 方法 1: 直接運行

```bash
# 安裝依賴
pip install -r requirements.txt

# 啟動服務（GPU 優化）
python start.py

# 或者使用標準 API
python api.py
```

### 方法 2: 使用 Docker

```bash
# 快速部署（包含 GPU 支援）
./deploy.sh

# 或者手動操作
docker-compose up -d
```

### 3. 測試服務

```bash
# 基本測試
python test_tts.py

# GPU 使用情況測試
python test_gpu_usage.py

# 性能測試
python performance_test.py
```

## 📚 文件說明

- `api.py` - 主要 API 服務（GPU 優化）
- `start.py` - GPU 優化啟動腳本
- `test_tts.py` - 功能測試腳本
- `test_gpu_usage.py` - GPU 使用情況測試
- `performance_test.py` - 性能測試腳本
- `deploy.sh` - 部署腳本
- `Dockerfile` - GPU 優化 Docker 映像
- `docker-compose.yml` - Docker Compose 配置
- `README_GPU.md` - GPU 詳細使用指南
- `QUICKSTART.md` - 快速開始指南

## 🎯 API 端點

### GET /v1/models
獲取可用的 TTS 模型列表

### GET /v1/gpu-status
獲取 GPU 使用狀態（新增）

### POST /v1/audio/speech
獲取可用的模型列表

### POST /v1/audio/speech
語音合成端點

**請求格式:**
```json
{
  "model": "suno/bark",
  "input": "你好世界",
  "response_format": "wav",
  "speed": 1.0
}
```

## 🔧 支援的模型

| 模型 | 語言 | 速度 | 品質 | 大小 |
|------|------|------|------|------|
| suno/bark | 多語言 | 中等 | 高 | 中 |
| suno/bark-small | 多語言 | 快 | 中 | 小 |
| espnet/kan-bayashi_ljspeech_vits | 英語 | 快 | 中 | 中 |

## 🐳 Docker 部署

```bash
# 一鍵部署
./deploy_hf_tts.sh

# 或使用 Docker Compose
docker-compose -f docker-compose.hf.yml up -d
```

## 📈 性能優化

1. **使用 GPU**: 確保安裝 CUDA 版本的 PyTorch
2. **選擇合適模型**: 根據需求選擇速度和品質的平衡
3. **模型快取**: 首次運行後模型會快取到本地

## 🆘 故障排除

詳見 [QUICKSTART.md](QUICKSTART.md) 中的故障排除章節。

## 📝 授權

MIT License

## 🗂️ 舊版本備份

舊的 BreezyVoice 相關文件已移動到 `backup_old_modules/` 目錄，如需要可以隨時恢復。
