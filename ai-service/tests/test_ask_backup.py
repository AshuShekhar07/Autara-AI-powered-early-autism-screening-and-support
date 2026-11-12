"""Backup mode of Ask Autara: quotes from the approved documents, found with the local embedder, no LLM."""
import pytest

from app import config
from app.assistant import excerpts, guardrails
from app.assistant.ask import AskRequest, ask
from app.llm.base import LLMError
from app.rag import ingest, store
from tests.fakes import FakeProvider, down
from tests.helpers import chunk
from tests.test_ingest import write_source

POINTING = ("Pointing to share interest is an early social skill. Many toddlers point at things they want to show "
            "someone by about fourteen months. Clinicians often ask about it during developmental check-ups.")
NOISE = "The clinic car park is open from eight in the morning. Bicycles can be left at the front gate."


def build_backup(kdir, fake_local):
    write_source(kdir, "guide.md", f"# Pointing\n{POINTING}\n\n# Parking\n{NOISE}")
    return ingest.ingest(backup=True)


def test_backup_index_is_separate_and_needs_no_main_provider(kdir, fake_local, fake):
    report = build_backup(kdir, fake_local)
    assert report.chunks_total == 2
    assert store.corpus_size(backup=True) == 2 and store.corpus_size() == 0
    assert fake.embed_calls == 0 and fake_local.embed_calls >= 1       # the main (Gemini) provider was never used


def test_gemini_outage_falls_back_to_quoted_passages(kdir, fake_local, monkeypatch):
    build_backup(kdir, fake_local)
    monkeypatch.setenv("RAG_BACKUP_MIN_SIMILARITY", "0.2")
    res = ask(AskRequest(question="When do toddlers point to share interest?"),
              provider=FakeProvider([down()]), retrieve=lambda q: [chunk()])
    assert res.guardrail == "sources_only" and res.model == "local-sources-only" and res.contextUsed is False
    assert res.answer.startswith(excerpts.LEAD_IN)
    assert "Pointing to share interest" in res.answer and "car park" not in res.answer
    assert [s.title for s in res.sources] == ["Demo Guide"]


def test_embedding_outage_also_falls_back(kdir, fake_local, monkeypatch):
    build_backup(kdir, fake_local)
    monkeypatch.setenv("RAG_BACKUP_MIN_SIMILARITY", "0.2")
    def broken(_q):
        raise LLMError("EMBEDDING_ERROR", "Gemini embedding failed: ClientError 403")
    res = ask(AskRequest(question="When do toddlers point to share interest?"), provider=FakeProvider(), retrieve=broken)
    assert res.guardrail == "sources_only"


def test_empty_main_index_still_uses_the_backup(kdir, fake_local, fake, monkeypatch):
    build_backup(kdir, fake_local)
    monkeypatch.setenv("RAG_BACKUP_MIN_SIMILARITY", "0.2")
    res = ask(AskRequest(question="When do toddlers point to share interest?"))   # main index empty → "no_sources" → backup
    assert res.guardrail == "sources_only"


def test_without_a_backup_index_the_old_unavailable_message_is_kept(fake):
    res = ask(AskRequest(question="What is pointing?"), provider=FakeProvider([down()]), retrieve=lambda q: [chunk()])
    assert res.guardrail == "unavailable" and res.answer == guardrails.FAILED_MESSAGE


def test_unrelated_question_says_it_does_not_know(kdir, fake_local, monkeypatch):
    build_backup(kdir, fake_local)
    monkeypatch.setenv("RAG_BACKUP_MIN_SIMILARITY", "0.9")
    res = ask(AskRequest(question="Something about astronomy and volcanoes?"), provider=FakeProvider([down()]), retrieve=lambda q: [chunk()])
    assert res.guardrail == "no_answer" and res.answer == guardrails.DONT_KNOW_MESSAGE and res.sources == []


def test_local_mode_never_touches_gemini(kdir, fake_local, fake, monkeypatch):
    build_backup(kdir, fake_local)
    monkeypatch.setenv("ASK_MODE", "local")
    monkeypatch.setenv("RAG_BACKUP_MIN_SIMILARITY", "0.2")
    res = ask(AskRequest(question="When do toddlers point to share interest?"))
    assert res.guardrail == "sources_only" and fake.embed_calls == 0 and fake.prompts == []


def test_gemini_mode_has_no_backup(kdir, fake_local, monkeypatch):
    build_backup(kdir, fake_local)
    monkeypatch.setenv("ASK_MODE", "gemini")
    res = ask(AskRequest(question="What is pointing?"), provider=FakeProvider([down()]), retrieve=lambda q: [chunk()])
    assert res.guardrail == "unavailable"


def test_guardrails_still_come_first_in_backup_mode(kdir, fake_local, monkeypatch):
    build_backup(kdir, fake_local)
    monkeypatch.setenv("ASK_MODE", "local")
    for q, name in [("my child stopped breathing", "urgent_safety"), ("how much melatonin", "medication"), ("does he have autism", "diagnosis")]:
        assert ask(AskRequest(question=q)).guardrail == name
    assert fake_local.embed_calls == 1   # only the ingest embedded anything


def test_a_quote_that_trips_a_safety_filter_is_left_out(kdir, fake_local, monkeypatch):
    write_source(kdir, "guide.md", "# A\nGive 5 mg at night to help sleep routines.\n\n# B\nSleep routines can help children settle at night.")
    ingest.ingest(backup=True)
    monkeypatch.setenv("ASK_MODE", "local"); monkeypatch.setenv("RAG_BACKUP_MIN_SIMILARITY", "0.1")
    res = ask(AskRequest(question="sleep routines at night"))
    assert "5 mg" not in res.answer and "Sleep routines can help" in res.answer


def test_local_embedding_failure_degrades_to_unavailable(kdir, fake_local, monkeypatch):
    build_backup(kdir, fake_local)
    monkeypatch.setenv("ASK_MODE", "local")
    fake_local.embed = lambda texts, kind: (_ for _ in ()).throw(LLMError("EMBEDDING_ERROR", "model download failed"))
    assert ask(AskRequest(question="What is pointing?")).guardrail == "unavailable"


def test_excerpt_picks_the_matching_sentences_and_stays_short():
    text = "Intro sentence about nothing. " * 5 + "Pointing shows shared interest. It usually appears around fourteen months. " + "Closing remark. " * 5
    q = excerpts.excerpt(text, "when does pointing appear?")
    assert "Pointing shows shared interest." in q and len(q) <= excerpts.MAX_EXCERPT_CHARS + 2 and q.startswith("… ")
    assert len(excerpts.excerpt("word " * 400, "anything")) <= excerpts.MAX_EXCERPT_CHARS + 2


def test_config_defaults(monkeypatch):
    monkeypatch.delenv("ASK_MODE", raising=False)
    assert config.ask_mode() == "auto"
    monkeypatch.setenv("ASK_MODE", "nonsense")
    assert config.ask_mode() == "auto"


def test_weak_extra_passages_are_not_shown_next_to_a_strong_match():
    strong, weak = chunk(id="a", score=0.62, text="Only the caregiver and the care team can see a result."), chunk(id="b", score=0.40, text="Bicycles can be left at the gate.")
    used = excerpts.pick([strong, weak], "who can see a result", limit=3)
    assert [c.id for c, _ in used] == ["a"]
    close = chunk(id="c", score=0.55, text="Clinicians review each screening.")
    assert [c.id for c, _ in excerpts.pick([strong, close], "who can see a result", limit=3)] == ["a", "c"]
