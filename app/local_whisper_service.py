#!/usr/bin/env python3
from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import tempfile
import os
import logging

# 設置日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 載入 Whisper 模型 - 從環境變數讀取模型名稱
WHISPER_MODEL = os.getenv('WHISPER_MODEL', 'small')
logger.info(f"🚀 啟動 Whisper 語音辨識服務")
logger.info(f"🧠 正在載入 Whisper {WHISPER_MODEL} 模型...")
model = whisper.load_model(WHISPER_MODEL)
logger.info(f"✅ Whisper {WHISPER_MODEL} 模型載入成功!")
logger.info(f"🌐 支援語言: 中文 (zh)")
logger.info(f"📊 模型參數: temperature=0.0, beam_size=1")

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health_check():
    """健康檢查端點"""
    logger.info("💊 健康檢查請求")
    response = {"status": "healthy", "model": f"whisper-{WHISPER_MODEL}", "language": "zh"}
    logger.info(f"💊 健康檢查響應: {response}")
    return jsonify(response)

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    """語音辨識端點"""
    temp_filename = None
    try:
        logger.info("=== 開始處理轉錄請求 ===")
        logger.info(f"Request headers: {dict(request.headers)}")
        logger.info(f"Request files: {list(request.files.keys())}")
        
        # 檢查是否有上傳的檔案
        if 'audio' not in request.files:
            logger.error("❌ 請求中沒有找到 'audio' 檔案")
            return jsonify({"error": "沒有找到音訊檔案"}), 400
        
        audio_file = request.files['audio']
        logger.info(f"📁 收到音頻檔案: {audio_file.filename}")
        logger.info(f"📁 檔案類型: {audio_file.content_type}")
        
        if audio_file.filename == '':
            logger.error("❌ 檔案名稱為空")
            return jsonify({"error": "沒有選擇檔案"}), 400
        
        # 檢查檔案大小
        content = audio_file.read()
        file_size = len(content)
        logger.info(f"📏 檔案大小: {file_size} bytes ({file_size/1024:.1f} KB)")
        
        if file_size > 5 * 1024 * 1024:
            logger.error(f"❌ 檔案過大: {file_size} bytes")
            return jsonify({"error": "音訊檔案過大，請限制在 5MB 以內"}), 400
        
        # 創建臨時檔案
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file.write(content)
            temp_filename = temp_file.name
        
        logger.info(f"💾 創建臨時檔案: {temp_filename}")
        logger.info(f"🔄 開始使用 Whisper {WHISPER_MODEL} 模型進行語音辨識...")
        
        # 使用 Whisper 進行語音辨識，強制指定中文
        import time
        start_time = time.time()
        
        result = model.transcribe(
            temp_filename, 
            language='zh',  # 強制使用中文
            initial_prompt="以下是繁體中文語音：",  # 更具體的提示
            temperature=0.0,  # 降低隨機性，提高一致性
            best_of=1,
            beam_size=1,
            word_timestamps=False  # 關閉詞級時間戳以提高速度
        )
        
        processing_time = time.time() - start_time
        transcript = result["text"].strip()
        
        logger.info(f"⏱️  處理時間: {processing_time:.2f} 秒")
        logger.info(f"🗣️  原始結果: '{result['text']}'")
        logger.info(f"✂️  清理後結果: '{transcript}'")
        logger.info(f"📊 結果長度: {len(transcript)} 字符")
        logger.info(f"🌐 檢測語言: {result.get('language', 'unknown')}")
        
        if transcript:
            logger.info("✅ 轉錄成功")
        else:
            logger.warning("⚠️  轉錄結果為空 (可能是靜音或非語音音頻)")
        
        response_data = {
            "transcript": transcript,
            "language": "zh",
            "confidence": 1.0
        }
        
        logger.info(f"📤 返回響應: {response_data}")
        logger.info("=== 轉錄請求處理完成 ===")
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"❌ 轉錄錯誤: {str(e)}")
        logger.error(f"❌ 錯誤類型: {type(e).__name__}")
        import traceback
        logger.error(f"❌ 完整錯誤堆疊:\n{traceback.format_exc()}")
        return jsonify({"error": f"語音辨識失敗: {str(e)}"}), 500
    finally:
        # 清理臨時檔案
        if temp_filename and os.path.exists(temp_filename):
            try:
                os.unlink(temp_filename)
                logger.info(f"🗑️  已清理臨時檔案: {temp_filename}")
            except Exception as e:
                logger.warning(f"⚠️  清理臨時檔案失敗: {e}")
        else:
            logger.info("🗑️  無臨時檔案需要清理")

if __name__ == '__main__':
    logger.info("🌟 啟動 Flask 伺服器...")
    logger.info("🌐 綁定地址: 0.0.0.0:5001")
    logger.info("🔗 健康檢查: http://localhost:5001/health")
    logger.info("🎙️  轉錄端點: http://localhost:5001/transcribe")
    logger.info("=" * 50)
    
    app.run(host='0.0.0.0', port=5001, debug=False) 