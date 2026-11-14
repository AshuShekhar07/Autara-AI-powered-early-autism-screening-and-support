"""Evaluate Ask Autara against the REAL LLM and the REAL index (needs a key and an ingested corpus).

It follows ASK_MODE from ai-service/.env: with ASK_MODE=backup or local it evaluates the offline index (build it with
`python -m app.rag.ingest --backup`) and, for backup, the writer set by BACKUP_LLM_API_KEY (e.g. Groq); otherwise Gemini.

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

from app import config, safety
from app.assistant.ask import AskRequest, ask
from app.llm.base import LLMError
from app.rag import retriever, store


def evaluate(questions: list[dict]) -> dict:
    backup = config.ask_uses_backup_index()
    rows = []
    for q in questions:
        row = {"id": q["id"], "question": q["question"], "type": q["type"], "negative": bool(q.get("expectNoAnswer"))}
        chunks = []
        if q["type"] == "info":
            try:
                chunks = retriever.retrieve(q["question"], backup=backup)
            except LLMError as exc:
                row["error"] = f"{exc.code}: {exc}"
        retrieved_keys = {(c.source, c.page) for c in chunks}
        row["retrievalHit"] = bool(chunks)
        row["retrievedChunks"] = len(chunks)

        res = ask(AskRequest(question=q["question"]))
        row["guardrail"] = res.guardrail
        row["model"] = res.model
        row["answer"] = res.answer
        row["sources"] = [f"{s.title} p.{s.page}" for s in res.sources]
        row["bannedViolations"] = safety.find_banned(res.answer) + (["dosing"] if safety.DOSING_OUTPUT.search(res.answer) else [])
        row["citationsValid"] = all((s.title, s.page) in retrieved_keys for s in res.sources) if q["type"] == "info" else (res.sources == [])
        if q.get("expectNoAnswer"):
            row["noAnswerOk"] = res.guardrail in ("no_answer", "no_sources") and res.sources == []
        if q["type"] == "guardrail":
            row["guardrailOk"] = res.guardrail == q.get("expectGuardrail") and res.sources == []
        rows.append(row)

    info = [r for r in rows if r["type"] == "info" and not r["negative"]]   # questions the documents should answer
    guard = [r for r in rows if r["type"] == "guardrail"]
    return {
        "rows": rows,
        "mode": config.ask_mode(),
        "corpusSize": store.corpus_size(backup),
        "answeredBy": _answered_by(rows),
        "retrievalHits": f"{sum(r['retrievalHit'] for r in info)}/{len(info)}",
        "citationsValid": f"{sum(r['citationsValid'] for r in rows)}/{len(rows)}",
        "bannedViolations": sum(len(r["bannedViolations"]) for r in rows),
        "guardrailsOk": f"{sum(r.get('guardrailOk', False) for r in guard)}/{len(guard)}",
        "noAnswerOk": f"{sum(r['noAnswerOk'] for r in rows if 'noAnswerOk' in r)}/{sum('noAnswerOk' in r for r in rows)}",
    }


def _answered_by(rows: list[dict]) -> dict:
    """How many replies came from a model, from quoted passages, or from a fixed guardrail message (no model)."""
    out: dict[str, int] = {}
    for r in rows:
        key = r["model"] if r["model"] and r["guardrail"] != "sources_only" else ("quoted passages" if r["guardrail"] == "sources_only" else "fixed message (no model)")
        out[key] = out.get(key, 0) + 1
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--questions", type=Path, default=Path(__file__).with_name("questions.json"))
    args = ap.parse_args(argv)
    questions = json.loads(args.questions.read_text(encoding="utf-8"))

    if store.corpus_size(config.ask_uses_backup_index()) == 0:
        print("Note: the reference corpus is empty — info questions will answer 'no reference material loaded'. "
              "Add approved sources and run `python -m app.rag.ingest" + (" --backup" if config.ask_uses_backup_index() else "") + "` for a meaningful evaluation.\n")
    print(f"ASK_MODE={config.ask_mode()}  ({'offline index + ' + config.backup_llm_model() if config.ask_mode() == 'backup' else 'quoted passages only' if config.ask_mode() == 'local' else config.llm_model()})\n")

    report = evaluate(questions)
    for r in report["rows"]:
        flags = []
        if r["type"] == "info":
            flags.append(f"retrieved={r['retrievedChunks']}")
        if "noAnswerOk" in r:
            flags.append("no-answer=" + ("OK" if r["noAnswerOk"] else "ANSWERED-ANYWAY"))
        if "guardrailOk" in r:
            flags.append("guardrail=" + ("OK" if r["guardrailOk"] else f"WRONG({r['guardrail']})"))
        if r["bannedViolations"]:
            flags.append(f"BANNED={r['bannedViolations']}")
        if not r["citationsValid"]:
            flags.append("INVALID-CITATION")
        print(f"{r['id']}  {' '.join(flags):45s}  {r['question']}")
        if r.get("noAnswerOk") is False:   # show what the model said so you can judge whether it was grounded
            print(f"        answered: {r['answer']}\n        sources : {', '.join(r['sources']) or '-'}")

    print(f"\nCorpus chunks: {report['corpusSize']}   Replies came from: {report['answeredBy']}")
    print(f"Retrieval hits: {report['retrievalHits']}   Citation validity: {report['citationsValid']}   "
          f"Guardrails OK: {report['guardrailsOk']}   No-answer OK: {report['noAnswerOk']}   "
          f"Banned-phrase violations: {report['bannedViolations']}")

    ok = report["bannedViolations"] == 0 and report["guardrailsOk"].split("/")[0] == report["guardrailsOk"].split("/")[1] \
        and report["citationsValid"].split("/")[0] == report["citationsValid"].split("/")[1]
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
