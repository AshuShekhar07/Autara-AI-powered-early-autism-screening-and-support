"""Text safety checks shared by insights and Ask Autara. The heart of the "no diagnosis" rule.

`find_banned(text)` returns the names of banned patterns that match. It is deliberately
conservative: a false positive only costs one retry, a false negative could put a diagnostic
claim in front of a family.

Patterns marked `negatable` describe *meta* talk that is fine when negated ("this is not a
diagnosis of anything") — we skip those when a negation word directly precedes the match.
Claims such as "does not have autism" are STILL banned: excluding a condition is also a diagnosis.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Banned:
    name: str
    regex: re.Pattern
    negatable: bool = False


def _p(name: str, pattern: str, negatable: bool = False) -> Banned:
    return Banned(name, re.compile(pattern, re.IGNORECASE), negatable)


_COND = r"(?:autism|asd|autism spectrum disorder|autistic)"

BANNED_PATTERNS: tuple[Banned, ...] = (
    _p("has_condition",   rf"\b(?:has|have|had|having)\s+(?:an?\s+|the\s+)?(?:autism|asd|autism spectrum disorder)\b"),
    _p("is_autistic",     r"\b(?:is|are|was|were|being|be)\s+(?:an?\s+)?autistic\b"),
    _p("diagnosis_with",  r"\bdiagnos(?:ed|is)\s+(?:of|with|as)\b", negatable=True),
    _p("diagnostic_of",   rf"\bdiagnostic\s+of\s+{_COND}\b", negatable=True),
    _p("level_n_autism",  rf"\blevel\s*[123]\s*(?:{_COND}|support|severity)\b"),
    _p("autism_level_n",  rf"\b{_COND}\s*(?:spectrum disorder\s*)?(?:,\s*)?level\s*[123]\b"),
    _p("confirms_asd",    rf"\bconfirm(?:s|ed|ing)?\s+(?:that\s+)?(?:the\s+child\s+has\s+|your\s+child\s+has\s+)?(?:asd|autism)\b", negatable=True),
    _p("severity_label",  rf"\b(?:mild|moderate|severe|high[- ]functioning|low[- ]functioning)\s+(?:autism|asd)\b"),
    _p("child_has_asd",   rf"\b(?:your|the)\s+child\s+(?:definitely\s+|clearly\s+|likely\s+)?(?:has|is)\b[^.]{{0,25}}\b{_COND}\b"),
)

_NEGATIONS = re.compile(r"\b(?:not|no|never|cannot|can't|isn't|doesn't|does not|do not|don't|without|nor)\b[^.]{0,30}$", re.IGNORECASE)


def find_banned(text: str) -> list[str]:
    hits = []
    for b in BANNED_PATTERNS:
        for m in b.regex.finditer(text):
            if b.negatable and _NEGATIONS.search(text[max(0, m.start() - 40): m.start()]):
                continue
            hits.append(b.name)
            break
    return hits


# ── Ask Autara guardrails (input side) ───────────────────────────────────────────────────────
URGENT = re.compile(
    r"\b(?:emergency|suicid\w*|kill (?:him|her|them|myself)|hurt (?:himself|herself|themselves|myself)|"
    r"self[- ]harm\w*|not breathing|can'?t breathe|unresponsive|unconscious|seizure|overdos\w*|swallowed|"
    r"poison\w*|choking|bleeding|missing child|ran away|in danger|abus\w+)\b", re.IGNORECASE)

MEDICATION = re.compile(
    r"\b(?:medicat\w*|medicine|drug|dose|dosage|dosing|mg|mcg|milligram\w*|prescri\w+|risperidone|aripiprazole|"
    r"melatonin|ritalin|methylphenidate|antipsychotic\w*|ssri|supplement\w*)\b", re.IGNORECASE)

DIAGNOSIS = re.compile(
    r"(?:\b(?:does|do|did|is|are|could|can|might|will)\b.{0,40}\b(?:have|has|having|be|been)\b.{0,25}\b(?:autism|asd|autistic)\b)|"
    r"\b(?:diagnos\w+)\b.{0,30}\b(?:my|our|his|her|their)\b|"
    r"\b(?:what|which)\b.{0,20}\b(?:level|severity|stage)\b|"
    r"\b(?:is|are)\b.{0,15}\b(?:autistic)\b", re.IGNORECASE)

# Output-side: actual doses must never appear in an answer (a number + unit, or "take 2 tablets").
DOSING_OUTPUT = re.compile(
    r"\b\d+(?:\.\d+)?\s?(?:mg|mcg|ml|milligrams?|micrograms?)\b|"
    r"\b(?:take|give|administer)\s+(?:\d+|one|two|three|four|half)\s+(?:tablets?|pills?|capsules?|drops?|teaspoons?|tablespoons?|doses?)\b",
    re.IGNORECASE)
