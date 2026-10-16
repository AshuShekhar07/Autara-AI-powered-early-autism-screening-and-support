"""Retrieval-only check (no answers are generated):   python -m eval.scores [--questions eval/questions.json]

For every "info" question it prints the best matching chunks with their cosine similarity, then a table showing how many
questions would still find at least one chunk at different RAG_MIN_SIMILARITY values. Use it to choose the threshold and to
see whether your questions really match your documents. Needs GEMINI_API_KEY (embeddings) and an ingested corpus.

Optional per-question fields:  "expectNoAnswer": true  marks a question no document answers (it should NOT find chunks);
  "expectSection": "text"  — if the best chunk's source title or section contains that text
the question counts as a top-1 match.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.llm.base import LLMError
from app.rag import retriever, store

THRESHOLDS = (0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75)


def evaluate(questions: list[dict], k: int = 5) -> dict:
    rows = []
    for q in (q for q in questions if q["type"] == "info"):
        negative = bool(q.get("expectNoAnswer"))
        chunks = retriever.retrieve(q["question"], k=k, min_similarity=0.0)
        best = chunks[0].score if chunks else 0.0
        row = {"id": q["id"], "question": q["question"], "best": best, "negative": negative,
               "top": [(c.score, c.source, c.section, c.page) for c in chunks]}
        if q.get("expectSection"):
            want = q["expectSection"].lower()
            row["top1Match"] = bool(chunks) and (want in chunks[0].section.lower() or want in chunks[0].source.lower())
        rows.append(row)
    pos = [r for r in rows if not r["negative"]]
    neg = [r for r in rows if r["negative"]]
    table = {t: sum(r["best"] >= t for r in pos) for t in THRESHOLDS}
    neg_table = {t: sum(r["best"] >= t for r in neg) for t in THRESHOLDS}
    expect = [r for r in pos if "top1Match" in r]
    return {"rows": rows, "thresholdTable": table, "negativeTable": neg_table, "total": len(pos), "negTotal": len(neg),
            "top1": f"{sum(r['top1Match'] for r in expect)}/{len(expect)}" if expect else "n/a"}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--questions", type=Path, default=Path(__file__).with_name("questions.json"))
    args = ap.parse_args(argv)
    if store.corpus_size() == 0:
        print("The reference corpus is empty. Add documents and run `python -m app.rag.ingest` first.")
        return 1
    try:
        report = evaluate(json.loads(args.questions.read_text(encoding="utf-8")))
    except LLMError as exc:
        print(f"Embedding failed ({exc.code}): {exc}")
        return 1
    for r in report["rows"]:
        tag = "  [should find nothing]" if r["negative"] else ""
        print(f"{r['id']}  best={r['best']:.3f}  {r['question']}{tag}")
        for score, source, section, page in r["top"][:3]:
            where = f"p.{page}" if page else (section or "-")
            print(f"        {score:.3f}  {source} · {where}")
    print("\nBy threshold:  [questions the documents answer that still find a chunk]  vs  [questions with no answer that wrongly find one]")
    for t, n in report["thresholdTable"].items():
        print(f"  RAG_MIN_SIMILARITY >= {t:<4}  found {n}/{report['total']}   wrongly found {report['negativeTable'][t]}/{report['negTotal']}")
    print("Pick the strictest threshold where 'found' is still high and 'wrongly found' is 0.")
    print(f"Top-1 matches expectSection: {report['top1']}   Corpus chunks: {store.corpus_size()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
