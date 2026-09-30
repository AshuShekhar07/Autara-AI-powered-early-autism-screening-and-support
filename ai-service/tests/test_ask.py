from app.assistant import guardrails
from app.assistant.ask import AskRequest, ask
from tests.fakes import FakeProvider, down
from tests.helpers import chunk


def run(question, responses=None, chunks=None, context=None):
    provider = FakeProvider(responses or [])
    req = AskRequest(question=question, context=context)
    return ask(req, provider=provider, retrieve=lambda q: chunks if chunks is not None else []), provider


def test_urgent_question_gets_emergency_message_and_never_reaches_the_llm():
    res, provider = run("My child is not breathing", responses=[])
    assert res.guardrail == "urgent_safety" and "emergency services" in res.answer and res.sources == []
    assert provider.prompts == []


def test_medication_and_diagnosis_questions_are_refused_without_the_llm():
    for q, name in [("What dose of melatonin?", "medication"), ("Does my child have autism?", "diagnosis")]:
        res, provider = run(q)
        assert res.guardrail == name and res.sources == [] and provider.prompts == []


def test_empty_corpus_says_no_reference_material_is_loaded(fake):
    res, _ = run("What is a follow-up interview?", chunks=[])
    assert res.guardrail == "no_sources"
    assert "No reference material has been loaded" in res.answer and res.sources == []


def test_answer_is_returned_with_its_sources():
    res, provider = run("What is pointing?", responses=[{"canAnswer": True, "answer": "Pointing is described in the guide.", "citations": ["R1"]}], chunks=[chunk()])
    assert res.guardrail is None and res.answer.startswith("Pointing")
    assert [s.title for s in res.sources] == ["Approved Guide"] and res.sources[0].page == 3
    assert "Reference passage" in provider.prompts[0][1] and "What is pointing?" in provider.prompts[0][1]


def test_cannot_answer_from_sources_means_i_dont_know_with_no_sources():
    res, _ = run("Something unrelated?", responses=[{"canAnswer": False, "answer": "x", "citations": []}], chunks=[chunk()])
    assert res.guardrail == "no_answer" and res.answer == guardrails.DONT_KNOW_MESSAGE and res.sources == []


def test_answer_without_citation_or_with_unknown_citation_is_retried_then_refused():
    bad = {"canAnswer": True, "answer": "Trust me.", "citations": []}
    res, provider = run("Q?", responses=[bad, bad], chunks=[chunk()])
    assert res.guardrail == "validation_failed" and res.sources == [] and len(provider.prompts) == 2
    unknown = {"canAnswer": True, "answer": "Fine.", "citations": ["R9"]}
    assert run("Q?", responses=[unknown, unknown], chunks=[chunk()])[0].guardrail == "validation_failed"


def test_banned_or_dosing_answers_are_rejected_and_the_retry_can_fix_them():
    good = {"canAnswer": True, "answer": "The guide describes pointing.", "citations": ["R1"]}
    for bad_text in ("Your child has autism.", "Give 5 mg at night."):
        bad = {"canAnswer": True, "answer": bad_text, "citations": ["R1"]}
        res, provider = run("Q?", responses=[bad, good], chunks=[chunk()])
        assert res.answer == "The guide describes pointing." and len(provider.prompts) == 2


def test_child_context_is_only_tier_and_flagged_areas():
    ctx = {"riskTier": "medium", "ageMonths": 22, "domains": [{"label": "Joint attention", "atRiskCount": 3, "totalItems": 7}]}
    res, provider = run("Why were answers flagged?", responses=[{"canAnswer": True, "answer": "See the guide.", "citations": ["R1"]}], chunks=[chunk()], context=ctx)
    prompt = provider.prompts[0][1]
    assert "risk tier = medium" in prompt and "Joint attention: 3 of 7" in prompt and "not a diagnosis" in prompt


def test_llm_outage_is_a_friendly_message():
    res, _ = run("Q?", responses=[down()], chunks=[chunk()])
    assert res.guardrail == "unavailable" and res.sources == []


def test_request_rejects_extra_fields_and_overlong_questions():
    import pytest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        AskRequest.model_validate({"question": "hi", "childName": "Alex"})
    with pytest.raises(ValidationError):
        AskRequest.model_validate({"question": "x" * 501})
