"""Settings read from environment variables (see ai-service/.env.example).

Kept as a tiny plain module on purpose: os.environ lookups are easy to read and explain.
Values are read lazily through functions so tests can change the environment.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # reads ai-service/.env if present; real env vars win


def internal_key() -> str:
    """Shared secret Node must send in the X-Internal-Key header. Empty = misconfigured."""
    return os.environ.get("AI_SERVICE_KEY", "")


def host() -> str:
    return os.environ.get("AI_HOST", "127.0.0.1")  # internal only by default


def port() -> int:
    return int(os.environ.get("AI_PORT", "8000"))


# ── LLM provider (Gemini by default; the interface in app/llm/base.py lets OpenAI be added later) ──
def llm_provider() -> str:
    return os.environ.get("LLM_PROVIDER", "gemini")


def gemini_api_key() -> str:
    return os.environ.get("GEMINI_API_KEY", "")


def llm_model() -> str:
    # Generation model. Check https://ai.google.dev/gemini-api/docs/models for current names.
    return os.environ.get("LLM_MODEL", "gemini-3.5-flash")


def embedding_model() -> str:
    # Text embedding model. NOTE: changing it requires re-ingesting (vectors are not comparable across models).
    return os.environ.get("EMBEDDING_MODEL", "gemini-embedding-001")


def llm_timeout_ms() -> int:
    return int(os.environ.get("LLM_TIMEOUT_MS", "50000"))


# ── RAG ──
APP_ROOT = Path(__file__).resolve().parent.parent


def chroma_dir() -> Path:
    return Path(os.environ.get("CHROMA_DIR", APP_ROOT / "storage" / "chroma"))


def knowledge_dir() -> Path:
    return Path(os.environ.get("KNOWLEDGE_DIR", APP_ROOT / "knowledge"))


def prompts_dir() -> Path:
    return APP_ROOT / "prompts"


def rag_top_k() -> int:
    return int(os.environ.get("RAG_TOP_K", "5"))


def rag_min_similarity() -> float:
    # Cosine similarity below this is dropped. Tune with `python -m eval.run` once a corpus exists.
    return float(os.environ.get("RAG_MIN_SIMILARITY", "0.55"))
