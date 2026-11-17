"""Backup WRITER for Ask Autara: any service that speaks the common "chat completions" API
(Groq, OpenRouter, Mistral, a local Ollama…), through plain HTTPS with httpx (no extra SDK).

The passages are found with the local offline index; this provider only writes the JSON answer under the same prompt and
the same validator as Gemini. It cannot embed (the local model does that). Settings: BACKUP_LLM_API_KEY / _BASE_URL / _MODEL.
"""
from __future__ import annotations

import time

import httpx

from app import config
from app.llm.base import EmbedKind, LLMError

_RETRY_STATUS = {429, 500, 502, 503, 504}
_RETRY_DELAYS = (2,)   # one short retry only; the backend stops waiting after 30 s


def _short_error(resp: httpx.Response) -> str:
    """HTTP status plus the service's own message (never the key: the key is only ever sent in the request header)."""
    detail = ""
    try:
        body = resp.json()
        msg = (body.get("message") or (body.get("error") or {}).get("message")) if isinstance(body, dict) else ""
        detail = f": {str(msg)[:200]}" if msg else ""
    except Exception:  # noqa: BLE001
        pass
    return f"HTTP {resp.status_code}{detail}"


def _rejects_json_mode(resp: httpx.Response) -> bool:
    """A 400 that complains about response_format / JSON mode: some services or models do not support it."""
    if resp.status_code not in (400, 422):
        return False
    text = resp.text.lower()
    return "response_format" in text or "json_object" in text or "json mode" in text


class OpenAICompatProvider:
    name = "backup-llm"

    def __init__(self, api_key: str, model: str, base_url: str, timeout_s: float, client: httpx.Client | None = None):
        self.model = model
        self._url = f"{base_url}/chat/completions"
        self._headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "Accept": "application/json"}
        self._timeout = timeout_s
        self._client = client or httpx.Client(timeout=timeout_s)

    def generate_json(self, system: str, user: str) -> str:
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,   # low: we want faithful, not creative
        }
        last = "no response"
        for delay in (*_RETRY_DELAYS, None):
            try:
                resp = self._client.post(self._url, headers=self._headers, json=payload, timeout=self._timeout)
                if _rejects_json_mode(resp) and "response_format" in payload:
                    payload = {k: v for k, v in payload.items() if k != "response_format"}   # the prompt already demands JSON
                    resp = self._client.post(self._url, headers=self._headers, json=payload, timeout=self._timeout)
            except httpx.HTTPError as exc:
                last = type(exc).__name__
            else:
                if resp.status_code == 200:
                    try:
                        return resp.json()["choices"][0]["message"]["content"] or ""
                    except (KeyError, IndexError, TypeError, ValueError) as exc:
                        raise LLMError("LLM_ERROR", f"The backup AI returned an unexpected reply ({type(exc).__name__}).") from exc
                last = _short_error(resp)
                if resp.status_code not in _RETRY_STATUS:
                    break
            if delay is None:
                break
            time.sleep(delay)
        raise LLMError("LLM_ERROR", f"Backup AI generation failed: {last}")

    def embed(self, texts: list[str], kind: EmbedKind) -> list[list[float]]:
        raise LLMError("EMBEDDING_ERROR", "The backup writer only writes answers; the local model finds the passages.")


def build(timeout_s: float | None = None) -> OpenAICompatProvider:
    key = config.backup_llm_api_key()
    if not key:
        raise LLMError("LLM_NOT_CONFIGURED", "BACKUP_LLM_API_KEY is not set.")
    return OpenAICompatProvider(key, config.backup_llm_model(), config.backup_llm_base_url(), timeout_s or config.backup_llm_timeout_s())
