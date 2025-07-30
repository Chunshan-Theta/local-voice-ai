# OpenAI API Spec. Reference: https://platform.openai.com/docs/api-reference/audio/createSpeech

from contextlib import asynccontextmanager
from io import BytesIO
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor

import torchaudio
import torch
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from g2pw import G2PWConverter
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings

from cosyvoice.utils.file_utils import load_wav
from single_inference import CustomCosyVoice, get_bopomofo_rare


class Settings(BaseSettings):
    api_key: str = Field(
        default="", description="Specifies the API key used to authenticate the user."
    )

    model_path: str = Field(
        default="MediaTek-Research/BreezyVoice",
        description="Specifies the model used for speech synthesis.",
    )
    speaker_prompt_audio_path: str = Field(
        default="./data/example.wav",
        description="Specifies the path to the prompt speech audio file of the speaker.",
    )
    speaker_prompt_text_transcription: str = Field(
        default="親愛的，累了一天辛苦了。讓我們一起深呼吸，慢慢放鬆身心。",
        description="Specifies the transcription of the speaker prompt audio.",
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
    app.state.cosyvoice = CustomCosyVoice(app.state.settings.model_path)
    app.state.bopomofo_converter = G2PWConverter()
    app.state.prompt_speech_16k = load_wav(
        app.state.settings.speaker_prompt_audio_path, 16000
    )
    app.state.thread_pool = ThreadPoolExecutor()
    # GPU semaphore to control concurrent GPU access
    app.state.gpu_semaphore = asyncio.Semaphore(1)
    # Precompute and cache prompt embeddings
    print("Precomputing prompt embeddings...")
    app.state.cached_prompt_data = app.state.cosyvoice.precompute_prompt_embeddings(app.state.prompt_speech_16k)
    print("Prompt embeddings cached successfully")
    yield
    app.state.thread_pool.shutdown()
    del app.state.cosyvoice
    del app.state.bopomofo_converter
    del app.state.cached_prompt_data
    del app.state.thread_pool
    del app.state.gpu_semaphore


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
    start_time = time.time()
    
    # Run CPU-intensive operations in thread pool
    loop = asyncio.get_event_loop()
    
    async def process_tts():
        # CPU operations can run in parallel
        speaker_prompt_text_transcription = await loop.run_in_executor(
            request.app.state.thread_pool,
            request.app.state.cosyvoice.frontend.text_normalize_new,
            request.app.state.settings.speaker_prompt_text_transcription,
            False
        )
        
        content_to_synthesize = await loop.run_in_executor(
            request.app.state.thread_pool,
            request.app.state.cosyvoice.frontend.text_normalize_new,
            payload.input,
            False
        )
        
        speaker_prompt_text_transcription_bopomo = await loop.run_in_executor(
            request.app.state.thread_pool,
            get_bopomofo_rare,
            speaker_prompt_text_transcription,
            request.app.state.bopomofo_converter
        )

        content_to_synthesize_bopomo = await loop.run_in_executor(
            request.app.state.thread_pool,
            get_bopomofo_rare,
            content_to_synthesize,
            request.app.state.bopomofo_converter
        )
        
        # GPU operations need to be serialized
        async with request.app.state.gpu_semaphore:
            # Clear CUDA cache before inference
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            output = await loop.run_in_executor(
                request.app.state.thread_pool,
                request.app.state.cosyvoice.inference_zero_shot_no_normalize,
                content_to_synthesize_bopomo,
                speaker_prompt_text_transcription_bopomo,
                request.app.state.prompt_speech_16k,
            )
            
            # Move output to CPU immediately to free GPU memory
            if torch.cuda.is_available():
                output["tts_speech"] = output["tts_speech"].cpu()
                torch.cuda.empty_cache()
        
        audio_buffer = BytesIO()
        await loop.run_in_executor(
            request.app.state.thread_pool,
            lambda: torchaudio.save(audio_buffer, output["tts_speech"], 22050, format="wav")
        )
        audio_buffer.seek(0)
        return audio_buffer
    
    audio_buffer = await process_tts()
    
    # Calculate processing time and wait for double that time
    processing_time = time.time() - start_time
    
    return StreamingResponse(
        audio_buffer,
        media_type="audio/wav",
        headers={"Content-Disposition": "attachment; filename=output.wav"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=8080
    )