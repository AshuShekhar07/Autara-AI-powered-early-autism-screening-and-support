import yaml

from app.rag import ingest, retriever, store
from tests.helpers import chunk  # noqa: F401  (keeps helpers importable)


def write_source(kdir, name="guide.md", text="# Intro\nFirst section text about pointing.\n\n# Second\nOther text about noise.", **meta):
    (kdir / name).write_text(text, encoding="utf-8")
    entry = {"file": name, "title": "Demo Guide", "publisher": "Demo Publisher", "url": "https://example.test", "version": "1", "docType": "guideline", **meta}
    path = kdir / "sources.yaml"
    existing = (yaml.safe_load(path.read_text()) or {}).get("sources", []) if path.exists() else []
    existing = [e for e in existing if e["file"] != name] + [entry]
    path.write_text(yaml.safe_dump({"sources": existing}), encoding="utf-8")


def test_empty_knowledge_folder_ingests_nothing_and_does_not_need_an_api_key(fake):
    report = ingest.ingest()
    assert report.files_ingested == 0 and store.corpus_size() == 0
    assert fake.embed_calls == 0


def test_ingest_stores_chunks_with_metadata(kdir, fake):
    write_source(kdir)
    report = ingest.ingest()
    assert report.files_ingested == 1 and report.chunks_total == store.corpus_size() == 2
    got = store.get_collection().get()
    metas = got["metadatas"]
    assert {m["section"] for m in metas} == {"Intro", "Second"}
    assert all(m["source"] == "Demo Guide" and m["docType"] == "guideline" and m["version"] == "1" and m["ingestedAt"] for m in metas)
    assert all(m["page"] == -1 for m in metas)


def test_reingesting_the_same_file_creates_no_duplicates_and_does_not_reembed(kdir, fake):
    write_source(kdir)
    ingest.ingest()
    calls = fake.embed_calls
    again = ingest.ingest()
    assert store.corpus_size() == 2
    assert again.chunks_added == 0 and again.chunks_removed == 0
    assert fake.embed_calls == calls            # unchanged chunks are not embedded again


def test_changed_file_replaces_only_what_changed(kdir, fake):
    write_source(kdir)
    ingest.ingest()
    write_source(kdir, text="# Intro\nFirst section text about pointing.\n\n# Second\nCompletely new text.")
    report = ingest.ingest()
    assert report.chunks_added == 1 and report.chunks_removed == 1 and store.corpus_size() == 2
    docs = " ".join(store.get_collection().get()["documents"])
    assert "Completely new text" in docs and "Other text about noise" not in docs


def test_unlisted_and_missing_files_are_reported_not_ingested(kdir, fake):
    write_source(kdir)
    (kdir / "unapproved.md").write_text("# X\nSomething not approved.", encoding="utf-8")
    path = kdir / "sources.yaml"
    data = yaml.safe_load(path.read_text())
    data["sources"].append({"file": "ghost.pdf", "title": "t", "publisher": "p", "url": "u", "version": "1", "docType": "guideline"})
    path.write_text(yaml.safe_dump(data))
    report = ingest.ingest()
    assert any("unapproved.md" in w and "not listed" in w for w in report.warnings)
    assert any("ghost.pdf" in w and "not found" in w for w in report.warnings)
    assert "Something not approved" not in " ".join(store.get_collection().get()["documents"])


def test_incomplete_source_entries_are_skipped(kdir, fake):
    (kdir / "a.md").write_text("# H\ntext", encoding="utf-8")
    (kdir / "sources.yaml").write_text(yaml.safe_dump({"sources": [{"file": "a.md", "title": "T"}]}))
    report = ingest.ingest()
    assert report.files_ingested == 0 and any("missing fields" in w for w in report.warnings)


def test_paths_outside_the_knowledge_folder_are_refused(kdir, fake, tmp_path):
    (tmp_path / "secret.md").write_text("# H\npatient data", encoding="utf-8")
    (kdir / "sources.yaml").write_text(yaml.safe_dump({"sources": [
        {"file": "../secret.md", "title": "T", "publisher": "p", "url": "u", "version": "1", "docType": "guideline"}]}))
    report = ingest.ingest()
    assert report.files_ingested == 0 and any("outside the knowledge folder" in w for w in report.warnings)


def test_reset_wipes_the_index_first(kdir, fake):
    write_source(kdir)
    ingest.ingest()
    (kdir / "sources.yaml").write_text(yaml.safe_dump({"sources": []}))
    ingest.ingest(reset=True)
    assert store.corpus_size() == 0


def test_long_text_is_split_into_overlapping_chunks(kdir, fake):
    sentences = " ".join(f"Sentence number {i} talks about joint attention and pointing." for i in range(400))
    write_source(kdir, text=sentences)
    ingest.ingest()
    assert store.corpus_size() > 1


def test_pdf_pages_keep_page_numbers(kdir, fake):
    from tests.pdf import tiny_pdf
    (kdir / "doc.pdf").write_bytes(tiny_pdf(["Page one text about pointing.", "Page two text about noise."]))
    (kdir / "sources.yaml").write_text(yaml.safe_dump({"sources": [
        {"file": "doc.pdf", "title": "Demo PDF", "publisher": "p", "url": "u", "version": "1", "docType": "guideline"}]}))
    ingest.ingest()
    pages = sorted(m["page"] for m in store.get_collection().get()["metadatas"])
    assert pages == [1, 2]


def test_retriever_returns_relevant_chunks_above_threshold_and_empty_for_empty_corpus(kdir, fake, monkeypatch):
    assert retriever.retrieve("anything at all") == []              # empty corpus, no key needed
    write_source(kdir)
    ingest.ingest()
    hits = retriever.retrieve("pointing first section", k=5, min_similarity=0.2)
    assert hits and hits[0].source == "Demo Guide" and hits[0].section == "Intro"
    assert hits[0].score >= 0.2 and hits[0].page is None
    assert retriever.retrieve("pointing first section", min_similarity=0.999) == []   # nothing that close → dropped


def test_build_query_uses_flagged_areas_and_patterns():
    q = retriever.build_query(["Joint attention"], ["transition then meltdown"])
    assert "Joint attention" in q and "transition then meltdown" in q
    assert retriever.build_query([], [])
