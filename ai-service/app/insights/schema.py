"""Pydantic models: what Node sends (evidence) and what the LLM must return (insight)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class _Strict(BaseModel):
    # extra="forbid": an unexpected field (e.g. someone adding childName) is a 422, not silently used.
    model_config = ConfigDict(extra="forbid")


# ── Request: the MINIMUM evidence Node sends (no names, age in months only) ──────────────────────
class AnswerEvidence(_Strict):
    item: int = Field(ge=1, le=20)
    text: str
    answer: Literal["yes", "no"]
    flagged: bool


class DomainEvidence(_Strict):
    domain: str
    label: str
    atRiskCount: int
    totalItems: int


class ScreeningEvidence(_Strict):
    id: str
    instrument: str = "MCHAT-R"
    childAgeMonths: int
    riskScore: int
    riskTier: Literal["low", "medium", "high"]
    atRiskItems: list[int]
    answers: list[AnswerEvidence]
    domainBreakdown: list[DomainEvidence]


class LogEvidence(_Strict):
    id: str
    occurredAt: str
    antecedent: str
    behaviour: str
    consequence: str
    intensity: int = Field(ge=1, le=5)
    durationMinutes: int | None = None
    setting: str = "home"
    notes: str = ""

    @field_validator("notes")
    @classmethod
    def _short_notes(cls, v: str) -> str:
        return v[:200]  # defensive cap; Node truncates too


class BehaviourEvidence(_Strict):
    summary: dict = Field(default_factory=dict)
    recentLogs: list[LogEvidence] = Field(default_factory=list, max_length=20)


class InsightRequest(_Strict):
    screening: ScreeningEvidence
    behaviour: BehaviourEvidence = Field(default_factory=BehaviourEvidence)


# ── LLM output (validated) ───────────────────────────────────────────────────────────────────────
class EvidenceRef(_Strict):
    type: Literal["screening_response", "behaviour_log"]
    id: str


class Reference(_Strict):
    source: str
    page: int | None = None
    section: str | None = None


class FlaggedArea(_Strict):
    area: str = Field(min_length=1)
    explanation: str = Field(min_length=1)
    evidence: list[EvidenceRef] = Field(min_length=1)   # every claim must cite evidence
    references: list[Reference] = Field(default_factory=list)


class InsightOut(_Strict):
    summary: str = Field(min_length=1)
    caregiverSummary: str = Field(min_length=1)
    flaggedAreas: list[FlaggedArea]
    uncertainty: str

    def all_text(self) -> str:
        parts = [self.summary, self.caregiverSummary, self.uncertainty]
        for f in self.flaggedAreas:
            parts += [f.area, f.explanation]
        return "\n".join(parts)


class InsightResponse(BaseModel):
    status: Literal["generated", "failed"]
    insight: dict | None = None
    model: str = ""
    promptVersion: str = ""
    retrievedChunkIds: list[str] = Field(default_factory=list)
    failureReasons: list[str] = Field(default_factory=list)
    readingGrade: float | None = None
    clinicalReviewRequired: bool = True
