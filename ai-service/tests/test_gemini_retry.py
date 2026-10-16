"""Gemini calls retry temporary errors (429/500/503) a few times, but never hard failures such as 403."""
import pytest

from app.llm import gemini


class _Err(Exception):
    def __init__(self, code):
        super().__init__(f"HTTP {code}")
        self.code = code


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch):
    waits = []
    monkeypatch.setattr(gemini.time, "sleep", lambda s: waits.append(s))
    return waits


def test_retries_503_then_succeeds(_no_sleep):
    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise _Err(503)
        return "ok"

    assert gemini._with_retry(flaky) == "ok"
    assert calls["n"] == 3
    assert _no_sleep == [2, 5]          # waited 2 s then 5 s


def test_gives_up_after_four_attempts(_no_sleep):
    calls = {"n": 0}

    def always():
        calls["n"] += 1
        raise _Err(429)

    with pytest.raises(_Err):
        gemini._with_retry(always)
    assert calls["n"] == 4
    assert _no_sleep == [2, 5, 10]


def test_403_is_not_retried(_no_sleep):
    calls = {"n": 0}

    def denied():
        calls["n"] += 1
        raise _Err(403)

    with pytest.raises(_Err):
        gemini._with_retry(denied)
    assert calls["n"] == 1 and _no_sleep == []


def test_error_text_has_status_but_no_key():
    msg = gemini._describe(_Err(503))
    assert msg.startswith("_Err 503")
