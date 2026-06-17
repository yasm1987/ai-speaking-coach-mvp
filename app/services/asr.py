from __future__ import annotations

from fastapi import UploadFile

from app.services.asr_providers import get_asr_provider


async def recognize_audio_file(file: UploadFile) -> str:
    """Recognize learner speech through the configured ASR provider."""
    provider = get_asr_provider()
    audio_bytes = await file.read()
    return await provider.recognize(
        filename=file.filename or "upload.wav",
        audio_bytes=audio_bytes,
        content_type=file.content_type,
    )
