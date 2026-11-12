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
import unicodedata
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
    _p("on_spectrum",     r"\b(?:he|she|they|your\s+(?:child|son|daughter)|the\s+child|my\s+(?:child|son|daughter))\s+(?:is|are|was|were|seems?\s+to\s+be|appears?\s+to\s+be)\s+(?:on|in|within)\s+the\s+(?:autism\s+)?spectrum\b"),
    _p("looks_like_asd",  rf"\b(?:looks?|sounds?|seems?|appears?|resembles?|is)\s+(?:like\s+|consistent\s+with\s+|typical\s+of\s+|indicative\s+of\s+|suggestive\s+of\s+)(?:an?\s+)?(?:classic\s+|typical\s+|mild\s+|severe\s+|textbook\s+)?{_COND}\b"),
    _p("i_diagnose",      rf"\b(?:i|we)\s+(?:would\s+|will\s+|can\s+|do\s+)?(?:diagnos\w+|conclude|determine)\b[^.]{{0,40}}\b{_COND}\b"),
    _p("diagnose_as",     r"\bdiagnos(?:e|es|ing)\s+(?:this|that|him|her|them|it|your\s+\w+|the\s+child)\s+as\b"),
    _p("meets_criteria",  rf"\bmeets?\s+(?:the\s+|all\s+)?(?:diagnostic\s+)?criteria\s+(?:for|of)\s+(?:an?\s+)?{_COND}\b"),
    _p("likely_asd",      rf"\b(?:likely|probably|definitely|certainly|clearly|surely|undoubtedly)\s+(?:is\s+|has\s+|have\s+|an?\s+)?{_COND}\b"),
    _p("other_condition", r"\b(?:he|she|your\s+(?:child|son|daughter)|the\s+child|my\s+(?:child|son|daughter))\s+(?:also\s+|probably\s+|likely\s+|definitely\s+|clearly\s+)?(?:has|have|had|is\s+showing)\s+(?:an?\s+)?(?:asperger\w*|pdd[- ]?nos|adhd|add|dyspraxia|dyslexia|epilepsy|cerebral\s+palsy|down'?s?\s+syndrome|fragile\s+x|global\s+developmental\s+delay|intellectual\s+disabilit\w+)\b"),
)

_NEGATIONS = re.compile(r"\b(?:not|no|never|cannot|can't|isn't|doesn't|does not|do not|don't|without|nor)\b[^.]{0,30}$", re.IGNORECASE)


_ZERO_WIDTH = re.compile(r"[\u200b-\u200f\u2060\ufeff]")
_SPACED_LETTERS = re.compile(r"\b(?:[A-Za-z][.\-_*\s]){2,}[A-Za-z]\b")
_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s"})


def normalise(text: str, leet: bool = True) -> str:
    """Undoes the usual filter-dodging tricks: zero-width characters, "a.u.t.i.s.m" / "a s d" spacing and "aut1sm" digits."""
    t = _ZERO_WIDTH.sub("", unicodedata.normalize("NFKC", text))
    t = _SPACED_LETTERS.sub(lambda m: re.sub(r"[.\-_*\s]", "", m.group(0)), t)
    if leet:
        t = re.sub(r"[A-Za-z0-9@$]+", lambda m: m.group(0).translate(_LEET) if re.search(r"[A-Za-z]", m.group(0)) else m.group(0), t)
    return t


def hit(pattern: re.Pattern, text: str) -> bool:
    """True if the pattern matches the text as typed OR after undoing obfuscation."""
    return bool(pattern.search(text) or pattern.search(normalise(text)))


def find_banned(text: str) -> list[str]:
    hits = []
    # the model's own text is checked as written and with "A.S.D." / "a s d" spacing removed
    for candidate in dict.fromkeys((text, normalise(text, leet=False))):
        for b in BANNED_PATTERNS:
            if b.name in hits:
                continue
            for m in b.regex.finditer(candidate):
                if b.negatable and _NEGATIONS.search(candidate[max(0, m.start() - 40): m.start()]):
                    continue
                hits.append(b.name)
                break
    return hits


# ── Ask Autara guardrails (input side) ───────────────────────────────────────────────────────
URGENT = re.compile(
    r"\b(?:emergency|suicid\w*|kill (?:him|her|them|myself)|hurt (?:himself|herself|themselves|myself)|"
    r"self[- ]harm\w*|not breathing|can'?t breathe|unresponsive|unconscious|seizure|overdos\w*|swallowed|"
    r"poison\w*|choking|bleeding|missing child|ran away|in danger|abus\w+)\b|"
    r"\b(?:stop(?:ped|s)?\s+breathing|(?:isn'?t|not|won'?t|stopped|stops)\s+(?:breathing|responding|waking|moving)|"
    r"turn(?:ing|ed|s)?\s+(?:blue|purple|grey|gray|pale)|blue\s+lips|blue\s+in\s+the\s+face|"
    r"(?:end|take)\s+(?:his|her|their|my|our)\s+(?:own\s+)?li(?:fe|ves)|want(?:s|ed)?\s+to\s+die|"
    r"(?:kill|killing|harm|harming|hurt|hurting|hit|hitting|shak(?:e|ing)|smother\w*|drown\w*)\s+(?:my|the|our)\s+(?:own\s+)?(?:baby|child|son|daughter|kid|toddler|infant)|"
    r"(?:ate|eaten|eating|drank|drunk|drinking|swallow\w*|inhal\w*)\s+(?:some\s+|a\s+|the\s+)?(?:bleach|detergent|chemical\w*|batter(?:y|ies)|cleaning|petrol|kerosene|pesticide\w*)|"
    r"ran\s+(?:in)?to\s+(?:the\s+)?(?:road|street|traffic|water|pool|lake|river)|"
    r"fell\s+(?:out\s+of|from|off)\s+(?:the\s+|a\s+)?(?:window|balcony|stairs|roof|bed|tree)|"
    r"ambulance|head\s+injur\w*|convuls\w*|fainted|passed\s+out|(?:can'?t|cannot)\s+(?:wake|breathe))\b", re.IGNORECASE)

MEDICATION = re.compile(
    r"\b(?:medicat\w*|medicine|drug|dose|dosage|dosing|mg|mcg|milligram\w*|prescri\w+|risperidone|aripiprazole|"
    r"melatonin|ritalin|methylphenidate|antipsychotic\w*|ssri|supplement\w*|pills?|capsules?|sedat\w*|"
    r"sleeping aids?|tranquili[sz]\w*|paracetamol|acetaminophen|tylenol|ibuprofen|calpol|crocin|benadryl|cannabis|cbd|marijuana|"
    r"hemp|risperdal|abilify|adderall|clonidine|fluoxetine|sertraline|antidepressant\w*|antihistamine\w*|vitamins?|probiotics?|"
    r"herbal|ayurved\w*|homeopath\w*|chelation|stem\s+cells?|syrup|ml)\b|\b(?:which|what)\s+(?:tablet|pill|capsule)s?\b|"
    r"\bput\b.{0,15}\bin\b.{0,10}\b(?:his|her|their|the)\b.{0,10}\b(?:food|drink|milk|juice)\b", re.IGNORECASE)

DIAGNOSIS = re.compile(
    r"(?:\b(?:does|do|did|is|are|could|can|might|will)\b.{0,40}\b(?:have|has|having|be|been)\b.{0,25}\b(?:autism|asd|autistic)\b)|"
    r"\b(?:diagnos\w+)\b.{0,30}\b(?:my|our|his|her|their)\b|"
    r"\b(?:what|which)\b.{0,20}\b(?:level|severity|stage)\b|"
    r"\b(?:is|are)\b.{0,15}\b(?:autistic)\b|"
    r"\b(?:on|in)\s+the\s+(?:autism\s+)?spectrum\b|"
    r"\b(?:give|tell|provide|make)\b.{0,12}\b(?:me|us)\b.{0,12}\ba\s+diagnos\w+|"
    r"\b(?:say|tell me|state|write|confirm|admit)\b.{0,40}\b(?:has|have|is|are)\b.{0,25}\b(?:autism|asd|autistic)\b|"
    r"\bis\s+it\s+(?:autism|asd)\b|\b(?:autism|asd)\s+or\s+not\b|"
    r"\b(?:he|she|they|it|this|my\s+\w+)\s+(?:must|probably|surely|definitely|obviously|certainly|clearly)\s+(?:be|have|has)\s+(?:an?\s+)?(?:autistic|autism|asd)\b|"
    r"\b(?:is|are)\s+(?:it|he|she|this)\s+(?:mild|moderate|severe)\b|\b(?:mild|moderate|severe)\s+or\s+(?:mild|moderate|severe)\b", re.IGNORECASE)

# Attempts to override Ask Autara's rules (prompt injection in the question itself).
INSTRUCTION_OVERRIDE = re.compile(
    r"\b(?:ignore|disregard|forget|override)\b.{0,25}\b(?:previous|prior|above|earlier|all|your|these|the)\b.{0,25}\b(?:instructions?|rules?|guidelines?|prompts?)\b|"
    r"\b(?:reveal|show|print|repeat)\b.{0,25}\b(?:system prompt|your prompt|your instructions)\b|"
    r"\b(?:pretend|act)\b.{0,12}\b(?:to be|as|you are)\b|"
    r"\byou are now\b|\bjailbreak\b|\bdeveloper mode\b|"
    r"\bfrom\s+now\s+on\b.{0,40}\b(?:you|answer|act|respond)\b|\bnew\s+instructions?\s*:|"
    r"<\s*/?\s*(?:system|assistant|instructions?)\s*>|\[\s*/?\s*(?:inst|system)\s*\]|(?:^|\n)\s*(?:system|assistant)\s*:|"
    r"\b(?:repeat|print|show|reveal|output|display|translate|summari[sz]e)\b.{0,30}\b(?:everything|all|text|words)\b.{0,20}\b(?:above|before)\b|"
    r"\b(?:initial|hidden|original|secret|system)\s+(?:prompt|message|instructions?)\b|\bwhat\s+(?:were|are)\s+you\s+(?:told|instructed)\b|"
    r"\btranslate\b.{0,25}\b(?:your|the)\s+(?:instructions|prompt|rules)\b|"
    r"\byou\s+(?:are|will\s+be)\s+(?:now\s+)?(?:a|an|my)\s+(?:doctor|clinician|psychologist|paediatrician|pediatrician|therapist|expert)\b|"
    r"\brole[- ]?play\b|\b(?:ignor(?:ez|a|iere)|oublie[zs]?)\b", re.IGNORECASE)

# Output-side: actual doses must never appear in an answer (a number + unit, or "take 2 tablets").
DOSING_OUTPUT = re.compile(
    r"\b\d+(?:\.\d+)?\s?(?:mg|mcg|µg|ml|iu|milligrams?|micrograms?|millilit(?:re|er)s?)\b|"
    r"\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|fifty|hundred|half|quarter)\s+(?:an?\s+)?"
    r"(?:mg|mcg|ml|milligrams?|micrograms?|millilit(?:re|er)s?|teaspoons?|tablespoons?|tablets?|pills?|capsules?|drops?)\b|"
    r"\b(?:take|give|administer)\s+(?:\d+|one|two|three|four|half)\s+(?:tablets?|pills?|capsules?|drops?|teaspoons?|tablespoons?|tsp|tbsp|doses?)\b|"
    r"\b\d+\s?(?:tsp|tbsp|teaspoons?|tablespoons?)\b",
    re.IGNORECASE)
