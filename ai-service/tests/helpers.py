from app.insights.schema import InsightRequest
from app.rag.retriever import Chunk


def make_request(**over) -> InsightRequest:
    answers = [{"item": n, "text": f"Question {n}?", "answer": "no" if n in (1, 7) else "yes", "flagged": n in (1, 7)} for n in range(1, 21)]
    data = {
        "screening": {
            "id": "scr1", "instrument": "MCHAT-R", "childAgeMonths": 22, "riskScore": 2, "riskTier": "low",
            "atRiskItems": [1, 7], "answers": answers,
            "domainBreakdown": [{"domain": "joint_attention", "label": "Joint attention", "atRiskCount": 2, "totalItems": 7}],
        },
        "behaviour": {
            "summary": {"topPairs": [{"antecedent": "transition", "behaviour": "meltdown_tantrum", "count": 4}]},
            "recentLogs": [
                {"id": "log-a", "occurredAt": "2026-09-01T10:00:00Z", "antecedent": "transition", "behaviour": "meltdown_tantrum",
                 "consequence": "comforted", "intensity": 3, "durationMinutes": 10, "setting": "home", "notes": "Cried after leaving the park"},
                {"id": "log-b", "occurredAt": "2026-09-02T10:00:00Z", "antecedent": "transition", "behaviour": "meltdown_tantrum",
                 "consequence": "comforted", "intensity": 2},
            ],
        },
    }
    data.update(over)
    return InsightRequest.model_validate(data)


def chunk(id="c1", source="Approved Guide", page=3, section="Screening", text="Reference passage about joint attention and pointing.", score=0.8):
    return Chunk(id=id, text=text, score=score, source=source, publisher="Demo Publisher", url="https://example.test/guide",
                 version="2024", doc_type="guideline", page=page, section=section)


def good_insight(**over):
    out = {
        "summary": "Two screening answers were flagged in joint attention (items 1 and 7). Behaviour logs show transitions followed by meltdowns.",
        "caregiverSummary": "Two of your answers were flagged. Your clinician will look at them with you and decide what they mean.",
        "flaggedAreas": [{
            "area": "Joint attention",
            "explanation": "Items 1 and 7 were answered in the direction the questionnaire counts as flagged.",
            "evidence": [{"type": "screening_response", "id": "1"}, {"type": "screening_response", "id": "7"}, {"type": "behaviour_log", "id": "log-a"}],
            "references": [],
        }],
        "uncertainty": "This is a parent-reported screening with two log entries. It is not a diagnosis.",
    }
    out.update(over)
    return out
