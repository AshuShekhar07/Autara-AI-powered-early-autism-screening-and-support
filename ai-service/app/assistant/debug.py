"""Step-by-step Ask Autara diagnosis:   python -m app.assistant.debug "Who can see my child's screening?"

Runs each stage separately (index → embed → retrieve → generate → validate) and prints what happened,
so you can see which one fails. Nothing is stored. Your key is never printed.
"""
from __future__ import annotations

import sys

from app import config
from app.assistant import ask as ask_mod
from app.rag import retriever, store


def _redact(text: str) -> str:
    key = config.gemini_api_key()
    return text.replace(key, "***") if key else text


def main(argv: list[str] | None = None) -> int:
    question = " ".join((argv if argv is not None else sys.argv[1:])) or "Who can see my child's screening?"
    print(f"Question: {question}")
    print(f"Index size: {store.corpus_size()}  (similarity threshold {config.rag_min_similarity()})")

    try:
        weak = retriever.retrieve(question, min_similarity=0.0)
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL  retrieval/embedding: {type(exc).__name__}: {_redact(str(exc))[:300]}")
        return 1
    for c in weak:
        print(f"  match {c.score:.3f}  {c.section or '(no section)'}")
    chunks = [c for c in weak if c.score >= config.rag_min_similarity()]
    print(f"PASS  retrieval: {len(weak)} candidates, {len(chunks)} above threshold")
    if not chunks:
        print("→ Ask Autara would say it doesn't know. Lower RAG_MIN_SIMILARITY in ai-service/.env (e.g. 0.4).")
        return 1

    from app.llm.factory import get_provider
    provider = get_provider()
    req = ask_mod.AskRequest(question=question)
    try:
        raw = provider.generate_json(ask_mod.load_prompt(ask_mod.PROMPT_NAME), ask_mod._user_prompt(req, chunks))
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL  generation: {_redact(str(exc.__cause__ or exc))[:300]}")
        return 1
    print(f"PASS  generation ({len(raw)} characters)")
    parsed, reason = ask_mod._validate(raw, len(chunks))
    if parsed:
        print(f"PASS  validation. Answer: {parsed['answer'][:300]}")
        return 0
    print(f"FAIL  validation: {reason}\nModel output was:\n{raw[:600]}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
