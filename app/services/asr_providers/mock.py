from __future__ import annotations

from app.services.asr_providers.base import BaseASRProvider


class MockASRProvider(BaseASRProvider):
    async def recognize(self, filename: str, audio_bytes: bytes, content_type: str | None = None) -> str:
        lower_name = filename.lower()
        if "milk" in lower_name:
            return "I don't like milk."
        if "banana" in lower_name or "fruit" in lower_name:
            return "I like bananas."
        if "apple" in lower_name:
            return "I like apples."
        return "This is a mock ASR transcript."
