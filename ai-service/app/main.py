"""FastAPI entry point.

Run:  uvicorn app.main:app --host 127.0.0.1 --port 8000     (or: python -m app)
"""
from fastapi import Depends, FastAPI

from app.screening.router import router as screening_router
from app.security import require_internal_key

app = FastAPI(
    title="Autara AI service",
    description="Internal service. Screening aid only — never produces a diagnosis.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict:
    """Liveness probe. Public on purpose (docker healthcheck); reveals nothing sensitive."""
    return {"status": "ok", "service": "autara-ai-service"}


# Every business router is mounted with the internal-key dependency.
app.include_router(screening_router, dependencies=[Depends(require_internal_key)])
