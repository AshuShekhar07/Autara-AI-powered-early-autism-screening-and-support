"""Clinician insights without Gemini: passages from the offline index, text written by the backup writer (e.g. Groq)."""
import pytest

from app import config
from app.insights.generator import generate_insight
from app.llm import factory
from app.llm.base import LLMError
from tests.fakes import FakeProvider
from tests.helpers import good_insight, make_request
from tests.test_ask_backup import build_backup


def writer(*responses):
    p = FakeProvider(list(responses)); p.name, p.model = "backup-llm", "writer-test"
    return p


@pytest.fixture
def backup_mode(monkeypatch):
    monkeypatch.setenv("ASK_MODE", "backup"); monkeypatch.setenv("BACKUP_LLM_API_KEY", "k"); monkeypatch.setenv("RAG_BACKUP_MIN_SIMILARITY", "0.0")


def test_mode_follows_ask_mode_unless_set(monkeypatch):
    monkeypatch.setenv("ASK_MODE", "auto");   assert config.insights_mode() == "gemini"
    monkeypatch.setenv("ASK_MODE", "backup"); assert config.insights_mode() == "backup"
    monkeypatch.setenv("INSIGHTS_MODE", "gemini"); assert config.insights_mode() == "gemini"
    monkeypatch.setenv("ASK_MODE", "auto"); monkeypatch.setenv("INSIGHTS_MODE", "backup"); assert config.insights_mode() == "backup"


def test_backup_mode_uses_the_offline_index_and_the_writer_and_never_gemini(kdir, fake_local, fake, backup_mode, monkeypatch):
    build_backup(kdir, fake_local)
    w = writer(good_insight())
    monkeypatch.setattr(factory, "get_backup_llm_provider", lambda timeout_s=None: w)
    res = generate_insight(make_request())
    assert res.status == "generated" and res.model == "writer-test"
    assert fake.embed_calls == 0 and fake.prompts == []                      # Gemini untouched
    assert res.retrievedChunkIds and "RETRIEVED REFERENCE MATERIAL" in w.prompts[0][1]
    assert res.insight["uncertainty"] and res.readingGrade is not None


def test_only_the_best_few_passages_are_sent(kdir, fake_local, backup_mode, monkeypatch):
    build_backup(kdir, fake_local)
    monkeypatch.setenv("ASK_BACKUP_MAX_PASSAGES", "1")
    monkeypatch.setattr(factory, "get_backup_llm_provider", lambda timeout_s=None: writer(good_insight()))
    res = generate_insight(make_request())
    assert len(res.retrievedChunkIds) == 1


def test_without_a_backup_key_the_insight_fails_clearly(kdir, fake_local, monkeypatch):
    monkeypatch.setenv("ASK_MODE", "backup"); monkeypatch.delenv("BACKUP_LLM_API_KEY", raising=False)
    res = generate_insight(make_request())
    assert res.status == "failed" and res.failureReasons == ["LLM_NOT_CONFIGURED"]


def test_writer_outage_is_reported_as_a_failed_insight_not_a_crash(kdir, fake_local, backup_mode, monkeypatch):
    build_backup(kdir, fake_local)
    monkeypatch.setattr(factory, "get_backup_llm_provider", lambda timeout_s=None: writer(LLMError("LLM_ERROR", "HTTP 429")))
    res = generate_insight(make_request())
    assert res.status == "failed" and res.failureReasons == ["LLM_ERROR"]


@pytest.mark.parametrize("bad_text", ["Your child has autism.", "Give 5 mg of melatonin at night."])
def test_the_same_safety_validator_rejects_unsafe_writer_output(kdir, fake_local, backup_mode, monkeypatch, bad_text):
    build_backup(kdir, fake_local)
    bad = good_insight(caregiverSummary=bad_text)
    monkeypatch.setattr(factory, "get_backup_llm_provider", lambda timeout_s=None: writer(bad, bad))
    res = generate_insight(make_request())
    assert res.status == "failed" and any(r.startswith(("BANNED_PHRASE", "DOSING_CONTENT")) for r in res.failureReasons)


def test_an_empty_backup_index_still_gives_an_evidence_only_insight(kdir, fake_local, backup_mode, monkeypatch):
    monkeypatch.setattr(factory, "get_backup_llm_provider", lambda timeout_s=None: writer(good_insight()))
    res = generate_insight(make_request())
    assert res.status == "generated" and res.retrievedChunkIds == [] and "No reference material" in res.insight["uncertainty"]
