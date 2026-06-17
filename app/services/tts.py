from __future__ import annotations

from app.services.tts_providers import get_tts_provider


async def synthesize_speech(
    text: str,
    voice_type: str | None = None,
    speed_ratio: float | None = None,
) -> dict[str, str]:
    """Synthesize AI teacher speech through the configured TTS provider."""
    provider = get_tts_provider()
    return await provider.synthesize(text=text, voice_type=voice_type, speed_ratio=speed_ratio)
