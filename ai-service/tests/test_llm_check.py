from app.llm import check


def test_check_without_a_key_fails_clearly_and_does_not_crash(capsys):
    assert check.main() == 1
    out = capsys.readouterr().out
    assert "GEMINI_API_KEY is empty" in out and "LLM_MODEL" in out


def test_key_is_redacted(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "secret-123")
    assert check._redact("bad key secret-123 here") == "bad key *** here"
