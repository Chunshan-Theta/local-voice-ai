# 本地語音 AI 助手

基於 Next.js + Ollama 的本地語音對話系統

## 功能特色

- 🎤 瀏覽器錄音功能
- 🔊 使用 Ollama Whisper 進行語音辨識
- 🤖 使用 Ollama LLaMA3 生成 AI 回覆
- 💬 即時顯示對話結果

## 技術架構

- **前端**: Next.js + TypeScript + MediaRecorder API
- **後端**: Next.js API Routes + Formidable
- **AI 模型**: Ollama (Whisper + LLaMA3)

## 安裝與執行

### 1. 安裝依賴

```bash
npm install
```

### 2. 確保模型可用

系統會連接到遠端 Ollama 服務：`https://site.ollama.lazyinwork.com/`

確保以下模型已部署：
- `dimavz/whisper-tiny` (語音辨識)
- `llama3` (對話生成)

### 3. 建立臨時檔案目錄

```bash
mkdir tmp
```

### 4. 啟動開發伺服器

```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000) 即可使用

## API 端點

### POST /api/chat

接收語音檔案，回傳語音辨識和 AI 回覆結果

**請求格式**: multipart/form-data
- `audio`: WAV 音訊檔案

**回應格式**: JSON
```json
{
  "transcript": "辨識的文字內容",
  "reply": "AI 回覆內容"
}
```

## 注意事項

- 系統連接遠端 Ollama 服務：`https://site.ollama.lazyinwork.com/`
- 需要瀏覽器支援 MediaRecorder API
- 音訊檔案大小限制 10MB
- 確保網路連線穩定以存取遠端 AI 服務 