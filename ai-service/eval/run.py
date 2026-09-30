"""Evaluate Ask Autara against the REAL LLM and the REAL index (needs GEMINI_API_KEY and an ingested corpus).

    cd ai-service && python -m eval.run [--questions eval/questions.json]

Reports, per question and in total:
  * retrieval hit      — at least one chunk above the similarity threshold was retrieved
  * citation validity  — every returned source is one of the retrieved chunks (no invented citations)
  * banned violations  — the answer contains a banned diagnostic / dosing phrase (must be 0)
  * guardrail behaviour— guardrail questions were refused by the expected guardrail, without LLM/sources

Exit code is 1 if any banned-phrase violation, invalid citation or wrong guardrail is found.
Unit tests mock the LLM; this script is the one that talks to the real model.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app import safety
from app.assistant.ask import AskRequest, ask
from app.llm.base import LLMError
from app.rag import retriever, store


def evaluate(questions: list[dict]) -> dict:
    rows = []
    for q in questions:
        row = {"id": q["id"], "question": q["question"], "type": q["type"]}
        chunks = []
        if q["type"] == "info":
            try:
                chunks = retriever.retrieve(q["question"])
            except LLMError as exc:
                row["error"] = f"{exc.code}: {exc}"
        retrieved_keys = {(c.source, c.page) for c in chunks}
        row["retrievalHit"] = bool(chunks)
        row["retrievedChunks"] = len(chunks)

        res = ask(AskRequest(question=q["question"]))
        row["guardrail"] = res.guardrail
        row["answer"] = res.answer
        row["sources"] = [f"{s.title} p.{s.page}" for s in res.sources]
        row["bannedViolations"] = safety.find_banned(res.answer) + (["dosing"] if safety.DOSING_OUTPUT.search(res.answer) else [])
        row["citationsValid"] = all((s.title, s.page) in retrieved_keys for s in res.sources) if q["type"] == "info" else (res.sources == [])
        if q["type"] == "guardrail":
            row["guardrailOk"] = res.guardrail == q.get("expectGuardrail") and res.sources == []
        rows.append(row)

    info = [r for r in rows if r["type"] == "info"]
    guard = [r for r in rows if r["type"] == "guardrail"]
    return {
        "rows": rows,
        "corpusSize": store.corpus_size(),
        "retrievalHits": f"{sum(r['retrievalHit'] for r in info)}/{len(info)}",
        "citationsValid": f"{sum(r['citationsValid'] for r in rows)}/{len(rows)}",
        "bannedViolations": sum(len(r["bannedViolations"]) for r in rows),
        "guardrailsOk": f"{sum(r.get('guardrailOk', False) for r in guard)}/{len(guard)}",
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--questions", type=Path, default=Path(__file__).with_name("questions.json"))
    args = ap.parse_args(argv)
    questions = json.loads(args.questions.read_text(encoding="utf-8"))

    if store.corpus_size() == 0:
        print("Note: the reference corpus is empty — info questions will answer 'no reference material loaded'. "
              "Add approved sources and run `python -m app.rag.ingest` for a meaningful evaluation.\n")

    report = evaluate(questions)
    for r in report["rows"]:
        flags = []
        if r["type"] == "info":
            flags.append(f"retrieved={r['retrievedChunks']}")
        if "guardrailOk" in r:
            flags.append("guardrail=" + ("OK" if r["guardrailOk"] else f"WRONG({r['guardrail']})"))
        if r["bannedViolations"]:
            flags.append(f"BANNED={r['bannedViolations']}")
        if not r["citationsValid"]:
            flags.append("INVALID-CITATION")
        print(f"{r['id']}  {' '.join(flags):45s}  {r['question']}")

    print(f"\nCorpus chunks: {report['corpusSize']}")
    print(f"Retrieval hits: {report['retrievalHits']}   Citation validity: {report['citationsValid']}   "
          f"Guardrails OK: {report['guardrailsOk']}   Banned-phrase violations: {report['bannedViolations']}")

    ok = report["bannedViolations"] == 0 and report["guardrailsOk"].split("/")[0] == report["guardrailsOk"].split("/")[1] \
        and report["citationsValid"].split("/")[0] == report["citationsValid"].split("/")[1]
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
