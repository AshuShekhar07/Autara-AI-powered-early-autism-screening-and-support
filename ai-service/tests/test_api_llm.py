from tests.helpers import good_insight, make_request


def test_insights_requires_the_internal_key(client):
    assert client.post("/insights", json=make_request().model_dump()).status_code == 401
    assert client.post("/ask", json={"question": "hi"}).status_code == 401
    assert client.post("/ingest").status_code == 401


def test_insights_without_an_api_key_fails_gracefully(client, auth):
    body = client.post("/insights", json=make_request().model_dump(), headers=auth).json()
    assert body["status"] == "failed" and body["failureReasons"] == ["LLM_NOT_CONFIGURED"]
    assert body["clinicalReviewRequired"] is True


def test_insights_endpoint_end_to_end_with_empty_corpus(client, auth, fake):
    fake.responses = [good_insight()]
    body = client.post("/insights", json=make_request().model_dump(), headers=auth).json()
    assert body["status"] == "generated" and body["retrievedChunkIds"] == []
    assert all(a["references"] == [] for a in body["insight"]["flaggedAreas"])
    assert "No reference material was available" in body["insight"]["uncertainty"]


def test_insights_rejects_unexpected_fields(client, auth):
    data = make_request().model_dump()
    data["childName"] = "Alex"
    assert client.post("/insights", json=data, headers=auth).status_code == 422


def test_ask_with_empty_corpus_needs_no_api_key(client, auth):
    body = client.post("/ask", json={"question": "What is a follow-up interview?"}, headers=auth).json()
    assert body["guardrail"] == "no_sources" and body["sources"] == []
    assert "No reference material has been loaded" in body["answer"]


def test_ask_guardrail_over_http(client, auth):
    body = client.post("/ask", json={"question": "Does my child have autism?"}, headers=auth).json()
    assert body["guardrail"] == "diagnosis" and body["sources"] == []


def test_ingest_endpoint_with_empty_folder(client, auth):
    body = client.post("/ingest", headers=auth).json()
    assert body["filesIngested"] == 0 and body["indexSize"] == 0
    assert client.get("/corpus", headers=auth).json() == {"indexSize": 0}
