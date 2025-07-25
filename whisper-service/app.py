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

# Get Whisper model from environment variable
whisper_model = os.getenv("WHISPER_MODEL", "tiny")
logger.info(f"Whisper model configured: {whisper_model}")

# 在全局範圍載入模型，避免重複載入
logger.info(f"Loading Whisper model: {whisper_model}...")
model = whisper.load_model(whisper_model).to(device)
logger.info(f"Whisper {whisper_model} model loaded successfully!")

app = Flask(__name__)
CORS(app)  # 允許跨域請求

@app.route('/health', methods=['GET'])
def health_check():
    """健康檢查端點 - 快速返回，不依賴模型推理"""
    try:
        gpu_name = None
        gpu_available = False
        
        # Check GPU availability more safely in multiprocessing context
        try:
            gpu_available = torch.cuda.is_available()
            if gpu_available:
                # Only try to get GPU name if we're not in a forked subprocess
                import multiprocessing
                if multiprocessing.current_process().name == 'MainProcess':
                    gpu_name = torch.cuda.get_device_name(0)
                else:
                    gpu_name = "GPU available (name check skipped in subprocess)"
        except RuntimeError as e:
            if "CUDA" in str(e) and "forked subprocess" in str(e):
                logger.info("CUDA not accessible in forked subprocess - this is normal")
                gpu_available = device == "cuda"  # Use the device determined at startup
                gpu_name = "GPU available (CUDA context not available in subprocess)"
            else:
                logger.warning(f"Could not check GPU: {e}")
                gpu_name = "GPU status unknown"
        
        return jsonify({
            "status": "healthy", 
            "model": f"whisper-{whisper_model}",
            "device": device,
            "gpu_available": gpu_available,
            "gpu_name": gpu_name
        })
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({
            "status": "healthy", 
            "model": f"whisper-{whisper_model}",
            "device": device,
            "error": str(e)
        })

@app.route('/status', methods=['GET'])  
def quick_status():
    """快速狀態檢查 - 不做任何複雜操作"""
    return jsonify({
        "status": "alive",
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
    # 確保CUDA環境正確設置
    os.environ['CUDA_VISIBLE_DEVICES'] = '0'
    os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:512'
    
    print(f"PyTorch CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"CUDA device count: {torch.cuda.device_count()}")
        print(f"Current CUDA device: {torch.cuda.current_device()}")
        print(f"Device name: {torch.cuda.get_device_name(0)}")
    
    # 使用單進程Flask配置避免CUDA context問題
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=False, processes=1, use_reloader=False) 