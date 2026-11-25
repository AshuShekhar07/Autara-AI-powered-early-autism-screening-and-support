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
    # Hosting platforms (Render, Railway, ...) tell the app which port to use in $PORT.
    return int(os.environ.get("AI_PORT") or os.environ.get("PORT") or "8000")


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


# ── Ask Autara backup ("sources-only" mode: local embeddings, no LLM, no key, no quota) ──
def ask_mode() -> str:
    """auto = Gemini, then the backup writer (if a key is set), then quoted passages | backup = skip Gemini completely
    (passages found offline, written by the backup writer, quoted passages if that fails) |
    local = quoted passages only, fully offline | gemini = Gemini only, no backup."""
    mode = os.environ.get("ASK_MODE", "auto").strip().lower()
    mode = "backup" if mode == "mistral" else mode      # old name
    return mode if mode in ("auto", "backup", "local", "gemini") else "auto"


def rag_backup_min_similarity() -> float:
    # The small local model scores lower than Gemini's for the same match, so it needs its own threshold.
    # Calibrate with:  python -m app.assistant.debug --local "your question"
    return float(os.environ.get("RAG_BACKUP_MIN_SIMILARITY", "0.30"))


def backup_max_passages() -> int:
    """How many passages the backup shows as quotes AND hands to the backup writer (fewer = fewer tokens, which keeps
    a free plan's per-minute token limit from being hit)."""
    return int(os.environ.get("ASK_BACKUP_MAX_PASSAGES", "3"))


# ── Backup writer: ANY service that speaks the common "chat completions" API (Groq, OpenRouter, Mistral, Ollama…).
# It only WRITES answers from passages found with the local offline index; it never embeds and never sees the child's context.
def _legacy_mistral() -> bool:
    return not os.environ.get("BACKUP_LLM_API_KEY") and bool(os.environ.get("MISTRAL_API_KEY"))


def backup_llm_api_key() -> str:
    return os.environ.get("BACKUP_LLM_API_KEY") or os.environ.get("MISTRAL_API_KEY", "")


def backup_llm_base_url() -> str:
    default = "https://api.mistral.ai/v1" if _legacy_mistral() else "https://api.groq.com/openai/v1"
    return (os.environ.get("BACKUP_LLM_BASE_URL") or os.environ.get("MISTRAL_BASE_URL") or default).rstrip("/")


def backup_llm_model() -> str:
    default = (os.environ.get("MISTRAL_MODEL") or "mistral-small-latest") if _legacy_mistral() else "llama-3.3-70b-versatile"
    return os.environ.get("BACKUP_LLM_MODEL") or default


def backup_llm_timeout_s() -> float:
    # short on purpose: the Node backend gives up on Ask after 30 s, and Gemini may already have used some of that
    return float(os.environ.get("BACKUP_LLM_TIMEOUT_MS") or os.environ.get("MISTRAL_TIMEOUT_MS") or "12000") / 1000


def ask_uses_backup_index() -> bool:
    """True when Ask Autara finds its passages with the offline local index (ASK_MODE backup or local)."""
    return ask_mode() in ("backup", "local")


def insights_mode() -> str:
    """Which AI writes clinician insights: gemini | backup (offline passages + the backup writer, e.g. Groq).
    Defaults to the same choice as Ask Autara: ASK_MODE=backup means insights use the backup writer too."""
    mode = os.environ.get("INSIGHTS_MODE", "").strip().lower()
    if mode in ("gemini", "backup"):
        return mode
    return "backup" if ask_mode() == "backup" else "gemini"


def insights_timeout_s() -> float:
    # insights are longer than answers and the Node backend waits up to 60 s for them
    return float(os.environ.get("INSIGHTS_LLM_TIMEOUT_MS", "40000")) / 1000
