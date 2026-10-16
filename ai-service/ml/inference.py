"""Optional ML probability. The rule-based M-CHAT-R tier is ALWAYS authoritative;
this only adds an extra number for the clinician when a compatible trained model exists.

If scikit-learn/joblib are missing, or no model.joblib exists, or its metadata does not match
the current feature schema → returns (None, RULES_VERSION). Never raises.
"""
from __future__ import annotations

import os
from pathlib import Path

RULES_VERSION = "mchatr-rules-v1"
SCHEMA_VERSION = 1
FEATURES = [f"q{n}" for n in range(1, 21)]  # raw answers, yes=1 / no=0
MODEL_PATH = Path(os.environ.get("ML_MODEL_PATH", Path(__file__).parent / "model.joblib"))

_cache: dict = {"mtime": None, "bundle": None}


def _load():
    try:
        import joblib  # noqa: WPS433 (optional dependency)
    except ImportError:
        return None
    if not MODEL_PATH.exists():
        return None
    mtime = MODEL_PATH.stat().st_mtime
    if _cache["mtime"] != mtime:
        try:
            bundle = joblib.load(MODEL_PATH)
        except Exception:  # corrupt / incompatible pickle
            bundle = None
        _cache.update(mtime=mtime, bundle=bundle)
    bundle = _cache["bundle"]
    if not isinstance(bundle, dict):
        return None
    if bundle.get("schema_version") != SCHEMA_VERSION or bundle.get("features") != FEATURES:
        return None  # trained for a different feature layout → ignore
    return bundle


def predict_probability(answers: dict[int, str]) -> tuple[float | None, str]:
    """answers: normalised {1..20: 'yes'|'no'} → (probability | None, modelVersion)."""
    bundle = _load()
    if bundle is None:
        return None, RULES_VERSION
    try:
        row = [[1.0 if answers[n] == "yes" else 0.0 for n in range(1, 21)]]
        prob = float(bundle["model"].predict_proba(row)[0][1])
        return round(prob, 4), bundle["version"]
    except Exception:
        return None, RULES_VERSION
