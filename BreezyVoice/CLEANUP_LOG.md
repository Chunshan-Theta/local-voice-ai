# 🗑️ 清理說明

## 清理的文件和目錄

以下是已移動到 `backup_old_modules/` 目錄的舊 BreezyVoice 模組：

### 主要 Python 文件
- `single_inference.py` - 單個推理腳本
- `batch_inference.py` - 批量推理腳本
- `openai_api_inference.py` - OpenAI API 測試腳本

### Shell 腳本
- `run_batch_inference.sh` - 批量推理運行腳本
- `run_single_inference.sh` - 單個推理運行腳本

### 核心模組目錄
- `cosyvoice/` - CosyVoice 模型實現
- `third_party/` - 第三方依賴 (Matcha-TTS 等)
- `utils/` - 工具函數 (包含大型的 word_utils.py)

### 配置和資源
- `compose.yaml` - 舊的 Docker Compose 文件
- `Dockerfile` - 舊的 Dockerfile
- `batch_files.csv` - 批量處理配置
- `images/` - 文檔圖片目錄
- `README.md` - 原始說明文件 (重命名為 README_original.md)

### 暫存文件
- `__pycache__/` - Python 快取目錄 (已刪除)

## 保留的文件

### 新的 Hugging Face TTS 文件
- `api.py` - 更新的 API 實現
- `start_hf_tts.py` - 啟動腳本
- `test_hf_tts.py` - 測試腳本
- `performance_test.py` - 性能測試
- `deploy_hf_tts.sh` - 部署腳本

### 配置文件
- `requirements.txt` - 更新的依賴列表
- `.env.hf` - 環境配置
- `.env` - 現有環境配置

### Docker 文件
- `Dockerfile.hf` - 新的 Dockerfile
- `docker-compose.hf.yml` - 新的 Docker Compose

### 文檔
- `README.md` - 新的主要說明文件
- `README_HF_TTS.md` - 詳細技術文檔
- `QUICKSTART.md` - 快速開始指南

### 數據目錄
- `data/example.wav` - 示例音頻文件
- `results/` - 輸出目錄

## 恢復說明

如果需要恢復任何舊文件，可以從 `backup_old_modules/` 目錄中復制：

```bash
# 恢復特定文件
cp backup_old_modules/single_inference.py .

# 恢復整個目錄
cp -r backup_old_modules/cosyvoice/ .
```

## 清理效果

- 移除了大量不再使用的 BreezyVoice 相關代碼
- 清理了複雜的依賴關係
- 簡化了項目結構
- 保留了新的 Hugging Face TTS 實現
- 確保了向後兼容性（備份了所有舊文件）

清理後的項目更加簡潔、易於維護，並且專注於 Hugging Face TTS 功能。

---

# 🚀 GPU 版本優化清理記錄

## 已刪除的檔案（GPU 優化後）

### 舊版本檔案
- `Dockerfile.hf` - 舊的 HF Dockerfile
- `docker-compose.hf.yml` - 舊的 HF docker-compose 檔案
- `start_hf_tts.py` - 舊的 HF 啟動腳本
- `test_hf_tts.py` - 舊的 HF 測試腳本
- `README_HF_TTS.md` - 舊的 HF TTS README
- `.env.hf` - 舊的 HF 環境設定檔案
- `deploy_hf_tts.sh` - 舊的 HF 部署腳本

### 重複檔案
- `Dockerfile.gpu` - 重複的 GPU Dockerfile（已重命名為 Dockerfile）
- `docker-compose.gpu.yml` - 重複的 GPU docker-compose（已重命名為 docker-compose.yml）
- `deploy_gpu_tts.sh` - 重複的 GPU 部署腳本（已重命名為 deploy.sh）
- `test_gpu_tts.py` - 重複的 GPU 測試腳本（已重命名為 test_tts.py）
- `start_gpu_optimized.py` - 重複的 GPU 啟動腳本（已重命名為 start.py）

## 重命名的檔案

### 主要檔案
- `Dockerfile.gpu` → `Dockerfile`
- `docker-compose.gpu.yml` → `docker-compose.yml`
- `deploy_gpu_tts.sh` → `deploy.sh`
- `test_gpu_tts.py` → `test_tts.py`
- `start_gpu_optimized.py` → `start.py`

## 保留的檔案

### 核心檔案
- `api.py` - 主要 API 服務（GPU 優化）
- `start.py` - GPU 優化啟動腳本
- `Dockerfile` - GPU 優化 Docker 映像
- `docker-compose.yml` - Docker Compose 配置
- `deploy.sh` - 部署腳本
- `requirements.txt` - Python 依賴

### 測試檔案
- `test_tts.py` - 功能測試腳本
- `test_gpu_usage.py` - GPU 使用情況測試
- `performance_test.py` - 性能測試腳本

### 文檔檔案
- `README.md` - 主要說明文件（已更新）
- `README_GPU.md` - GPU 詳細使用指南
- `QUICKSTART.md` - 快速開始指南

### 配置檔案
- `.env` - 環境變量配置
- `.gitignore` - Git 忽略規則

## GPU 優化清理結果

✅ **成功簡化檔案結構**
- 刪除了 12 個不必要的檔案
- 重命名了 5 個檔案以提高清晰度
- 保留了 20 個核心檔案
- 所有檔案都已 GPU 優化

✅ **統一了命名規範**
- 所有主要檔案都使用簡潔的名稱
- 移除了重複的 GPU 和 HF 標識符
- 保持了功能清晰度

✅ **更新了相關引用**
- 更新了 Dockerfile 中的啟動腳本引用
- 更新了 docker-compose.yml 中的服務名稱
- 更新了 deploy.sh 中的所有引用
- 更新了 README.md 的文檔說明

## 當前狀態

現在的 BreezyVoice 項目已經完全優化為 GPU 版本，具有：
- 🚀 GPU 加速的 TTS 推理
- 📊 GPU 狀態監控
- 🐳 GPU 支援的 Docker 部署
- 🧪 完整的測試套件
- 📚 詳細的文檔說明

GPU 優化清理完成時間: 2025-07-11
