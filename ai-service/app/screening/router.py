"""HTTP layer for screening: POST /screen and GET /instrument."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.screening import mchatr
from ml.inference import predict_probability

router = APIRouter()


class ScreenRequest(BaseModel):
    # JSON object keys are strings; pydantic converts "7" → 7. Values are validated in score_answers.
    answers: dict[int, str] = Field(..., description="item number (1–20) → 'yes' | 'no'")


class DomainResult(BaseModel):
    domain: str
    label: str
    atRiskCount: int
    totalItems: int


class ScreenResponse(BaseModel):
    riskScore: int
    riskTier: str
    atRiskItems: list[int]
    domainBreakdown: list[DomainResult]
    modelProbability: float | None
    modelVersion: str


@router.post("/screen", response_model=ScreenResponse)
def screen(req: ScreenRequest) -> dict:
    try:
        result = mchatr.score_answers(req.answers)
        probability, version = predict_probability(mchatr.normalise_answers(req.answers))
    except mchatr.AnswersError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    # The rule-based tier is authoritative; the model probability is informational only.
    return {**result, "modelProbability": probability, "modelVersion": version}


@router.get("/instrument")
def instrument() -> dict:
    return mchatr.instrument_definition()
