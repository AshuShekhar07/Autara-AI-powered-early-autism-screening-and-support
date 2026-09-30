"""Fixed responses for questions Ask Autara must not answer with the LLM (checked BEFORE any retrieval)."""
from __future__ import annotations

from app import safety

URGENT_MESSAGE = (
    "If anyone is in immediate danger, please contact your local emergency services right now. "
    "For an urgent concern about your child's safety or health, contact your clinician or local emergency services."
)
MEDICATION_MESSAGE = (
    "I can't give advice about medication, supplements or doses. Please ask your child's prescriber, "
    "doctor or pharmacist — they can look at your child's full health picture."
)
DIAGNOSIS_MESSAGE = (
    "I can't say whether a child has any condition or what a \"level\" might be — Autara is a screening aid, "
    "not a diagnosis. A screening result only suggests whether a professional evaluation is recommended. "
    "Please discuss your questions with a qualified clinician."
)
NO_SOURCES_MESSAGE = (
    "No reference material has been loaded into Autara yet, so I can't answer from trusted sources. "
    "Please ask your child's clinician, or check back once reference material has been added."
)
DONT_KNOW_MESSAGE = (
    "I don't know based on the reference material I have. Please ask your child's clinician."
)
FAILED_MESSAGE = (
    "I couldn't put together a reliable answer just now. Please ask your child's clinician."
)


def pre_check(question: str) -> tuple[str, str] | None:
    """Returns (guardrail_name, message) when the question must not reach the LLM. Order matters: safety first."""
    if safety.URGENT.search(question):
        return "urgent_safety", URGENT_MESSAGE
    if safety.MEDICATION.search(question):
        return "medication", MEDICATION_MESSAGE
    if safety.DIAGNOSIS.search(question):
        return "diagnosis", DIAGNOSIS_MESSAGE
    return None
