from abc import ABC, abstractmethod


class BaseLLM(ABC):
    """Unified LLM interface for all model providers."""

    @abstractmethod
    def generate(self, prompt: str) -> str:
        raise NotImplementedError
