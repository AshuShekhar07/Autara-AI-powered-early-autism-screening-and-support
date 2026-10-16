import pytest

from app import safety
from app.assistant import guardrails


@pytest.mark.parametrize("text", [
    "The child has autism.",
    "She has an autism spectrum disorder.",
    "Your child has ASD based on these answers.",
    "He is autistic.",
    "They were autistic as a toddler.",
    "The child was diagnosed with autism last year.",
    "This is consistent with a diagnosis of autism.",
    "This looks like Level 2 autism.",
    "Level 3 support needs.",
    "Autism level 1 is likely.",
    "The result confirms ASD.",
    "This confirms that your child has autism.",
    "Confirming autism requires more.",
    "That indicates severe autism.",
    "moderate ASD is present",
    "Your child definitely has autism spectrum disorder.",
    "The child does not have autism.",          # excluding a condition is also a diagnosis
    "diagnosed as autistic",
])
def test_banned_patterns_match(text):
    assert safety.find_banned(text), f"should be banned: {text}"


@pytest.mark.parametrize("text", [
    "A professional evaluation is recommended.",
    "This is a screening aid, not a diagnosis.",
    "This is not a diagnosis of any condition.",
    "The screening does not confirm autism or any other condition.",
    "Screening cannot be used for a diagnosis with certainty.",
    "Three answers were flagged in joint attention.",
    "Your clinician will decide what these results mean.",
    "The child is interested in other children.",
    "Level of intensity was 3 out of 5.",
    "Supports are available at school.",
])
def test_benign_text_is_allowed(text):
    assert safety.find_banned(text) == [], f"should be allowed: {text}"


@pytest.mark.parametrize("q,expected", [
    ("My child is not breathing properly", "urgent_safety"),
    ("He keeps trying to hurt himself, what do I do", "urgent_safety"),
    ("What dose of melatonin can I give?", "medication"),
    ("Is risperidone safe for toddlers", "medication"),
    ("Does my child have autism?", "diagnosis"),
    ("Is my son autistic?", "diagnosis"),
    ("What level is my child?", "diagnosis"),
])
def test_question_guardrails(q, expected):
    assert guardrails.pre_check(q)[0] == expected


@pytest.mark.parametrize("q", [
    "What does a medium risk result mean?",
    "How can I prepare for a clinic visit?",
    "What is a follow-up interview?",
    "Why were some of my answers flagged?",
])
def test_ordinary_questions_pass(q):
    assert guardrails.pre_check(q) is None


def test_urgent_beats_other_guardrails():
    assert guardrails.pre_check("my child swallowed his medication")[0] == "urgent_safety"


@pytest.mark.parametrize("text", ["Give 5 mg at night", "Take 2 tablets daily", "administer half a dose 10 ml"])
def test_dosing_output_detected(text):
    assert safety.DOSING_OUTPUT.search(text)


@pytest.mark.parametrize("text", [
    "Ask your clinician about sleep routines",
    "I can't give advice about medication, supplements or doses.",
    "Please ask your prescriber before giving any medication.",
])
def test_dosing_output_ignores_non_doses(text):
    assert not safety.DOSING_OUTPUT.search(text)
