"""Google Gemini implementation of LLMProvider (google-genai SDK)."""
from __future__ import annotations

from app import config
from app.llm.base import EmbedKind, LLMError

_EMBED_BATCH = 100  # API limit per embed call


def _describe(exc: Exception) -> str:
    """Short, key-free description of an SDK error: type plus HTTP status/message when present."""
    code = getattr(exc, "code", None)
    msg = getattr(exc, "message", None) or ""
    detail = f" {code}" if code else ""
    if msg:
        detail += f": {str(msg)[:200]}"
    return f"{type(exc).__name__}{detail}"


class GeminiProvider:
    name = "gemini"

    def __init__(self, api_key: str, model: str, embedding_model: str, timeout_ms: int):
        from google import genai  # imported lazily so the service starts without the SDK configured
        from google.genai import types

        self._types = types
        self._client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=timeout_ms))
        self.model = model
        self.embedding_model = embedding_model

    def generate_json(self, system: str, user: str) -> str:
        try:
            resp = self._client.models.generate_content(
                model=self.model,
                contents=user,
                config=self._types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",  # ask for a single JSON object
                    temperature=0.2,                          # low: we want faithful, not creative
                ),
            )
            return resp.text or ""
        except Exception as exc:  # SDK raises many types; callers only need "it failed"
            raise LLMError("LLM_ERROR", f"Gemini generation failed: {_describe(exc)}") from exc

    def embed(self, texts: list[str], kind: EmbedKind) -> list[list[float]]:
        task = "RETRIEVAL_DOCUMENT" if kind == "document" else "RETRIEVAL_QUERY"
        out: list[list[float]] = []
        try:
            for i in range(0, len(texts), _EMBED_BATCH):
                resp = self._client.models.embed_content(
                    model=self.embedding_model,
                    contents=texts[i : i + _EMBED_BATCH],
                    config=self._types.EmbedContentConfig(task_type=task),
                )
                out.extend(list(e.values) for e in resp.embeddings)
        except Exception as exc:
            raise LLMError("EMBEDDING_ERROR", f"Gemini embedding failed: {_describe(exc)}") from exc
        return out


def build() -> GeminiProvider:
    key = config.gemini_api_key()
    if not key:
        raise LLMError("LLM_NOT_CONFIGURED", "GEMINI_API_KEY is not set.")
    return GeminiProvider(key, config.llm_model(), config.embedding_model(), config.llm_timeout_ms())
