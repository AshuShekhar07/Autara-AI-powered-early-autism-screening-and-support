"""Step-by-step Ask Autara diagnosis:   python -m app.assistant.debug "Who can see my child's screening?"
Backup (offline) mode:                python -m app.assistant.debug --local "Who can see my child's screening?"

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


def _local(question: str) -> int:
    """The sources-only backup path: local embeddings, no key, no LLM."""
    from app.assistant import excerpts
    print(f"Question: {question}")
    print(f"Backup index size: {store.corpus_size(backup=True)}  (similarity threshold {config.rag_backup_min_similarity()}, ASK_MODE={config.ask_mode()})")
    if store.corpus_size(backup=True) == 0:
        print("FAIL  the backup index is empty. Build it with:  python -m app.rag.ingest --backup")
        return 1
    try:
        weak = retriever.retrieve(question, min_similarity=0.0, backup=True)
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL  local embedding: {type(exc).__name__}: {str(exc)[:300]}")
        return 1
    for c in weak:
        print(f"  match {c.score:.3f}  {c.section or '(no section)'}")
    chunks = [c for c in weak if c.score >= config.rag_backup_min_similarity()]
    used = excerpts.pick(chunks, question, config.backup_max_passages())
    print(f"PASS  retrieval: {len(weak)} candidates, {len(chunks)} above threshold, {len(used)} passage(s) shown")
    if not used:
        print("→ Ask Autara would say it doesn't know. Lower RAG_BACKUP_MIN_SIMILARITY (e.g. 0.25) if good matches are being dropped.")
        return 1
    print("\n" + excerpts.compose(used))
    return 0


def main(argv: list[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    local = "--local" in args
    question = " ".join(a for a in args if a != "--local") or "Who can see my child's screening?"
    if local:
        return _local(question)
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
