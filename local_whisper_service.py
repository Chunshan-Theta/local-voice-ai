#!/usr/bin/env python3
from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import tempfile
import os
import logging

# 設置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 載入 Whisper 模型 - 從環境變數讀取模型名稱
WHISPER_MODEL = os.getenv('WHISPER_MODEL', 'small')
logger.info(f"Loading Whisper {WHISPER_MODEL} model...")
model = whisper.load_model(WHISPER_MODEL)
logger.info(f"Whisper {WHISPER_MODEL} model loaded successfully!")

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health_check():
    """健康檢查端點"""
    return jsonify({"status": "healthy", "model": f"whisper-{WHISPER_MODEL}", "language": "zh"})

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    """語音辨識端點"""
    temp_filename = None
    try:
        logger.info("Received transcription request")
        
        # 檢查是否有上傳的檔案
        if 'audio' not in request.files:
            return jsonify({"error": "沒有找到音訊檔案"}), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({"error": "沒有選擇檔案"}), 400
        
        # 檢查檔案大小
        content = audio_file.read()
        if len(content) > 5 * 1024 * 1024:
            return jsonify({"error": "音訊檔案過大，請限制在 5MB 以內"}), 400
        
        # 創建臨時檔案
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file.write(content)
            temp_filename = temp_file.name
        
        logger.info(f"Processing audio file: {temp_filename} (size: {len(content)} bytes)")
        
        # 使用 Whisper 進行語音辨識，強制指定中文
        result = model.transcribe(
            temp_filename, 
            language='zh',  # 強制使用中文
            initial_prompt="以下是繁體中文語音：",  # 更具體的提示
            temperature=0.0,  # 降低隨機性，提高一致性
            best_of=1,
            beam_size=1,
            word_timestamps=False  # 關閉詞級時間戳以提高速度
        )
        transcript = result["text"].strip()
        
        logger.info(f"Transcription result: {transcript}")
        
        return jsonify({
            "transcript": transcript,
            "language": "zh",
            "confidence": 1.0
        })
        
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        return jsonify({"error": f"語音辨識失敗: {str(e)}"}), 500
    finally:
        # 清理臨時檔案
        if temp_filename and os.path.exists(temp_filename):
            try:
                os.unlink(temp_filename)
            except Exception as e:
                logger.warning(f"Failed to delete temp file: {e}")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False) 