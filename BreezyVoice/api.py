# OpenAI API Spec. Reference: https://platform.openai.com/docs/api-reference/audio/createSpeech

from contextlib import asynccontextmanager
from io import BytesIO
import numpy as np
import soundfile as sf
import torch

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from transformers import pipeline


class Settings(BaseSettings):
    api_key: str = Field(
        default="", description="Specifies the API key used to authenticate the user."
    )

    model_path: str = Field(
        default="suno/bark",
        description="Specifies the model used for speech synthesis.",
    )
    
    # 支援中文的 TTS 模型選項
    sample_rate: int = Field(
        default=16000,
        description="Audio sample rate for output"
    )


class SpeechRequest(BaseModel):
    model: str = ""
    input: str = Field(
        description="The content that will be synthesized into speech. You can include phonetic symbols if needed, though they should be used sparingly.",
        examples=["今天天氣真好"],
    )
    response_format: str = ""
    speed: float = 1.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.settings = Settings()
    
    # 檢查 GPU 可用性並顯示詳細信息
    gpu_available = torch.cuda.is_available()
    if gpu_available:
        gpu_count = torch.cuda.device_count()
        gpu_name = torch.cuda.get_device_name(0)
        gpu_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3)  # GB
        print(f"GPU 可用: {gpu_count} 個 GPU")
        print(f"GPU 名稱: {gpu_name}")
        print(f"GPU 內存: {gpu_memory:.2f} GB")
        
        # 設置 GPU 內存策略
        torch.cuda.empty_cache()  # 清空 GPU 緩存
        if hasattr(torch.cuda, 'memory_fraction'):
            torch.cuda.set_per_process_memory_fraction(0.8)  # 使用 80% 的 GPU 內存
    else:
        print("GPU 不可用，將使用 CPU")
    
    # 設置設備和數據類型
    device = 0 if gpu_available else -1
    torch_dtype = torch.float16 if gpu_available else torch.float32
    
    # 初始化 Hugging Face TTS pipeline
    try:
        # 嘗試使用支援中文的 TTS 模型
        print(f"正在加載 TTS 模型: {app.state.settings.model_path}")
        app.state.tts_pipeline = pipeline(
            "text-to-speech",
            model=app.state.settings.model_path,
            device=device,
            torch_dtype=torch_dtype
        )
        print(f"成功加載 TTS 模型: {app.state.settings.model_path}")
        print(f"使用設備: {'GPU' if gpu_available else 'CPU'}")
        print(f"數據類型: {torch_dtype}")
    except Exception as e:
        print(f"加載主模型失敗，切換到備用模型 bark-small: {e}")
        # 備用模型：使用 bark-small 作為快速且小型的選項
        try:
            app.state.tts_pipeline = pipeline(
                "text-to-speech",
                model="suno/bark-small",
                device=device,
                torch_dtype=torch_dtype
            )
            app.state.settings.model_path = "suno/bark-small"
            print("成功加載備用模型: suno/bark-small")
            print(f"使用設備: {'GPU' if gpu_available else 'CPU'}")
        except Exception as e2:
            print(f"加載備用模型也失敗: {e2}")
            raise e2
    
    yield
    del app.state.tts_pipeline


app = FastAPI(lifespan=lifespan, root_path="/v1")


@app.get("/models")
async def get_models(request: Request):
    return {
        "object": "list",
        "data": [
            {
                "id": request.app.state.settings.model_path,
                "object": "model",
                "created": 0,
                "owned_by": "local",
            }
        ],
    }


@app.post("/audio/speech")
async def speach_endpoint(request: Request, payload: SpeechRequest):
    try:
        # 使用 Hugging Face pipeline 進行 TTS 推理
        with torch.no_grad():  # 節省 GPU 內存
            output = request.app.state.tts_pipeline(payload.input)
        
        # 處理不同模型的輸出格式
        if hasattr(output, 'audio'):
            # 對於某些模型，音頻在 .audio 屬性中
            audio_data = output.audio
            sample_rate = output.sampling_rate
        elif isinstance(output, dict):
            # 對於字典格式的輸出
            audio_data = output.get('audio', output.get('waveform'))
            sample_rate = output.get('sampling_rate', output.get('sample_rate', request.app.state.settings.sample_rate))
        else:
            # 直接是音頻數據
            audio_data = output
            sample_rate = request.app.state.settings.sample_rate
        
        # 確保音頻數據是 numpy 數組
        if torch.is_tensor(audio_data):
            audio_data = audio_data.cpu().numpy()
        
        # 確保音頻數據是正確的形狀
        if audio_data.ndim > 1:
            audio_data = audio_data.squeeze()
        
        # 正規化音頻數據到 [-1, 1] 範圍
        if audio_data.max() > 1.0 or audio_data.min() < -1.0:
            audio_data = audio_data / np.max(np.abs(audio_data))
        
        # 調整速度（如果需要）
        if payload.speed != 1.0:
            # 簡單的速度調整：重新採樣
            try:
                import librosa
                audio_data = librosa.effects.time_stretch(audio_data, rate=payload.speed)
            except ImportError:
                print("警告：librosa 未安裝，無法調整速度")
            except Exception as e:
                print(f"調整速度時發生錯誤: {e}")
        
        # 將音頻保存到 BytesIO 緩衝區
        audio_buffer = BytesIO()
        sf.write(audio_buffer, audio_data, sample_rate, format='WAV')
        audio_buffer.seek(0)
        
        # 清理 GPU 緩存（如果使用 GPU）
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        return StreamingResponse(
            audio_buffer,
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=output.wav"},
        )
    
    except Exception as e:
        print(f"Error in TTS synthesis: {e}")
        # 清理 GPU 緩存（如果使用 GPU）
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        # 返回錯誤響應
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(e)}")


@app.get("/gpu-status")
async def get_gpu_status():
    gpu_available = torch.cuda.is_available()
    if gpu_available:
        gpu_count = torch.cuda.device_count()
        gpu_name = torch.cuda.get_device_name(0)
        gpu_memory_total = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        gpu_memory_allocated = torch.cuda.memory_allocated(0) / (1024**3)
        gpu_memory_reserved = torch.cuda.memory_reserved(0) / (1024**3)
        
        return {
            "gpu_available": True,
            "gpu_count": gpu_count,
            "gpu_name": gpu_name,
            "gpu_memory_total_gb": round(gpu_memory_total, 2),
            "gpu_memory_allocated_gb": round(gpu_memory_allocated, 2),
            "gpu_memory_reserved_gb": round(gpu_memory_reserved, 2),
            "gpu_utilization": f"{(gpu_memory_allocated / gpu_memory_total) * 100:.1f}%"
        }
    else:
        return {
            "gpu_available": False,
            "message": "GPU not available, using CPU"
        }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api:app", host="0.0.0.0", port=8080)
