"""Add an approved reference document without hand-editing YAML.

    cd ai-service
    python -m app.rag.add_source --file C:\\Downloads\\guide.pdf --title "Exact document title" \\
        --publisher "Publisher" --url "https://..." --version "2024" --type fact-sheet \\
        --licence "US government work, public domain" [--ingest]

What it does: copies the file into knowledge/, adds the entry to knowledge/sources.yaml (keeping the file's
comments), checks the result parses, and with --ingest builds the index. It never writes document text itself —
only your file is used. Adding a file here means YOUR TEAM APPROVES it as a source (check its licence first).
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import yaml

from app import config
from app.rag.ingest import SUPPORTED

DOC_TYPES = ("guideline", "screening-manual", "fact-sheet", "other")


def _q(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)  # JSON strings are valid YAML double-quoted strings


def add_source(file: Path, title: str, publisher: str, url: str, version: str, doc_type: str,
               licence: str = "", kdir: Path | None = None) -> Path:
    kdir = kdir or config.knowledge_dir()
    file = Path(file)
    if not file.is_file():
        raise SystemExit(f"File not found: {file}")
    if file.suffix.lower() not in SUPPORTED:
        raise SystemExit(f"Unsupported file type {file.suffix!r}. Use one of: {', '.join(sorted(SUPPORTED))}")
    if doc_type not in DOC_TYPES:
        raise SystemExit(f"--type must be one of: {', '.join(DOC_TYPES)}")
    for name, val in (("title", title), ("publisher", publisher), ("url", url), ("version", version)):
        if not val.strip():
            raise SystemExit(f"--{name} is required (it is shown to users as the citation).")

    kdir.mkdir(parents=True, exist_ok=True)
    target = kdir / file.name
    yaml_path = kdir / "sources.yaml"
    text = yaml_path.read_text(encoding="utf-8") if yaml_path.exists() else "sources: []\n"
    existing = (yaml.safe_load(text) or {}).get("sources") or []
    if any(s.get("file") == file.name for s in existing):
        raise SystemExit(f"{file.name} is already listed in sources.yaml.")

    entry = [f"  - file: {_q(file.name)}", f"    title: {_q(title)}", f"    publisher: {_q(publisher)}",
             f"    url: {_q(url)}", f"    version: {_q(version)}", f"    docType: {doc_type}"]
    if licence:
        entry.insert(0, f"  # licence: {licence.replace(chr(10), ' ')}")
    block = "\n".join(entry) + "\n"

    lines = text.rstrip("\n").split("\n")
    idx = next((i for i, l in enumerate(lines) if l.strip() == "sources: []"), None)
    if idx is not None:
        lines[idx:idx + 1] = ["sources:"] + block.rstrip("\n").split("\n")
        new_text = "\n".join(lines) + "\n"
    else:
        new_text = text.rstrip("\n") + "\n" + block

    parsed = yaml.safe_load(new_text)  # refuse to write a broken file
    if not parsed or not any(s.get("file") == file.name for s in parsed.get("sources", [])):
        raise SystemExit("Could not update sources.yaml safely — add the entry by hand (see knowledge/README.md).")

    if file.resolve() != target.resolve():
        shutil.copy2(file, target)
    yaml_path.write_text(new_text, encoding="utf-8")
    return target


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--file", required=True, type=Path)
    ap.add_argument("--title", required=True)
    ap.add_argument("--publisher", required=True)
    ap.add_argument("--url", required=True)
    ap.add_argument("--version", required=True, help="edition, year or retrieval date")
    ap.add_argument("--type", dest="doc_type", default="fact-sheet", choices=DOC_TYPES)
    ap.add_argument("--licence", default="", help="short note on why you may use it (recorded as a comment)")
    ap.add_argument("--ingest", action="store_true", help="build the index straight away (needs GEMINI_API_KEY)")
    args = ap.parse_args(argv)

    target = add_source(args.file, args.title, args.publisher, args.url, args.version, args.doc_type, args.licence)
    print(f"Added {target.name} to knowledge/sources.yaml.")
    if args.ingest:
        from app.rag import ingest
        return ingest.main([])
    print("Next: python -m app.rag.ingest")
    return 0


if __name__ == "__main__":
    sys.exit(main())
