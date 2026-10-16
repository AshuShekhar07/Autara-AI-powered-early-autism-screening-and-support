"""Ask Autara: guardrails → retrieve → answer strictly from sources → validate → respond."""
from __future__ import annotations

import json
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app import safety
from app.assistant import guardrails
from app.insights.generator import load_prompt
from app.llm.base import LLMError
from app.rag import retriever
from app.rag.retriever import Chunk

PROMPT_NAME = "ask_v1"


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DomainContext(_Strict):
    label: str
    atRiskCount: int
    totalItems: int


class ChildContext(_Strict):
    """Only the latest REVIEWED screening's tier and flagged areas. No name, no dates, no free text."""
    riskTier: Literal["low", "medium", "high"]
    ageMonths: int | None = None
    domains: list[DomainContext] = Field(default_factory=list)


class AskRequest(_Strict):
    question: str = Field(min_length=1, max_length=500)
    context: ChildContext | None = None


class SourceOut(BaseModel):
    title: str
    publisher: str
    url: str
    version: str
    page: int | None = None
    section: str = ""


class AskResponse(BaseModel):
    answer: str
    sources: list[SourceOut] = Field(default_factory=list)   # always present (possibly empty)
    guardrail: str | None = None
    promptVersion: str = PROMPT_NAME
    model: str = ""


def _source(c: Chunk) -> SourceOut:
    return SourceOut(title=c.source, publisher=c.publisher, url=c.url, version=c.version, page=c.page, section=c.section)


def _user_prompt(req: AskRequest, chunks: list[Chunk]) -> str:
    ctx = ""
    if req.context:
        flagged = [f"{d.label}: {d.atRiskCount} of {d.totalItems} answers flagged" for d in req.context.domains if d.atRiskCount]
        ctx = ("CHILD CONTEXT (screening result only, not a diagnosis): questionnaire risk tier = "
               f"{req.context.riskTier}; " + ("; ".join(flagged) if flagged else "no areas flagged") + "\n\n")
    refs = "\n\n".join(f"[R{i}] {c.label()}\n{c.text}" for i, c in enumerate(chunks, 1))
    return f"{ctx}REFERENCE MATERIAL:\n{refs}\n\nQUESTION:\n{req.question}\n\nRespond with the JSON object now."


def _validate(raw: str, n_chunks: int) -> tuple[dict | None, str]:
    try:
        data = json.loads(raw.strip().removeprefix("```json").removesuffix("```").strip())
        answer = data["answer"]
        can = bool(data["canAnswer"])
        cites = data.get("citations", [])
        assert isinstance(answer, str) and isinstance(cites, list)
    except Exception:
        return None, "INVALID_JSON"
    valid_labels = {f"R{i}" for i in range(1, n_chunks + 1)}
    cites = [str(c).strip("[] ") for c in cites]
    if any(c not in valid_labels for c in cites):
        return None, "UNKNOWN_CITATION"
    if can and not cites:
        return None, "NO_CITATION"
    if safety.find_banned(answer):
        return None, "BANNED_PHRASE"
    if safety.DOSING_OUTPUT.search(answer):
        return None, "DOSING_CONTENT"
    return {"answer": answer.strip(), "canAnswer": can, "citations": cites}, ""


def ask(req: AskRequest, provider=None, retrieve=None) -> AskResponse:
    from app.llm.factory import get_provider

    blocked = guardrails.pre_check(req.question)
    if blocked:
        return AskResponse(answer=blocked[1], sources=[], guardrail=blocked[0])

    retrieve = retrieve or retriever.retrieve
    try:
        chunks = retrieve(req.question)   # returns [] for an empty corpus WITHOUT needing an API key
    except LLMError:
        return AskResponse(answer=guardrails.FAILED_MESSAGE, sources=[], guardrail="unavailable")

    if not chunks:
        from app.rag import store
        if store.corpus_size() == 0:
            return AskResponse(answer=guardrails.NO_SOURCES_MESSAGE, sources=[], guardrail="no_sources")
        return AskResponse(answer=guardrails.DONT_KNOW_MESSAGE, sources=[], guardrail="no_answer")

    try:
        provider = provider or get_provider()
    except LLMError:
        return AskResponse(answer=guardrails.FAILED_MESSAGE, sources=[], guardrail="unavailable")

    system = load_prompt(PROMPT_NAME)
    user = _user_prompt(req, chunks)
    reason = ""
    for attempt in range(2):
        prompt = user if attempt == 0 else user + f"\n\nYour previous answer was rejected ({reason}). Return corrected JSON."
        try:
            raw = provider.generate_json(system, prompt)
        except LLMError:
            return AskResponse(answer=guardrails.FAILED_MESSAGE, sources=[], guardrail="unavailable")
        parsed, reason = _validate(raw, len(chunks))
        if parsed:
            if not parsed["canAnswer"]:
                return AskResponse(answer=guardrails.DONT_KNOW_MESSAGE, sources=[], guardrail="no_answer", model=provider.model)
            cited = [chunks[int(c[1:]) - 1] for c in parsed["citations"]]
            unique = list({(c.source, c.page, c.section): c for c in cited}.values())
            return AskResponse(answer=parsed["answer"], sources=[_source(c) for c in unique], model=provider.model)
    return AskResponse(answer=guardrails.FAILED_MESSAGE, sources=[], guardrail="validation_failed", model=provider.model)
