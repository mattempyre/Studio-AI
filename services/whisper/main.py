"""
Whisper Transcription Service

FastAPI microservice for audio transcription with word-level timestamps.
Uses faster-whisper (CTranslate2) for efficient CPU/GPU inference.
"""

import os
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from faster_whisper import WhisperModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "base")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")  # "cpu" or "cuda"
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")  # int8, float16, float32

# Initialize app
app = FastAPI(
    title="Whisper Transcription Service",
    description="Audio transcription with word-level timestamps",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model (loaded on startup)
model: Optional[WhisperModel] = None


class TranscribeRequest(BaseModel):
    """Request body for transcription endpoint."""
    audio_path: str = Field(..., description="Path to audio file (WAV format)")
    language: Optional[str] = Field(default="en", description="Language code (e.g., 'en', 'es')")


class WordTiming(BaseModel):
    """Word-level timing information."""
    word: str
    start: float  # seconds
    end: float  # seconds
    probability: float


class SegmentTiming(BaseModel):
    """Segment-level timing information."""
    id: int
    text: str
    start: float  # seconds
    end: float  # seconds
    words: list[WordTiming]


class TranscribeResponse(BaseModel):
    """Response body for transcription endpoint."""
    text: str
    language: str
    duration: float  # seconds
    segments: list[SegmentTiming]
    words: list[WordTiming]  # Flattened word list for easy sentence alignment


@app.on_event("startup")
async def load_model():
    """Load Whisper model on startup."""
    global model
    logger.info(f"Loading Whisper model: {MODEL_SIZE} on {DEVICE} with {COMPUTE_TYPE}")
    model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    logger.info("Model loaded successfully")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "model": MODEL_SIZE,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
    }


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(request: TranscribeRequest):
    """
    Transcribe audio file with word-level timestamps.

    The audio file must be accessible at the specified path.
    Returns full transcription with word-level timing for sentence alignment.
    """
    global model

    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    audio_path = Path(request.audio_path)
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail=f"Audio file not found: {request.audio_path}")

    logger.info(f"Transcribing: {request.audio_path}")

    try:
        # Transcribe with word-level timestamps
        segments_generator, info = model.transcribe(
            str(audio_path),
            language=request.language,
            word_timestamps=True,
            vad_filter=True,  # Voice activity detection for better accuracy
        )

        # Collect all segments and words
        segments: list[SegmentTiming] = []
        all_words: list[WordTiming] = []
        full_text_parts: list[str] = []

        for segment in segments_generator:
            segment_words: list[WordTiming] = []

            if segment.words:
                for word in segment.words:
                    word_timing = WordTiming(
                        word=word.word.strip(),
                        start=round(word.start, 3),
                        end=round(word.end, 3),
                        probability=round(word.probability, 3),
                    )
                    segment_words.append(word_timing)
                    all_words.append(word_timing)

            segments.append(SegmentTiming(
                id=segment.id,
                text=segment.text.strip(),
                start=round(segment.start, 3),
                end=round(segment.end, 3),
                words=segment_words,
            ))
            full_text_parts.append(segment.text.strip())

        full_text = " ".join(full_text_parts)

        logger.info(f"Transcription complete: {len(all_words)} words, {info.duration:.2f}s")

        return TranscribeResponse(
            text=full_text,
            language=info.language,
            duration=round(info.duration, 3),
            segments=segments,
            words=all_words,
        )

    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8005))
    uvicorn.run(app, host="0.0.0.0", port=port)
