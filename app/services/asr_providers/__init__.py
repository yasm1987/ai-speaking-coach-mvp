from __future__ import annotations

from app.core import get_settings
from app.services.asr_providers.base import BaseASRProvider
from app.services.asr_providers.mock import MockASRProvider
from app.services.asr_providers.tencent import TencentASRProvider


def get_asr_provider(provider: str | None = None) -> BaseASRProvider:
    settings = get_settings()
    provider_key = (provider or settings.asr_provider).lower()

    try:
        if provider_key == "tencent":
            return TencentASRProvider()
        return MockASRProvider()
    except Exception:
        if settings.use_mock_fallback and provider_key != "mock":
            return MockASRProvider()
        raise
