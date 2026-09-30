import pytest

from app.screening import mchatr

REVERSE = {2, 5, 12}


def all_answers(at_risk: bool) -> dict[int, str]:
    """Every item answered so that it is (or is not) at-risk under the official rule."""
    out = {}
    for n in range(1, 21):
        risky = "yes" if n in REVERSE else "no"
        safe = "no" if n in REVERSE else "yes"
        out[n] = risky if at_risk else safe
    return out


def with_n_at_risk(n_risky: int) -> dict[int, str]:
    answers = all_answers(False)
    for item in range(1, n_risky + 1):
        answers[item] = "yes" if item in REVERSE else "no"
    return answers


def test_there_are_20_items_in_order():
    assert [i.number for i in mchatr.ITEMS] == list(range(1, 21))
    assert all(i.text.strip() for i in mchatr.ITEMS)


def test_copyright_notice_present():
    assert "Diana Robins" in mchatr.COPYRIGHT and "2009" in mchatr.COPYRIGHT
    assert "Fein" in mchatr.COPYRIGHT and "Barton" in mchatr.COPYRIGHT


@pytest.mark.parametrize("item", range(1, 21))
def test_at_risk_rule_per_item(item):
    if item in REVERSE:
        assert mchatr.is_at_risk(item, "yes") and not mchatr.is_at_risk(item, "no")
    else:
        assert mchatr.is_at_risk(item, "no") and not mchatr.is_at_risk(item, "yes")


def test_all_typical_answers_score_zero():
    r = mchatr.score_answers(all_answers(False))
    assert r["riskScore"] == 0 and r["riskTier"] == "low" and r["atRiskItems"] == []


def test_all_at_risk_answers_score_twenty():
    r = mchatr.score_answers(all_answers(True))
    assert r["riskScore"] == 20 and r["riskTier"] == "high"
    assert r["atRiskItems"] == list(range(1, 21))


def test_reverse_scored_items_only_yes_counts():
    base = all_answers(False)  # 2,5,12 = "no" (not at-risk)
    assert mchatr.score_answers(base)["riskScore"] == 0
    for item in REVERSE:
        flipped = {**base, item: "yes"}
        assert mchatr.score_answers(flipped)["atRiskItems"] == [item]
    # and a "no" on a normal item is the risky direction
    assert mchatr.score_answers({**base, 1: "no"})["atRiskItems"] == [1]


@pytest.mark.parametrize(
    "total,tier",
    [(0, "low"), (2, "low"), (3, "medium"), (7, "medium"), (8, "high"), (20, "high")],
)
def test_tier_boundaries(total, tier):
    r = mchatr.score_answers(with_n_at_risk(total))
    assert r["riskScore"] == total
    assert r["riskTier"] == tier


def test_boundary_2_3_and_7_8_explicitly():
    assert mchatr.risk_tier(2) == "low" and mchatr.risk_tier(3) == "medium"
    assert mchatr.risk_tier(7) == "medium" and mchatr.risk_tier(8) == "high"


def test_domain_grouping_covers_every_item_exactly_once():
    seen = [n for d in mchatr.DOMAINS.values() for n in d["items"]]
    assert sorted(seen) == list(range(1, 21))


def test_domain_breakdown_counts():
    r = mchatr.score_answers(all_answers(True))
    assert sum(d["atRiskCount"] for d in r["domainBreakdown"]) == 20
    assert all(d["atRiskCount"] == d["totalItems"] for d in r["domainBreakdown"])


def test_grouping_is_labelled_as_not_official():
    assert "not part of the official instrument" in mchatr.instrument_definition()["domainGroupingNote"]


def test_accepts_string_keys_and_any_case():
    answers = {str(k): v.upper() for k, v in all_answers(False).items()}
    assert mchatr.score_answers(answers)["riskScore"] == 0


@pytest.mark.parametrize("mutate", [
    lambda a: a.pop(7),
    lambda a: a.update({21: "yes"}),
    lambda a: a.update({3: "maybe"}),
    lambda a: a.update({3: True}),
    lambda a: a.update({"x": "yes"}),
])
def test_invalid_answers_rejected(mutate):
    answers = all_answers(False)
    mutate(answers)
    with pytest.raises(mchatr.AnswersError):
        mchatr.score_answers(answers)


def test_wording_flag_is_reported():
    assert mchatr.instrument_definition()["wordingVerified"] is mchatr.ITEMS_VERIFIED_AGAINST_SOURCE
