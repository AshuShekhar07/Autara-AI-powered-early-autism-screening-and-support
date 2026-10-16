from fastapi import Depends

from app.main import app
from app.security import require_internal_key


# A protected probe route so we can test the dependency in isolation of business routes.
@app.get("/_probe", dependencies=[Depends(require_internal_key)])
def _probe():
    return {"ok": True}


def test_health_is_public(client):
    assert client.get("/health").json()["status"] == "ok"


def test_missing_key_is_rejected(client):
    assert client.get("/_probe").status_code == 401


def test_wrong_key_is_rejected(client):
    assert client.get("/_probe", headers={"X-Internal-Key": "nope"}).status_code == 401


def test_correct_key_is_accepted(client, auth):
    assert client.get("/_probe", headers=auth).json() == {"ok": True}


def test_fails_closed_when_key_not_configured(client, monkeypatch):
    monkeypatch.setenv("AI_SERVICE_KEY", "")
    assert client.get("/_probe", headers={"X-Internal-Key": ""}).status_code == 503
