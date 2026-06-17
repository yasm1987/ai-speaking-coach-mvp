from __future__ import annotations

from abc import ABC, abstractmethod


class BaseTTSProvider(ABC):
    @abstractmethod
    async def synthesize(
        self,
        text: str,
        voice_type: str | None = None,
        speed_ratio: float | None = None,
    ) -> dict[str, str]:
        raise NotImplementedError
