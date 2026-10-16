import pytest

from app.insights.generator import NO_REFERENCE_NOTE, generate_insight
from tests.fakes import FakeProvider, down
from tests.helpers import chunk, good_insight, make_request


def run(responses, chunks=None, req=None):
    provider = FakeProvider(responses)
    result = generate_insight(req or make_request(), provider=provider, retrieve=lambda q: chunks or [])
    return result, provider


def test_generates_on_first_valid_answer():
    result, provider = run([good_insight()])
    assert result.status == "generated" and result.clinicalReviewRequired is True
    assert result.promptVersion == "insight_v1" and result.model == "fake-model"
    assert result.insight["flaggedAreas"][0]["evidence"][0] == {"type": "screening_response", "id": "1"}
    assert result.readingGrade is not None
    assert len(provider.prompts) == 1


def test_system_prompt_is_the_stored_versioned_prompt():
    _, provider = run([good_insight()])
    system = provider.prompts[0][0]
    assert system.startswith("You are an explainability assistant for a screening-support platform. Do not diagnose autism or assign a severity level.")
    assert "The clinician makes the final decision." in system


def test_retries_once_with_the_rejection_reasons_then_succeeds():
    result, provider = run([good_insight(summary="The child has autism."), good_insight()])
    assert result.status == "generated"
    assert len(provider.prompts) == 2
    assert "BANNED_PHRASE" in provider.prompts[1][1]


def test_second_failure_marks_failed_and_returns_reason_codes_only():
    result, provider = run(["not json", '{"still": "bad"}'])
    assert result.status == "failed" and result.insight is None
    assert result.failureReasons and len(provider.prompts) == 2       # exactly one retry, no more


def test_invented_evidence_id_is_never_accepted():
    bad = good_insight()
    bad["flaggedAreas"][0]["evidence"] = [{"type": "behaviour_log", "id": "ghost"}]
    result, _ = run([bad, bad])
    assert result.status == "failed" and any("UNKNOWN_EVIDENCE_ID" in r for r in result.failureReasons)


def test_llm_outage_is_a_failed_insight_not_an_exception():
    result, _ = run([down()])
    assert result.status == "failed" and result.failureReasons == ["LLM_ERROR"]


def test_empty_corpus_prompt_says_none_and_result_has_empty_references_and_note():
    result, provider = run([good_insight()], chunks=[])
    user = provider.prompts[0][1]
    assert "NONE — no reference material is available" in user
    assert result.retrievedChunkIds == []
    assert all(a["references"] == [] for a in result.insight["flaggedAreas"])
    assert NO_REFERENCE_NOTE in result.insight["uncertainty"]


def test_with_corpus_references_must_come_from_retrieved_chunks():
    good = good_insight()
    good["flaggedAreas"][0]["references"] = [{"source": "Approved Guide", "page": 3, "section": "Screening"}]
    result, provider = run([good], chunks=[chunk()])
    assert result.status == "generated" and result.retrievedChunkIds == ["c1"]
    assert "Approved Guide" in provider.prompts[0][1] and "Reference passage" in provider.prompts[0][1]
    assert NO_REFERENCE_NOTE not in result.insight["uncertainty"]

    invented = good_insight()
    invented["flaggedAreas"][0]["references"] = [{"source": "Made Up Journal", "page": 1}]
    assert run([invented, invented], chunks=[chunk()])[0].status == "failed"


def test_evidence_only_contains_minimum_fields_and_no_names():
    _, provider = run([good_insight()])
    prompt = provider.prompts[0][1]
    assert "childName" not in prompt and "dob" not in prompt.lower()
    assert '"childAgeMonths": 22' in prompt


def test_request_schema_rejects_unexpected_fields_such_as_names():
    data = make_request().model_dump()
    data["screening"]["childName"] = "Alex"
    from app.insights.schema import InsightRequest
    with pytest.raises(Exception):
        InsightRequest.model_validate(data)


def test_log_notes_are_capped():
    req = make_request()
    long = req.behaviour.recentLogs[0].model_copy(update={"notes": "x" * 500})
    from app.insights.schema import LogEvidence
    assert len(LogEvidence.model_validate(long.model_dump()).notes) == 200
