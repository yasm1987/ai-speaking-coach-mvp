from __future__ import annotations

from abc import ABC, abstractmethod


class BaseASRProvider(ABC):
    @abstractmethod
    async def recognize(self, filename: str, audio_bytes: bytes, content_type: str | None = None) -> str:
        raise NotImplementedError
