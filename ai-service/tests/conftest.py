import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.fakes import FakeProvider

TEST_KEY = "test-internal-key"


@pytest.fixture(autouse=True)
def _env(monkeypatch, tmp_path):
    monkeypatch.setenv("AI_SERVICE_KEY", TEST_KEY)
    # every test gets its own empty vector store and knowledge folder
    monkeypatch.setenv("CHROMA_DIR", str(tmp_path / "chroma"))
    kdir = tmp_path / "knowledge"
    kdir.mkdir()
    monkeypatch.setenv("KNOWLEDGE_DIR", str(kdir))
    monkeypatch.setenv("RAG_MIN_SIMILARITY", "0.2")   # hashed-word fake embeddings are coarser than real ones
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth():
    return {"X-Internal-Key": TEST_KEY}


@pytest.fixture
def kdir(tmp_path):
    return tmp_path / "knowledge"


@pytest.fixture
def fake(monkeypatch):
    """Installs a FakeProvider as THE provider for the whole service."""
    provider = FakeProvider()
    monkeypatch.setattr("app.llm.factory.get_provider", lambda: provider)
    return provider
