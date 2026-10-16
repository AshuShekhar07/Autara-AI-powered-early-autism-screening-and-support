from tests.test_mchatr import all_answers, with_n_at_risk


def test_screen_requires_internal_key(client):
    r = client.post("/screen", json={"answers": all_answers(False)})
    assert r.status_code == 401


def test_screen_returns_contract_and_null_model_when_none_installed(client, auth, monkeypatch, tmp_path):
    monkeypatch.setattr("ml.inference.MODEL_PATH", tmp_path / "missing.joblib")
    r = client.post("/screen", json={"answers": with_n_at_risk(8)}, headers=auth)
    assert r.status_code == 200
    body = r.json()
    assert body["riskScore"] == 8 and body["riskTier"] == "high"
    assert body["modelProbability"] is None
    assert body["modelVersion"] == "mchatr-rules-v1"
    assert set(body) == {"riskScore", "riskTier", "atRiskItems", "domainBreakdown", "modelProbability", "modelVersion"}


def test_screen_rejects_incomplete_answers(client, auth):
    answers = all_answers(False)
    del answers[3]
    r = client.post("/screen", json={"answers": answers}, headers=auth)
    assert r.status_code == 422


def test_instrument_endpoint(client, auth):
    body = client.get("/instrument", headers=auth).json()
    assert len(body["items"]) == 20 and "copyright" in body and "disclaimer" in body
