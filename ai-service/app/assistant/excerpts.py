"""Backup answers for Ask Autara: no language model, only quotes from the approved documents.

When Gemini is unavailable (or ASK_MODE=local), the best-matching passages are shown word for word with their
source. Nothing is written or paraphrased by Autara, so it cannot invent a claim or give a diagnosis; every
quote is also run through the same banned-wording and dose filters as a model answer (a passage that trips
a filter is simply left out).
"""
from __future__ import annotations

import re

from app import safety
from app.rag.retriever import Chunk

MAX_EXCERPT_CHARS = 450
RELATIVE_MARGIN = 0.15   # only passages this close to the best match are shown, so weak extras do not pad the answer
LEAD_IN = (
    "I can't write a full answer right now. These passages from the approved reference material may help. "
    "They are quoted as written and are general information, not advice about your child."
)
_STOP = {
    "what", "when", "where", "which", "who", "whom", "whose", "why", "how", "does", "do", "did", "can", "could",
    "should", "would", "will", "the", "this", "that", "these", "those", "with", "from", "about", "have", "has",
    "had", "are", "was", "were", "been", "being", "and", "for", "not", "you", "your", "his", "her", "their",
    "our", "mine", "child", "children", "kid", "kids", "tell", "know", "mean", "means",
}
_SENTENCES = re.compile(r"(?<=[.!?])\s+|\n+")


def _keywords(query: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]{4,}", query.lower()) if w not in _STOP}


def excerpt(text: str, query: str, limit: int = MAX_EXCERPT_CHARS) -> str:
    """The part of a passage that best matches the question: whole sentences, quoted exactly, at most ~limit characters."""
    sentences = [s.strip() for s in _SENTENCES.split(text) if s.strip()]
    if not sentences:
        return ""
    words = _keywords(query)
    scores = [sum(1 for w in words if w in s.lower()) for s in sentences]
    start = scores.index(max(scores)) if words and max(scores) > 0 else 0
    picked: list[str] = []
    size = 0
    for s in sentences[start:]:
        if picked and size + len(s) + 1 > limit:
            break
        picked.append(s)
        size += len(s) + 1
    out = " ".join(picked)
    if len(out) > limit:                       # one very long sentence: cut at a word boundary
        out = out[:limit].rsplit(" ", 1)[0] + "…"
    if start > 0:
        out = "… " + out
    return out


def pick(chunks: list[Chunk], query: str, limit: int) -> list[tuple[Chunk, str]]:
    """Up to `limit` (chunk, quote) pairs, best match first, skipping any quote that trips a safety filter."""
    used: list[tuple[Chunk, str]] = []
    best = max((c.score for c in chunks), default=0.0)
    for c in chunks:
        if c.score < best - RELATIVE_MARGIN:
            continue
        quote = excerpt(c.text, query)
        if not quote or safety.find_banned(quote) or safety.DOSING_OUTPUT.search(quote):
            continue
        used.append((c, quote))
        if len(used) == limit:
            break
    return used


def compose(used: list[tuple[Chunk, str]]) -> str:
    lines = [LEAD_IN, ""]
    for i, (c, quote) in enumerate(used, 1):
        page = f", p. {c.page}" if c.page else ""
        lines.append(f"{i}. “{quote}”")
        lines.append(f"— {c.source} ({c.publisher}, {c.version}{page})")
        lines.append("")
    return "\n".join(lines).strip()
