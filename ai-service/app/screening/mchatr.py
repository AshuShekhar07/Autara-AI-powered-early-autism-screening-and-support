"""M-CHAT-R scoring — pure functions, no I/O, easy to unit test.

The Modified Checklist for Autism in Toddlers, Revised (M-CHAT-R) is a parent-report
SCREENING questionnaire for children 16–30 months. A positive screen means "an
evaluation by a professional is recommended" — it is NOT a diagnosis.

Copyright / licence
-------------------
M-CHAT-R/F © 2009 Diana Robins, Deborah Fein, & Marianne Barton.
The instrument is free for clinical, research and educational use, but it must not
be reworded or altered. Source: https://mchatscreen.com

!! TODO(team) — VERIFY ITEM WORDING !!
The item texts below were entered from memory while the authoring environment could not
reach the official instrument (network policy). They MUST be compared word-for-word with
the official M-CHAT-R/F PDF before any real use. When you have checked all 20 items,
set ITEMS_VERIFIED_AGAINST_SOURCE = True. Until then the API reports
`wordingVerified: false` and the UI shows a visible notice.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

INSTRUMENT_ID = "MCHAT-R"
COPYRIGHT = "M-CHAT-R/F © 2009 Diana Robins, Deborah Fein, & Marianne Barton."
DISCLAIMER = "This is a screening aid, not a diagnosis. Please discuss results with a qualified clinician."

ITEMS_VERIFIED_AGAINST_SOURCE = False  # TODO(team): flip to True after word-for-word check

# Validated age range of the instrument, in months (inclusive).
MIN_AGE_MONTHS = 16
MAX_AGE_MONTHS = 30

Answer = Literal["yes", "no"]

# Official scoring: for every item EXCEPT 2, 5 and 12 a "No" answer is at-risk;
# for items 2, 5 and 12 a "Yes" answer is at-risk.
REVERSE_SCORED_ITEMS = frozenset({2, 5, 12})

# Official risk bands on the total (number of at-risk items, 0–20).
LOW_MAX = 2      # 0–2  → low
MEDIUM_MAX = 7   # 3–7  → medium (Follow-Up interview recommended); 8–20 → high


@dataclass(frozen=True)
class Item:
    number: int
    text: str  # printed wording incl. "FOR EXAMPLE" clarification


ITEMS: tuple[Item, ...] = (
    Item(1, "If you point at something across the room, does your child look at it? (FOR EXAMPLE, if you point at a toy or an animal, does your child look at the toy or animal?)"),
    Item(2, "Have you ever wondered if your child might be deaf?"),
    Item(3, "Does your child play pretend or make-believe? (FOR EXAMPLE, pretend to drink from an empty cup, pretend to talk on a phone, or pretend to feed a doll or stuffed animal?)"),
    Item(4, "Does your child like climbing on things? (FOR EXAMPLE, furniture, playground equipment, or stairs)"),
    Item(5, "Does your child make unusual finger movements near his or her eyes? (FOR EXAMPLE, does your child wiggle his or her fingers close to his or her eyes?)"),
    Item(6, "Does your child point with one finger to ask for something or to get help? (FOR EXAMPLE, pointing to a snack or toy that is out of reach)"),
    Item(7, "Does your child point with one finger to show you something interesting? (FOR EXAMPLE, pointing to an airplane in the sky or a big truck in the road)"),
    Item(8, "Is your child interested in other children? (FOR EXAMPLE, does your child watch other children, smile at them, or go to them?)"),
    Item(9, "Does your child show you things by bringing them to you or holding them up for you to see – not to get help, but just to share? (FOR EXAMPLE, showing you a flower, a stuffed animal, or a toy truck)"),
    Item(10, "Does your child respond when you call his or her name? (FOR EXAMPLE, does he or she look up, talk or babble, or stop what he or she is doing when you call his or her name?)"),
    Item(11, "When you smile at your child, does he or she smile back at you?"),
    Item(12, "Does your child get upset by everyday noises? (FOR EXAMPLE, does your child scream or cry to noise such as a vacuum cleaner or loud music?)"),
    Item(13, "Does your child walk?"),
    Item(14, "Does your child look you in the eye when you are talking to him or her, playing with him or her, or dressing him or her?"),
    Item(15, "Does your child try to copy what you do? (FOR EXAMPLE, wave bye-bye, clap, or make a funny noise when you do)"),
    Item(16, "If you turn your head to look at something, does your child look around to see what you are looking at?"),
    Item(17, "Does your child try to get you to watch him or her? (FOR EXAMPLE, does your child look at you for praise, or say “look” or “watch me”?)"),
    Item(18, "Does your child understand when you tell him or her to do something? (FOR EXAMPLE, if you don't point, can your child understand “put the book on the chair” or “bring me the blanket”?)"),
    Item(19, "If something new happens, does your child look at your face to see how you feel about it? (FOR EXAMPLE, if he or she hears a strange or funny noise, or sees a new toy, will he or she look at your face?)"),
    Item(20, "Does your child like movement activities? (FOR EXAMPLE, being swung or bounced on your knee)"),
)

ITEM_NUMBERS = tuple(i.number for i in ITEMS)

# ── Autara grouping — NOT part of the official instrument ────────────────────
# A project-defined way to group the 20 items so results can be explained by area.
# It has no clinical validation. Each item belongs to exactly one domain.
DOMAIN_GROUPING_NOTE = "Autara grouping, not part of the official instrument."

DOMAINS: dict[str, dict] = {
    "joint_attention":     {"label": "Joint attention & sharing interest", "items": (1, 6, 7, 9, 16, 17, 19)},
    "social_engagement":   {"label": "Social engagement",                  "items": (8, 10, 11, 14)},
    "communication":       {"label": "Communication & understanding",      "items": (2, 18)},
    "imitation_play":      {"label": "Imitation & pretend play",           "items": (3, 15)},
    "sensory_motor":       {"label": "Sensory, motor & movement",          "items": (4, 5, 12, 13, 20)},
}


def instrument_definition() -> dict:
    """Everything the UI needs to render the questionnaire and explain results."""
    item_domain = {n: key for key, d in DOMAINS.items() for n in d["items"]}
    return {
        "instrument": INSTRUMENT_ID,
        "copyright": COPYRIGHT,
        "disclaimer": DISCLAIMER,
        "wordingVerified": ITEMS_VERIFIED_AGAINST_SOURCE,
        "ageRangeMonths": {"min": MIN_AGE_MONTHS, "max": MAX_AGE_MONTHS},
        "reverseScoredItems": sorted(REVERSE_SCORED_ITEMS),
        "items": [{"number": i.number, "text": i.text, "domain": item_domain[i.number]} for i in ITEMS],
        "domains": [{"key": k, "label": d["label"], "items": list(d["items"])} for k, d in DOMAINS.items()],
        "domainGroupingNote": DOMAIN_GROUPING_NOTE,
    }


class AnswersError(ValueError):
    """Raised when the submitted answers are not exactly the 20 items with yes/no values."""


def normalise_answers(answers: dict) -> dict[int, str]:
    """Accepts keys as int or numeric str and values 'yes'/'no' (any case). Requires all 20."""
    out: dict[int, str] = {}
    for key, value in answers.items():
        try:
            number = int(key)
        except (TypeError, ValueError):
            raise AnswersError(f"Invalid item number: {key!r}")
        if number not in ITEM_NUMBERS:
            raise AnswersError(f"Unknown item number: {number}")
        if not isinstance(value, str) or value.strip().lower() not in ("yes", "no"):
            raise AnswersError(f"Item {number}: answer must be 'yes' or 'no'.")
        out[number] = value.strip().lower()
    missing = [n for n in ITEM_NUMBERS if n not in out]
    if missing:
        raise AnswersError(f"Missing answers for items: {missing}")
    return out


def is_at_risk(item_number: int, answer: str) -> bool:
    """Official rule: 'no' is at-risk, except items 2, 5, 12 where 'yes' is at-risk."""
    if item_number in REVERSE_SCORED_ITEMS:
        return answer == "yes"
    return answer == "no"


def risk_tier(total: int) -> str:
    """0–2 low, 3–7 medium, 8–20 high."""
    if total <= LOW_MAX:
        return "low"
    if total <= MEDIUM_MAX:
        return "medium"
    return "high"


def score_answers(answers: dict) -> dict:
    """Rule-based M-CHAT-R score. This result is ALWAYS the authoritative risk tier."""
    normalised = normalise_answers(answers)
    at_risk = [n for n in ITEM_NUMBERS if is_at_risk(n, normalised[n])]
    breakdown = [
        {
            "domain": key,
            "label": d["label"],
            "atRiskCount": sum(1 for n in d["items"] if n in at_risk),
            "totalItems": len(d["items"]),
        }
        for key, d in DOMAINS.items()
    ]
    return {
        "riskScore": len(at_risk),
        "riskTier": risk_tier(len(at_risk)),
        "atRiskItems": at_risk,
        "domainBreakdown": breakdown,
    }
