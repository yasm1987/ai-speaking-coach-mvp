from __future__ import annotations

from app.core import get_settings
from app.services.llm.base import BaseLLM
from app.services.llm.glm import GLMLLM
from app.services.llm.mock import MockLLM
from app.services.llm.qwen import QwenLLM


def get_llm(provider: str | None = None) -> BaseLLM:
    settings = get_settings()
    provider_key = (provider or settings.llm_provider).lower()

    try:
        if provider_key == "qwen":
            return QwenLLM()
        if provider_key == "glm":
            return GLMLLM()
        return MockLLM()
    except Exception:
        if settings.use_mock_fallback and provider_key != "mock":
            return MockLLM()
        raise
