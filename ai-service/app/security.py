"""Shared-secret check for every non-health endpoint."""
import hmac

from fastapi import Header, HTTPException

from app import config


def require_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    """FastAPI dependency: only the Node backend (which knows AI_SERVICE_KEY) may call us.

    Fails closed: if AI_SERVICE_KEY is not configured, every request is refused.
    hmac.compare_digest avoids leaking the key through response-time differences.
    """
    expected = config.internal_key()
    if not expected:
        raise HTTPException(status_code=503, detail="AI service is not configured (AI_SERVICE_KEY missing).")
    if not x_internal_key or not hmac.compare_digest(x_internal_key, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing X-Internal-Key.")
