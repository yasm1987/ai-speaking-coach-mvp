from __future__ import annotations

import httpx

from app.core import get_settings
from app.services.llm.base import BaseLLM


class QwenLLM(BaseLLM):
    """Alibaba Cloud Bailian / Qwen adapter using OpenAI-compatible chat completions."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def generate(self, prompt: str) -> str:
        if not self.settings.qwen_api_key:
            raise RuntimeError("QWEN_API_KEY is not configured.")

        prompt_lower = prompt.lower()
        if "study report" in prompt_lower or "session_data" in prompt_lower:
            max_tokens = 420
        elif "live speaking-practice dialogue" in prompt_lower or "/tutor/chat" in prompt_lower:
            max_tokens = 260
        else:
            max_tokens = 700

        response = httpx.post(
            self.settings.qwen_base_url,
            headers={
                "Authorization": f"Bearer {self.settings.qwen_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.settings.qwen_model,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are an AI speaking tutor service for Chinese children learning English. "
                            "For live practice and dialogue, speak in simple English. "
                            "For correction explanations and study reports, use Simplified Chinese while keeping English examples in English. "
                            "Return concise, usable output."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
                "max_tokens": max_tokens,
            },
            timeout=18.0,
        )
        response.raise_for_status()
        payload = response.json()
        return payload["choices"][0]["message"]["content"]
