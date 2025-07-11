#!/usr/bin/env python3
"""
GPU 優化啟動腳本 for BreezyVoice TTS
"""
import os
import torch
import uvicorn
from api import app

def setup_gpu_optimization():
    """設置 GPU 優化參數"""
    if torch.cuda.is_available():
        print("正在設置 GPU 優化...")
        
        # 設置 GPU 內存策略
        torch.cuda.empty_cache()
        
        # 啟用 cuDNN 基準測試以提高性能
        torch.backends.cudnn.benchmark = True
        
        # 設置 GPU 內存分配策略
        os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:512'
        
        # 設置 Transformers 快取
        os.environ['TRANSFORMERS_CACHE'] = '/app/hf_cache'
        os.environ['HF_HOME'] = '/app/hf_cache'
        
        # 顯示 GPU 信息
        gpu_count = torch.cuda.device_count()
        for i in range(gpu_count):
            gpu_name = torch.cuda.get_device_name(i)
            gpu_memory = torch.cuda.get_device_properties(i).total_memory / (1024**3)
            print(f"GPU {i}: {gpu_name} ({gpu_memory:.2f} GB)")
        
        print("GPU 優化設置完成")
    else:
        print("未檢測到 GPU，將使用 CPU")

def main():
    """主啟動函數"""
    print("正在啟動 BreezyVoice TTS 服務...")
    
    # 設置 GPU 優化
    setup_gpu_optimization()
    
    # 設置服務參數
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 8000))
    
    print(f"服務將在 {host}:{port} 上啟動")
    
    # 啟動 FastAPI 服務
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
        access_log=True,
        reload=False,  # 生產環境中禁用重載
        workers=1  # 使用單個 worker 以避免 GPU 內存衝突
    )

if __name__ == "__main__":
    main()
