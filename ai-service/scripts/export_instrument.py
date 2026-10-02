"""Writes the M-CHAT-R definition to backend/data/mchatr-instrument.json.

The Node backend uses that file ONLY as an offline fallback (to show the questionnaire and apply the
same official scoring rules when the AI service is not running). The Python module stays the single
source of truth; a pytest (tests/test_backend_fallback_in_sync.py) fails if the JSON is out of date.

    cd ai-service && python -m scripts.export_instrument
"""
import json
from pathlib import Path

from app.screening import mchatr

TARGET = Path(__file__).resolve().parents[2] / "backend" / "data" / "mchatr-instrument.json"


def render() -> str:
    return json.dumps(mchatr.instrument_definition(), indent=2, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    TARGET.write_text(render(), encoding="utf-8")
    print(f"Wrote {TARGET}")
