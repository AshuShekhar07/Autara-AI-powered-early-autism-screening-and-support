import shutil
from pathlib import Path

import pytest
import yaml

from app.rag import add_source, ingest

SHIPPED = Path(__file__).resolve().parent.parent / "knowledge" / "sources.yaml"


@pytest.fixture
def doc(tmp_path):
    p = tmp_path / "downloads" / "guide.md"
    p.parent.mkdir()
    p.write_text("# Follow-up\nA follow-up interview asks more questions.", encoding="utf-8")
    return p


def _prepare(kdir):
    shutil.copy(SHIPPED, kdir / "sources.yaml")   # the real shipped file: comments + "sources: []"


def test_adds_first_entry_keeps_comments_and_ingests(kdir, doc, fake):
    _prepare(kdir)
    add_source.add_source(doc, "Guide: \"Follow-up\" & more", "Pub: lisher", "https://x.test/a?b=1", "2024", "fact-sheet", "public domain")
    text = (kdir / "sources.yaml").read_text(encoding="utf-8")
    assert text.startswith("# Approved reference documents")          # comments kept
    data = yaml.safe_load(text)
    assert data["sources"] == [{"file": "guide.md", "title": 'Guide: "Follow-up" & more', "publisher": "Pub: lisher",
                                "url": "https://x.test/a?b=1", "version": "2024", "docType": "fact-sheet"}]
    assert "# licence: public domain" in text
    assert (kdir / "guide.md").exists()
    assert ingest.ingest().files_ingested == 1                         # the entry really works with the ingester


def test_adds_second_entry_and_rejects_duplicates(kdir, doc, tmp_path):
    _prepare(kdir)
    add_source.add_source(doc, "One", "P", "https://x", "1", "guideline")
    other = tmp_path / "two.txt"
    other.write_text("hello", encoding="utf-8")
    add_source.add_source(other, "Two", "P", "https://y", "2", "other")
    assert [s["file"] for s in yaml.safe_load((kdir / "sources.yaml").read_text())["sources"]] == ["guide.md", "two.txt"]
    with pytest.raises(SystemExit):
        add_source.add_source(doc, "One again", "P", "https://x", "1", "guideline")


@pytest.mark.parametrize("kwargs", [
    {"title": " "}, {"publisher": ""}, {"url": ""}, {"version": " "}, {"doc_type": "blog"},
])
def test_rejects_missing_citation_fields(kdir, doc, kwargs):
    _prepare(kdir)
    args = dict(title="T", publisher="P", url="https://x", version="1", doc_type="fact-sheet") | kwargs
    with pytest.raises(SystemExit):
        add_source.add_source(doc, **args)


def test_rejects_missing_or_unsupported_files(kdir, tmp_path):
    _prepare(kdir)
    with pytest.raises(SystemExit):
        add_source.add_source(tmp_path / "nope.pdf", "T", "P", "u", "1", "other")
    exe = tmp_path / "x.exe"
    exe.write_text("x")
    with pytest.raises(SystemExit):
        add_source.add_source(exe, "T", "P", "u", "1", "other")
