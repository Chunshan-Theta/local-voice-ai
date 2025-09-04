import os
import logging

# 設置 NVIDIA GPU 環境變量
print("Setting up NVIDIA GPU environment before PyTorch import...")
os.environ.setdefault('CUDA_VISIBLE_DEVICES', os.environ.get('CUDA_VISIBLE_DEVICES', '0'))
os.environ.setdefault('PYTORCH_CUDA_ALLOC_CONF', os.environ.get('PYTORCH_CUDA_ALLOC_CONF', 'max_split_size_mb:512'))

print(f"Environment setup:")
print(f"  CUDA_VISIBLE_DEVICES: {os.environ.get('CUDA_VISIBLE_DEVICES')}")
print(f"  NVIDIA_VISIBLE_DEVICES: {os.environ.get('NVIDIA_VISIBLE_DEVICES')}")
print(f"  PYTORCH_CUDA_ALLOC_CONF: {os.environ.get('PYTORCH_CUDA_ALLOC_CONF')}")

from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import tempfile
import torch

# 設置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check GPU availability (NVIDIA CUDA support)
def check_gpu_availability():
    print("=== GPU Detection Diagnostics ===")
    
    # Check PyTorch build info
    print(f"PyTorch version: {torch.__version__}")
    if hasattr(torch.version, 'cuda') and torch.version.cuda is not None:
        print(f"CUDA version: {torch.version.cuda}")
        print("This is a CUDA build of PyTorch")
    else:
        print("No CUDA support detected in PyTorch")
    
    # Check basic CUDA availability
    print(f"torch.cuda.is_available(): {torch.cuda.is_available()}")
    print(f"torch.cuda.device_count(): {torch.cuda.device_count()}")
    
    # Check environment variables
    print("Environment variables:")
    for env_var in ['CUDA_VISIBLE_DEVICES', 'NVIDIA_VISIBLE_DEVICES', 'PYTORCH_CUDA_ALLOC_CONF']:
        value = os.environ.get(env_var, 'Not set')
        print(f"  {env_var}: {value}")
    
    # Try to manually detect GPUs using nvidia-smi
    try:
        import subprocess
        result = subprocess.run(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print("nvidia-smi GPU detection:")
            print(result.stdout)
        else:
            print("nvidia-smi failed:", result.stderr)
    except Exception as e:
        print(f"Failed to run nvidia-smi: {e}")
    
    # Try torch.cuda operations
    try:
        # Check if we have any GPU devices
        device_count = torch.cuda.device_count()
        print(f"Final device count: {device_count}")
        
        if device_count > 0:
            print(f"Found {device_count} GPU device(s)")
            # Test if we can actually use the GPU
            try:
                # Create a small tensor and move it to GPU
                test_tensor = torch.tensor([1.0], dtype=torch.float32)
                print(f"Created test tensor: {test_tensor}")
                
                # Try to move to CUDA
                gpu_tensor = test_tensor.to('cuda')
                print(f"Successfully moved tensor to GPU: {gpu_tensor}")
                
                # Test a simple operation
                result = gpu_tensor * 2
                print(f"GPU computation result: {result}")
                
                logger.info(f"GPU test successful, device count: {device_count}")
                return "cuda"
            except Exception as gpu_test_error:
                print(f"GPU test failed: {gpu_test_error}")
                logger.warning(f"GPU test failed: {gpu_test_error}")
                return "cpu"
        else:
            logger.info("No GPU devices found")
            return "cpu"
    except Exception as e:
        print(f"GPU detection error: {e}")
        logger.warning(f"GPU detection failed: {e}")
        return "cpu"
    finally:
        print("================================")

device = check_gpu_availability()
logger.info(f"Using device: {device}")

if device == "cuda":
    try:
        device_count = torch.cuda.device_count()
        current_device = torch.cuda.current_device()
        logger.info(f"GPU device count: {device_count}")
        logger.info(f"Current GPU device: {current_device}")
        
        # Try to get device properties
        if hasattr(torch.cuda, 'get_device_properties'):
            props = torch.cuda.get_device_properties(current_device)
            logger.info(f"GPU: {props.name} (Memory: {props.total_memory / 1024**3:.1f} GB)")
        
        # Check if this is CUDA enabled
        if hasattr(torch.version, 'cuda') and torch.version.cuda is not None:
            logger.info(f"CUDA version: {torch.version.cuda}")
        
    except Exception as e:
        logger.warning(f"Could not get detailed GPU info: {e}")

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
            # Check for NVIDIA CUDA
            if torch.cuda.is_available():
                gpu_available = True
                # Only try to get GPU name if we're not in a forked subprocess
                import multiprocessing
                if multiprocessing.current_process().name == 'MainProcess':
                    gpu_name = torch.cuda.get_device_name(0)
                else:
                    gpu_name = "NVIDIA GPU available (name check skipped in subprocess)"
            else:
                gpu_available = False
                gpu_name = "No GPU detected"
                
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
    # 設置 NVIDIA GPU 環境變量
    print("Setting up NVIDIA GPU environment...")
    os.environ['CUDA_VISIBLE_DEVICES'] = os.environ.get('CUDA_VISIBLE_DEVICES', '0')
    os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:512'
    
    # 顯示環境信息
    print("=== GPU Environment Information ===")
    print(f"CUDA_VISIBLE_DEVICES: {os.environ.get('CUDA_VISIBLE_DEVICES', 'Not set')}")
    print(f"NVIDIA_VISIBLE_DEVICES: {os.environ.get('NVIDIA_VISIBLE_DEVICES', 'Not set')}")
    print(f"PYTORCH_CUDA_ALLOC_CONF: {os.environ.get('PYTORCH_CUDA_ALLOC_CONF', 'Not set')}")
    
    # 檢測PyTorch和GPU
    print(f"PyTorch version: {torch.__version__}")
    if hasattr(torch.version, 'cuda') and torch.version.cuda is not None:
        print(f"CUDA version: {torch.version.cuda}")
        print("This is a CUDA build of PyTorch")
    else:
        print("No CUDA support detected in PyTorch")
    
    print(f"torch.cuda.is_available(): {torch.cuda.is_available()}")
    print(f"torch.cuda.device_count(): {torch.cuda.device_count()}")
    
    if torch.cuda.device_count() > 0:
        print(f"Current device: {torch.cuda.current_device()}")
        try:
            # Test GPU access
            test_tensor = torch.tensor([1.0]).to('cuda')
            print("GPU access test: PASSED")
            del test_tensor  # Clean up
        except Exception as e:
            print(f"GPU access test: FAILED - {e}")
    else:
        print("No GPU devices detected")
    
    print("===================================")
    
    # 使用單進程Flask配置避免GPU context問題
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=False, processes=1, use_reloader=False) 