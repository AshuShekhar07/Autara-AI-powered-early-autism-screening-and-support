"""Picks the configured provider. Tests monkeypatch `get_provider` with a fake."""
from app import config
from app.llm.base import LLMError, LLMProvider


def get_provider() -> LLMProvider:
    name = config.llm_provider()
    if name == "gemini":
        from app.llm import gemini
        return gemini.build()
    raise LLMError("LLM_NOT_CONFIGURED", f"Unknown LLM_PROVIDER '{name}'. Supported: gemini.")
