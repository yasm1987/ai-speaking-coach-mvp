from __future__ import annotations

from app.core import get_settings
from app.services.tts_providers.base import BaseTTSProvider
from app.services.tts_providers.mock import MockTTSProvider
from app.services.tts_providers.volc import VolcTTSProvider


def get_tts_provider(provider: str | None = None) -> BaseTTSProvider:
    settings = get_settings()
    provider_key = (provider or settings.tts_provider).lower()

    try:
        if provider_key in {"volc", "doubao"}:
            return VolcTTSProvider()
        return MockTTSProvider()
    except Exception:
        if settings.use_mock_fallback and provider_key != "mock":
            return MockTTSProvider()
        raise
