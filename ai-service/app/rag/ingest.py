"""Build the vector index from ai-service/knowledge/.

    cd ai-service && python -m app.rag.ingest          # ingest everything listed in sources.yaml
    python -m app.rag.ingest --reset                    # wipe the index first

Pipeline: sources.yaml → load (PDF pages / Markdown) → clean → chunk (~600 tokens, 80 overlap)
→ metadata → embed → Chroma.

Rules that matter
  * Only files LISTED in knowledge/sources.yaml are ingested — the team approves sources by adding them
    there. Unlisted files are reported and skipped.
  * Chunk ids are content hashes, so re-ingesting an unchanged file changes nothing (no duplicates), and
    chunks that no longer exist in a changed file are removed.
  * Patient data never enters the index: this module only reads the knowledge folder.
  * An empty corpus is fine: it simply builds nothing.
"""
from __future__ import annotations

import argparse
import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import yaml
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app import config
from app.llm.base import LLMError
from app.rag import store

# ≈ 4 characters per token for English prose → 600 tokens ≈ 2400 chars, 80 tokens ≈ 320 chars.
CHARS_PER_TOKEN = 4
CHUNK_TOKENS = 600
OVERLAP_TOKENS = 80
SUPPORTED = {".pdf", ".md", ".markdown", ".txt"}
REQUIRED_SOURCE_FIELDS = ("file", "title", "publisher", "url", "version", "docType")


@dataclass
class Report:
    files_ingested: int = 0
    chunks_total: int = 0
    chunks_added: int = 0
    chunks_removed: int = 0
    warnings: list[str] = field(default_factory=list)


@dataclass
class Page:
    text: str
    page: int | None      # PDF page (1-based); None for Markdown / text
    section: str          # nearest heading ("" when unknown)


def load_sources(kdir: Path) -> list[dict]:
    path = kdir / "sources.yaml"
    if not path.exists():
        return []
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return data.get("sources") or []


def clean(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("­", "")
    text = re.sub(r"-\n(?=[a-z])", "", text)           # join words hyphenated across line breaks
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def load_pages(path: Path) -> list[Page]:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        return [Page(page.extract_text() or "", i + 1, "") for i, page in enumerate(reader.pages)]
    text = path.read_text(encoding="utf-8")
    if suffix in (".md", ".markdown"):
        return _markdown_sections(text)
    return [Page(text, None, "")]


def _markdown_sections(text: str) -> list[Page]:
    """One Page per heading section, so `section` metadata is exact."""
    pages, heading, buf = [], "", []
    for line in text.splitlines():
        m = re.match(r"^#{1,6}\s+(.*)", line)
        if m:
            if buf:
                pages.append(Page("\n".join(buf), None, heading))
            heading, buf = m.group(1).strip(), []
        else:
            buf.append(line)
    if buf:
        pages.append(Page("\n".join(buf), None, heading))
    return pages


def chunk_id(source_file: str, page: int | None, index: int, text: str) -> str:
    digest = hashlib.sha256(f"{source_file}|{page}|{index}|{text}".encode("utf-8")).hexdigest()
    return digest[:32]


def build_chunks(src: dict, kdir: Path) -> list[dict]:
    path = kdir / src["file"]
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_TOKENS * CHARS_PER_TOKEN,
        chunk_overlap=OVERLAP_TOKENS * CHARS_PER_TOKEN,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    now = datetime.now(timezone.utc).isoformat()
    chunks = []
    for page in load_pages(path):
        text = clean(page.text)
        if not text:
            continue
        for i, piece in enumerate(splitter.split_text(text)):
            chunks.append({
                "id": chunk_id(src["file"], page.page, i, piece),
                "text": piece,
                "metadata": {
                    "source": src["title"],
                    "source_file": src["file"],
                    "publisher": src["publisher"],
                    "url": src["url"],
                    "version": str(src["version"]),
                    "docType": src["docType"],
                    "page": page.page if page.page is not None else -1,  # Chroma metadata can't hold None
                    "section": page.section,
                    "ingestedAt": now,
                },
            })
    return chunks


def ingest(reset: bool = False) -> Report:
    from app.llm.factory import get_provider

    kdir = config.knowledge_dir()
    report = Report()
    sources = load_sources(kdir)

    listed = {s.get("file") for s in sources}
    for f in sorted(kdir.glob("*")):
        if f.suffix.lower() in SUPPORTED and f.name not in listed and f.name.lower() != "readme.md":
            report.warnings.append(f"{f.name} is not listed in sources.yaml — skipped (add it once approved).")

    collection = store.get_collection()
    if reset and collection.count():
        collection.delete(ids=collection.get()["ids"])

    provider = None
    for src in sources:
        missing = [k for k in REQUIRED_SOURCE_FIELDS if not src.get(k)]
        if missing:
            report.warnings.append(f"Source entry {src.get('file', '?')} is missing fields {missing} — skipped.")
            continue
        path = (kdir / src["file"]).resolve()
        if kdir.resolve() not in path.parents:
            report.warnings.append(f"{src['file']} is outside the knowledge folder — skipped.")
            continue
        if not path.exists():
            report.warnings.append(f"{src['file']} listed in sources.yaml but not found — skipped.")
            continue

        chunks = build_chunks(src, kdir)
        new_ids = {c["id"] for c in chunks}
        existing = collection.get(where={"source_file": src["file"]})
        old_ids = set(existing["ids"])

        stale = old_ids - new_ids
        if stale:
            collection.delete(ids=list(stale))
            report.chunks_removed += len(stale)

        to_add = [c for c in chunks if c["id"] not in old_ids]  # unchanged chunks are not re-embedded
        if to_add:
            provider = provider or get_provider()
            vectors = provider.embed([c["text"] for c in to_add], "document")
            collection.upsert(
                ids=[c["id"] for c in to_add],
                embeddings=vectors,
                documents=[c["text"] for c in to_add],
                metadatas=[c["metadata"] for c in to_add],
            )
        report.files_ingested += 1
        report.chunks_total += len(chunks)
        report.chunks_added += len(to_add)
    return report


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Ingest approved reference documents into the vector index.")
    ap.add_argument("--reset", action="store_true", help="delete everything in the index first")
    args = ap.parse_args(argv)
    try:
        report = ingest(reset=args.reset)
    except LLMError as exc:
        print(f"Embedding failed ({exc.code}): {exc}")
        return 1
    for w in report.warnings:
        print(f"warning: {w}")
    print(f"Ingested {report.files_ingested} file(s): {report.chunks_total} chunks "
          f"({report.chunks_added} new, {report.chunks_removed} removed). Index size: {store.corpus_size()}")
    if report.files_ingested == 0:
        print("Nothing to ingest — the knowledge folder has no approved sources yet (see knowledge/README.md).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
