"""Settings read from environment variables (see ai-service/.env.example).

Kept as a tiny plain module on purpose: os.environ lookups are easy to read and explain.
Values are read lazily through functions so tests can change the environment.
"""
import os

from dotenv import load_dotenv

load_dotenv()  # reads ai-service/.env if present; real env vars win


def internal_key() -> str:
    """Shared secret Node must send in the X-Internal-Key header. Empty = misconfigured."""
    return os.environ.get("AI_SERVICE_KEY", "")


def host() -> str:
    return os.environ.get("AI_HOST", "127.0.0.1")  # internal only by default


def port() -> int:
    return int(os.environ.get("AI_PORT", "8000"))
