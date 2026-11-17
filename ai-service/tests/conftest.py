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
    # A developer's real ai-service/.env is loaded at import: never let it leak into tests (modes, keys, thresholds)
    monkeypatch.setenv("ASK_MODE", "auto")
    for name in ("BACKUP_LLM_API_KEY", "BACKUP_LLM_BASE_URL", "BACKUP_LLM_MODEL", "BACKUP_LLM_TIMEOUT_MS", "MISTRAL_API_KEY",
                 "MISTRAL_MODEL", "MISTRAL_BASE_URL", "MISTRAL_TIMEOUT_MS", "RAG_BACKUP_MIN_SIMILARITY", "ASK_BACKUP_MAX_PASSAGES",
                 "RAG_TOP_K", "LLM_PROVIDER", "LLM_MODEL", "EMBEDDING_MODEL"):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture(autouse=True)
def _no_real_network(monkeypatch):
    """Tests must never call a real AI service (it would spend a real key's quota). Mocked transports are unaffected."""
    import httpx

    def blocked(self, request):
        raise AssertionError(f"a test tried a real network call to {request.url}")
    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", blocked)


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


@pytest.fixture
def fake_local(monkeypatch):
    """Installs a FakeProvider as the OFFLINE embedder used by the backup (sources-only) index."""
    provider = FakeProvider()
    monkeypatch.setattr("app.llm.factory.get_local_provider", lambda: provider)
    return provider
