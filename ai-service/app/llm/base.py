"""The small provider interface the rest of the service depends on.

Only two capabilities are needed, so swapping Gemini for OpenAI later means writing one more
class with these two methods — nothing else changes.
"""
from __future__ import annotations

from typing import Literal, Protocol

EmbedKind = Literal["document", "query"]


class LLMError(Exception):
    """Any provider failure (missing key, network, quota, bad response)."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code  # LLM_NOT_CONFIGURED | LLM_ERROR | EMBEDDING_ERROR


class LLMProvider(Protocol):
    name: str
    model: str

    def generate_json(self, system: str, user: str) -> str:
        """Returns the model's raw text, asked to be a single JSON object. Raises LLMError."""

    def embed(self, texts: list[str], kind: EmbedKind) -> list[list[float]]:
        """One vector per text. `kind` selects document vs query mode where the API supports it."""
