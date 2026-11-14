"""Picks the configured provider. Tests monkeypatch `get_provider` with a fake."""
from app import config
from app.llm.base import LLMError, LLMProvider


def get_provider() -> LLMProvider:
    name = config.llm_provider()
    if name == "gemini":
        from app.llm import gemini
        return gemini.build()
    raise LLMError("LLM_NOT_CONFIGURED", f"Unknown LLM_PROVIDER '{name}'. Supported: gemini.")


def get_local_provider() -> LLMProvider:
    """The offline embedder used by the backup index. It cannot write answers."""
    from app.llm import local
    return local.build()


def get_backup_llm_provider() -> LLMProvider:
    """Backup writer for Ask Autara (needs BACKUP_LLM_API_KEY). It cannot embed."""
    from app.llm import openai_compat
    return openai_compat.build()
