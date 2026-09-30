"""Validate the LLM's insight JSON. Reject (→ one retry, then `failed`) when ANY check fails:

  1. not valid JSON / does not match the Insight schema
  2. an evidence id was not in the evidence we supplied
  3. a reference does not match a retrieved chunk
  4. any text matches a banned diagnostic pattern (app/safety.py)
  5. `uncertainty` is empty
"""
from __future__ import annotations

import json
import re

from pydantic import ValidationError

from app.insights.schema import InsightOut, InsightRequest
from app.rag.retriever import Chunk
from app.safety import find_banned


def evidence_ids(req: InsightRequest) -> dict[str, set[str]]:
    return {
        "screening_response": {str(a.item) for a in req.screening.answers},
        "behaviour_log": {log.id for log in req.behaviour.recentLogs},
    }


def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    m = re.match(r"^```(?:json)?\s*(.*?)\s*```$", raw, re.DOTALL)
    return m.group(1) if m else raw


def validate_insight(raw: str, allowed: dict[str, set[str]], chunks: list[Chunk]) -> tuple[InsightOut | None, list[str]]:
    """Returns (insight, []) when valid, else (None, [reason codes])."""
    try:
        data = json.loads(_strip_fences(raw))
    except (json.JSONDecodeError, TypeError):
        return None, ["INVALID_JSON"]
    try:
        insight = InsightOut.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in e["loc"]) for e in exc.errors()})[:5]
        return None, [f"SCHEMA_MISMATCH:{','.join(fields)}"]

    errors: list[str] = []

    if not insight.uncertainty.strip():
        errors.append("EMPTY_UNCERTAINTY")

    for area in insight.flaggedAreas:
        for ev in area.evidence:
            if ev.id not in allowed.get(ev.type, set()):
                errors.append(f"UNKNOWN_EVIDENCE_ID:{ev.type}:{ev.id}")

    known = {(c.source, c.page): c for c in chunks}
    known_sources = {c.source for c in chunks}
    for area in insight.flaggedAreas:
        for ref in area.references:
            if ref.source not in known_sources:
                errors.append(f"UNKNOWN_REFERENCE_SOURCE:{ref.source[:60]}")
            elif ref.page is not None and (ref.source, ref.page) not in known:
                errors.append(f"UNKNOWN_REFERENCE_PAGE:{ref.source[:40]}:{ref.page}")

    banned = find_banned(insight.all_text())
    if banned:
        errors.append("BANNED_PHRASE:" + ",".join(banned))

    return (None, errors) if errors else (insight, [])


def reading_grade(text: str) -> float | None:
    """Flesch–Kincaid grade level (rough): ~6 is the target for the caregiver summary."""
    words = re.findall(r"[A-Za-z']+", text)
    sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    if not words or not sentences:
        return None

    def syllables(w: str) -> int:
        w = w.lower()
        groups = re.findall(r"[aeiouy]+", w)
        n = len(groups) - (1 if w.endswith("e") and len(groups) > 1 else 0)
        return max(1, n)

    total_syll = sum(syllables(w) for w in words)
    grade = 0.39 * (len(words) / len(sentences)) + 11.8 * (total_syll / len(words)) - 15.59
    return round(grade, 1)
