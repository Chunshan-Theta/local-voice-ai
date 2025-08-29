import os
import logging

# 必須在導入 torch 之前設置 AMD GPU 環境變量
print("Setting up AMD GPU environment before PyTorch import...")
os.environ.setdefault('HIP_VISIBLE_DEVICES', os.environ.get('HIP_VISIBLE_DEVICES', '1'))
os.environ.setdefault('PYTORCH_HIP_ALLOC_CONF', 'max_split_size_mb:512')
os.environ.setdefault('HSA_OVERRIDE_GFX_VERSION', os.environ.get('HSA_OVERRIDE_GFX_VERSION', '12.0.1'))

print(f"Environment setup:")
print(f"  HIP_VISIBLE_DEVICES: {os.environ.get('HIP_VISIBLE_DEVICES')}")
print(f"  HSA_OVERRIDE_GFX_VERSION: {os.environ.get('HSA_OVERRIDE_GFX_VERSION')}")
print(f"  PYTORCH_HIP_ALLOC_CONF: {os.environ.get('PYTORCH_HIP_ALLOC_CONF')}")

from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import tempfile
import torch

# 設置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check GPU availability (AMD ROCm/HIP support)
def check_gpu_availability():
    print("=== GPU Detection Diagnostics ===")
    
    # Check PyTorch build info
    print(f"PyTorch version: {torch.__version__}")
    if hasattr(torch.version, 'hip') and torch.version.hip is not None:
        print(f"ROCm/HIP version: {torch.version.hip}")
        print("This is a ROCm build of PyTorch")
    else:
        print("This appears to be a CUDA build of PyTorch")
    
    # Force GPU initialization
    try:
        # Try to force HIP/ROCm initialization
        import subprocess
        result = subprocess.run(['python', '-c', 'import torch; torch.cuda.init()'], 
                              capture_output=True, text=True, timeout=10)
        print(f"CUDA init result: {result.returncode}")
        if result.stderr:
            print(f"CUDA init stderr: {result.stderr}")
    except Exception as e:
        print(f"Failed to force CUDA init: {e}")
    
    # Check basic CUDA availability
    print(f"torch.cuda.is_available(): {torch.cuda.is_available()}")
    print(f"torch.cuda.device_count(): {torch.cuda.device_count()}")
    
    # Check for GPU device files
    gpu_devices = ['/dev/kfd', '/dev/dri/card1', '/dev/dri/card2', '/dev/dri/renderD128', '/dev/dri/renderD129']
    print("GPU device file check:")
    for device in gpu_devices:
        exists = os.path.exists(device)
        if exists:
            try:
                stat_info = os.stat(device)
                print(f"  {device}: EXISTS (mode: {oct(stat_info.st_mode)})")
            except:
                print(f"  {device}: EXISTS (stat failed)")
        else:
            print(f"  {device}: NOT FOUND")
    
    # Check environment variables
    print("Environment variables:")
    for env_var in ['HIP_VISIBLE_DEVICES', 'CUDA_VISIBLE_DEVICES', 'HSA_OVERRIDE_GFX_VERSION', 'ROC_ENABLE_PRE_VEGA']:
        value = os.environ.get(env_var, 'Not set')
        print(f"  {env_var}: {value}")
    
    # Try to manually detect GPUs using rocm-smi
    try:
        import subprocess
        result = subprocess.run(['/opt/rocm/bin/rocm-smi', '--showid'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print("rocm-smi GPU detection:")
            print(result.stdout)
        else:
            print("rocm-smi failed:", result.stderr)
    except Exception as e:
        print(f"Failed to run rocm-smi: {e}")
    
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
        
        # Check if this is ROCm/HIP
        if hasattr(torch.version, 'hip') and torch.version.hip is not None:
            logger.info(f"ROCm/HIP version: {torch.version.hip}")
        
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
            # Check for AMD ROCm/HIP first
            if hasattr(torch.version, 'hip') and torch.version.hip is not None:
                gpu_available = True
                gpu_name = f"AMD GPU with ROCm/HIP {torch.version.hip}"
            # Then check for NVIDIA CUDA
            elif torch.cuda.is_available():
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
    # 設置 AMD GPU 環境變量（這些需要在 PyTorch 初始化之前設置）
    print("Setting up AMD GPU environment...")
    os.environ['HIP_VISIBLE_DEVICES'] = os.environ.get('HIP_VISIBLE_DEVICES', '1')
    os.environ['PYTORCH_HIP_ALLOC_CONF'] = 'max_split_size_mb:512'
    
    # 顯示環境信息
    print("=== GPU Environment Information ===")
    print(f"HIP_VISIBLE_DEVICES: {os.environ.get('HIP_VISIBLE_DEVICES', 'Not set')}")
    print(f"ROC_VISIBLE_DEVICES: {os.environ.get('ROC_VISIBLE_DEVICES', 'Not set')}")
    print(f"HSA_OVERRIDE_GFX_VERSION: {os.environ.get('HSA_OVERRIDE_GFX_VERSION', 'Not set')}")
    
    # 檢測PyTorch和GPU
    print(f"PyTorch version: {torch.__version__}")
    if hasattr(torch.version, 'hip') and torch.version.hip is not None:
        print(f"ROCm/HIP version: {torch.version.hip}")
        print("This is a ROCm build of PyTorch")
    else:
        print("This appears to be a CUDA build of PyTorch")
    
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