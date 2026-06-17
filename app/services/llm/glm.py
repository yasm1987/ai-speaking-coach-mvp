from __future__ import annotations

import httpx

from app.core import get_settings
from app.services.llm.base import BaseLLM


class GLMLLM(BaseLLM):
    """Zhipu GLM adapter using the chat completions API."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def generate(self, prompt: str) -> str:
        if not self.settings.glm_api_key:
            raise RuntimeError("GLM_API_KEY is not configured.")

        response = httpx.post(
            self.settings.glm_base_url,
            headers={
                "Authorization": f"Bearer {self.settings.glm_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.settings.glm_model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an AI speaking tutor service. Return concise, usable output.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
            },
            timeout=30.0,
        )
        response.raise_for_status()
        payload = response.json()
        return payload["choices"][0]["message"]["content"]
