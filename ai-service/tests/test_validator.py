import json

import pytest

from app.insights.validator import evidence_ids, reading_grade, validate_insight
from tests.helpers import chunk, good_insight, make_request

ALLOWED = evidence_ids(make_request())
CHUNKS = [chunk()]


def check(payload, chunks=CHUNKS):
    raw = payload if isinstance(payload, str) else json.dumps(payload)
    return validate_insight(raw, ALLOWED, chunks)


def test_valid_insight_passes():
    insight, errors = check(good_insight())
    assert errors == [] and insight.flaggedAreas[0].area == "Joint attention"


def test_accepts_markdown_fenced_json():
    insight, errors = check("```json\n" + json.dumps(good_insight()) + "\n```")
    assert errors == [] and insight is not None


@pytest.mark.parametrize("raw", ["not json", "", "[]", '{"summary": "x"}'])
def test_invalid_json_or_schema_is_rejected(raw):
    insight, errors = check(raw)
    assert insight is None and errors and errors[0].split(":")[0] in ("INVALID_JSON", "SCHEMA_MISMATCH")


def test_extra_fields_are_rejected():
    insight, errors = check(good_insight(diagnosis="none"))
    assert insight is None and errors[0].startswith("SCHEMA_MISMATCH")


def test_unknown_screening_item_id_is_rejected():
    bad = good_insight()
    bad["flaggedAreas"][0]["evidence"].append({"type": "screening_response", "id": "21"})
    insight, errors = check(bad)
    assert insight is None and "UNKNOWN_EVIDENCE_ID:screening_response:21" in errors


def test_unknown_behaviour_log_id_is_rejected():
    bad = good_insight()
    bad["flaggedAreas"][0]["evidence"].append({"type": "behaviour_log", "id": "invented"})
    _, errors = check(bad)
    assert "UNKNOWN_EVIDENCE_ID:behaviour_log:invented" in errors


def test_evidence_type_must_match_id_space():
    bad = good_insight()
    bad["flaggedAreas"][0]["evidence"] = [{"type": "behaviour_log", "id": "7"}]   # "7" is an item, not a log
    _, errors = check(bad)
    assert errors


def test_area_without_evidence_is_rejected():
    bad = good_insight()
    bad["flaggedAreas"][0]["evidence"] = []
    insight, errors = check(bad)
    assert insight is None and errors[0].startswith("SCHEMA_MISMATCH")


def test_reference_must_be_a_retrieved_chunk():
    ok = good_insight()
    ok["flaggedAreas"][0]["references"] = [{"source": "Approved Guide", "page": 3, "section": "Screening"}]
    assert check(ok)[1] == []

    unknown_source = good_insight()
    unknown_source["flaggedAreas"][0]["references"] = [{"source": "Made Up Journal", "page": 1}]
    assert any(e.startswith("UNKNOWN_REFERENCE_SOURCE") for e in check(unknown_source)[1])

    wrong_page = good_insight()
    wrong_page["flaggedAreas"][0]["references"] = [{"source": "Approved Guide", "page": 99}]
    assert any(e.startswith("UNKNOWN_REFERENCE_PAGE") for e in check(wrong_page)[1])


def test_any_reference_is_rejected_when_nothing_was_retrieved():
    bad = good_insight()
    bad["flaggedAreas"][0]["references"] = [{"source": "Approved Guide", "page": 3}]
    assert any(e.startswith("UNKNOWN_REFERENCE") for e in check(bad, chunks=[])[1])


@pytest.mark.parametrize("uncertainty", ["", "   "])
def test_empty_uncertainty_is_rejected(uncertainty):
    insight, errors = check(good_insight(uncertainty=uncertainty))
    assert insight is None and "EMPTY_UNCERTAINTY" in errors


@pytest.mark.parametrize("field,text", [
    ("summary", "The child has autism."),
    ("caregiverSummary", "Your child is autistic."),
    ("uncertainty", "Level 2 autism cannot be excluded."),
])
def test_banned_phrase_in_any_field_is_rejected(field, text):
    insight, errors = check(good_insight(**{field: text}))
    assert insight is None and any(e.startswith("BANNED_PHRASE") for e in errors)


def test_banned_phrase_inside_a_flagged_area_is_rejected():
    bad = good_insight()
    bad["flaggedAreas"][0]["explanation"] = "This confirms ASD."
    _, errors = check(bad)
    assert any(e.startswith("BANNED_PHRASE") for e in errors)


def test_reading_grade_is_lower_for_plain_text():
    plain = reading_grade("Two of your answers were flagged. Your doctor will look at them with you.")
    dense = reading_grade("Notwithstanding methodological limitations, neurodevelopmental heterogeneity necessitates comprehensive multidisciplinary evaluation.")
    assert plain < 8 < dense
