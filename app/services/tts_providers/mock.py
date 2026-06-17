from __future__ import annotations

from app.services.tts_providers.base import BaseTTSProvider


class MockTTSProvider(BaseTTSProvider):
    async def synthesize(
        self,
        text: str,
        voice_type: str | None = None,
        speed_ratio: float | None = None,
    ) -> dict[str, str]:
        return {
            "audio_base64": "",
            "audio_format": "mock",
            "provider": "mock",
            "voice_type": voice_type or "mock-teacher",
            "text": text,
        }
