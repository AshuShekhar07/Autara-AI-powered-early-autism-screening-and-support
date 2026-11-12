"""Local, offline embedder for the backup ("sources-only") mode of Ask Autara.

Uses the small sentence model that ChromaDB already ships (all-MiniLM-L6-v2, ONNX, 384 numbers per text).
No API key, no quota, nothing leaves the machine. The model file (~80 MB) is downloaded once, on first use,
into ~/.cache/chroma. It only does embeddings; it cannot write answers.
"""
from __future__ import annotations

from app.llm.base import EmbedKind, LLMError

BATCH = 64


class LocalProvider:
    name = "local"
    model = "local-minilm"

    def __init__(self, embedder=None):
        self._embedder = embedder   # injectable for tests

    def _fn(self):
        if self._embedder is None:
            from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
            self._embedder = DefaultEmbeddingFunction()
        return self._embedder

    def embed(self, texts: list[str], kind: EmbedKind) -> list[list[float]]:
        out: list[list[float]] = []
        try:
            fn = self._fn()
            for i in range(0, len(texts), BATCH):
                out.extend([float(x) for x in vec] for vec in fn(texts[i : i + BATCH]))
        except Exception as exc:  # noqa: BLE001 - download failure, corrupt cache, missing onnxruntime…
            raise LLMError("EMBEDDING_ERROR", f"Local embedding failed: {type(exc).__name__}: {str(exc)[:200]}") from exc
        return out

    def generate_json(self, system: str, user: str) -> str:
        raise LLMError("LLM_ERROR", "The local provider only embeds text; it cannot write answers.")


def build() -> LocalProvider:
    return LocalProvider()
