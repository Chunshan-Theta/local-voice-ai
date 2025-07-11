from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import tempfile
import os
import logging
import torch

# 設置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check GPU availability
device = "cuda" if torch.cuda.is_available() else "cpu"
logger.info(f"Using device: {device}")
if device == "cuda":
    logger.info(f"GPU: {torch.cuda.get_device_name(0)}")

# 在全局範圍載入模型，避免重複載入
logger.info("Loading Whisper model...")
model = whisper.load_model("tiny").to(device)
logger.info("Whisper tiny model loaded successfully!")

app = Flask(__name__)
CORS(app)  # 允許跨域請求

@app.route('/health', methods=['GET'])
def health_check():
    """健康檢查端點"""
    return jsonify({
        "status": "healthy", 
        "model": "whisper-tiny",
        "device": device,
        "gpu_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
    })

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    logger.info("Transcribing Request Received")
    """語音辨識端點"""
    temp_filename = None
    try:
        # 檢查是否有上傳的檔案
        if 'audio' not in request.files:
            return jsonify({"error": "沒有找到音訊檔案"}), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({"error": "沒有選擇檔案"}), 400
        
        # 檢查檔案大小 (限制為 5MB)
        content = audio_file.read()
        if len(content) > 5 * 1024 * 1024:
            return jsonify({"error": "音訊檔案過大，請限制在 5MB 以內"}), 400
        
        # 創建臨時檔案來儲存上傳的音訊
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file.write(content)
            temp_filename = temp_file.name
        
        logger.info(f"Processing audio file: {temp_filename} (size: {len(content)} bytes)")
        
        # 使用 Whisper 進行語音辨識
        result = model.transcribe(temp_filename, language='zh')  # 指定中文以提高準確度
        transcript = result["text"].strip()
        
        logger.info(f"Transcription result: {transcript}")
        
        return jsonify({
            "transcript": transcript,
            "language": result.get("language", "zh"),
            "confidence": 1.0  # Whisper 不提供信心分數，設為1.0
        })
        
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        return jsonify({"error": f"語音辨識失敗: {str(e)}"}), 500
    finally:
        # 確保清理臨時檔案
        if temp_filename and os.path.exists(temp_filename):
            try:
                os.unlink(temp_filename)
            except Exception as e:
                logger.warning(f"Failed to delete temp file: {e}")

if __name__ == '__main__':
    # 使用生產配置
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True, use_reloader=False) 