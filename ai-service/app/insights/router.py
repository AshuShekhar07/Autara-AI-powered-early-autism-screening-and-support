from fastapi import APIRouter

from app.insights.generator import generate_insight
from app.insights.schema import InsightRequest, InsightResponse

router = APIRouter()


@router.post("/insights", response_model=InsightResponse)
def insights(req: InsightRequest) -> InsightResponse:
    """Always 200: a rejected / failed generation is reported as status='failed' with reason codes."""
    return generate_insight(req)
