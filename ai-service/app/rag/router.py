from fastapi import APIRouter, HTTPException

from app.llm.base import LLMError
from app.rag import ingest as ingest_module
from app.rag import store

router = APIRouter()


@router.post("/ingest")
def ingest_endpoint(reset: bool = False) -> dict:
    """Same as `python -m app.rag.ingest`. Only reads ai-service/knowledge/."""
    try:
        report = ingest_module.ingest(reset=reset)
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=f"{exc.code}: {exc}")
    return {
        "filesIngested": report.files_ingested, "chunksTotal": report.chunks_total,
        "chunksAdded": report.chunks_added, "chunksRemoved": report.chunks_removed,
        "warnings": report.warnings, "indexSize": store.corpus_size(),
    }


@router.get("/corpus")
def corpus() -> dict:
    return {"indexSize": store.corpus_size()}
