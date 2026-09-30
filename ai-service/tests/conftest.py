import pytest
from fastapi.testclient import TestClient

from app.main import app

TEST_KEY = "test-internal-key"


@pytest.fixture(autouse=True)
def _internal_key(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_KEY", TEST_KEY)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth():
    return {"X-Internal-Key": TEST_KEY}
