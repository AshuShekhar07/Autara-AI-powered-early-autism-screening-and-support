"""The Node backend keeps a copy of the M-CHAT-R definition as an offline fallback. It must never drift."""
from scripts.export_instrument import TARGET, render


def test_backend_fallback_json_is_up_to_date():
    assert TARGET.read_text(encoding="utf-8") == render(), (
        "backend/data/mchatr-instrument.json is out of date — run: cd ai-service && python -m scripts.export_instrument"
    )
