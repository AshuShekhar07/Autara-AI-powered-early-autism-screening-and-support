"""Generate an insight: retrieve → prompt → LLM → validate → (retry once) → result."""
from __future__ import annotations

import json

from app import config
from app.insights.schema import InsightRequest, InsightResponse
from app.insights.validator import evidence_ids, reading_grade, validate_insight
from app.llm.base import LLMError
from app.rag import retriever
from app.rag.retriever import Chunk

PROMPT_NAME = "insight_v1"

NO_REFERENCE_NOTE = (
    "No reference material was available when this was generated, so this explanation is based only on "
    "the recorded screening answers and behaviour logs."
)


def load_prompt(name: str = PROMPT_NAME) -> str:
    return (config.prompts_dir() / f"{name}.txt").read_text(encoding="utf-8")


def _flagged_areas(req: InsightRequest) -> list[str]:
    return [d.label for d in req.screening.domainBreakdown if d.atRiskCount > 0]


def _patterns(req: InsightRequest) -> list[str]:
    top = req.behaviour.summary.get("topPairs") or []
    return [f"{p.get('antecedent')} then {p.get('behaviour')}" for p in top[:3]]


def build_user_prompt(req: InsightRequest, chunks: list[Chunk]) -> str:
    """Explicit and readable: evidence as JSON, then numbered reference chunks (or an explicit 'none')."""
    evidence = {
        "screening": req.screening.model_dump(),
        "behaviour": {"summary": req.behaviour.summary, "recentLogs": [l.model_dump() for l in req.behaviour.recentLogs]},
    }
    if chunks:
        ref_block = "\n\n".join(
            f"[R{i}] Source: {c.label()}\nSource title (use exactly in \"source\"): {c.source}\nPage: {c.page}\n---\n{c.text}"
            for i, c in enumerate(chunks, 1)
        )
    else:
        ref_block = "NONE — no reference material is available. Use empty \"references\" lists."
    return (
        "PATIENT EVIDENCE (JSON):\n" + json.dumps(evidence, ensure_ascii=False, indent=1)
        + "\n\nRETRIEVED REFERENCE MATERIAL:\n" + ref_block
        + "\n\nWrite the JSON object now."
    )


def generate_insight(req: InsightRequest, provider=None, retrieve=None) -> InsightResponse:
    from app.llm.factory import get_provider

    retrieve = retrieve or retriever.retrieve
    system = load_prompt()
    fail = lambda reasons, chunks=(), model="": InsightResponse(   # noqa: E731
        status="failed", model=model, promptVersion=PROMPT_NAME,
        retrievedChunkIds=[c.id for c in chunks], failureReasons=reasons)

    try:
        provider = provider or get_provider()
        query = retriever.build_query(_flagged_areas(req), _patterns(req))
        chunks = retrieve(query)
    except LLMError as exc:
        return fail([exc.code])

    allowed = evidence_ids(req)
    user = build_user_prompt(req, chunks)
    reasons: list[str] = []

    for attempt in range(2):  # first try + ONE retry
        prompt = user if attempt == 0 else (
            user + "\n\nYour previous answer was rejected for these reasons: " + "; ".join(reasons)
            + ". Return corrected JSON that follows every rule."
        )
        try:
            raw = provider.generate_json(system, prompt)
        except LLMError as exc:
            return fail([exc.code], chunks, provider.model)
        insight, reasons = validate_insight(raw, allowed, chunks)
        if insight is not None:
            out = insight.model_dump()
            if not chunks:
                out["flaggedAreas"] = [{**a, "references": []} for a in out["flaggedAreas"]]
                if NO_REFERENCE_NOTE not in out["uncertainty"]:
                    out["uncertainty"] = f'{out["uncertainty"].strip()} {NO_REFERENCE_NOTE}'
            return InsightResponse(
                status="generated", insight=out, model=provider.model, promptVersion=PROMPT_NAME,
                retrievedChunkIds=[c.id for c in chunks], readingGrade=reading_grade(insight.caregiverSummary),
            )
    return fail(reasons, chunks, provider.model)
