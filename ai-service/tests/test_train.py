"""Tests the training PIPELINE MECHANICS on tiny throw-away CSVs written into tmp dirs.
These rows are random noise used only to exercise code paths — their metrics mean nothing."""
import csv

import numpy as np
import pytest

pytest.importorskip("sklearn")
pytest.importorskip("joblib")

from ml import inference, train  # noqa: E402


def write_csv(path, rows, label_fn):
    with open(path, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow([f"q{n}" for n in range(1, 21)] + ["label"])
        for r in rows:
            w.writerow(list(r) + [label_fn(r)])


def rows(n=120, seed=0):
    rng = np.random.default_rng(seed)
    return rng.integers(0, 2, size=(n, 20))


def test_leakage_is_detected_when_label_is_the_rule_score(tmp_path):
    X = rows()
    scores = train.rule_scores(X)
    report = train.leakage_report(X, (scores >= 3).astype(int))
    assert report["leakage"] is True


def test_no_leakage_for_unrelated_label(tmp_path):
    X = rows()
    y = np.random.default_rng(1).integers(0, 2, size=len(X))
    assert train.leakage_report(X, y)["leakage"] is False


def test_train_end_to_end_writes_model_and_card(tmp_path, monkeypatch):
    X = rows()
    csv_path = tmp_path / "d.csv"
    write_csv(csv_path, X, lambda r: int(r[0] + r[1] > 1))  # arbitrary label
    out, card = tmp_path / "model.joblib", tmp_path / "MODEL_CARD.md"
    assert train.main(["--csv", str(csv_path), "--out", str(out), "--model-card", str(card),
                       "--dataset-name", "unit-test noise", "--dataset-source", "n/a"]) == 0
    assert out.exists() and "AUROC" in card.read_text()

    monkeypatch.setattr(inference, "MODEL_PATH", out)
    inference._cache.update(mtime=None, bundle=None)
    prob, version = inference.predict_probability({n: "yes" for n in range(1, 21)})
    assert 0.0 <= prob <= 1.0 and version.startswith("mchatr-lr-")


def test_leakage_warning_lands_in_model_card(tmp_path):
    # mix of mostly-typical and mostly-at-risk rows so both classes exist
    rng = np.random.default_rng(3)
    typical = np.array([[0 if n in (2, 5, 12) else 1 for n in range(1, 21)]] * 60)
    flip = rng.random(typical.shape) < 0.05
    X = np.vstack([np.abs(typical - flip[:60]), rng.integers(0, 2, size=(60, 20))])
    csv_path = tmp_path / "d.csv"
    write_csv(csv_path, X, lambda r: int(train.rule_scores(np.array([r]))[0] >= 3))
    card = tmp_path / "MC.md"
    train.main(["--csv", str(csv_path), "--out", str(tmp_path / "m.joblib"), "--model-card", str(card)])
    assert "LABEL LEAKAGE" in card.read_text()


def test_missing_columns_or_file_fail_cleanly(tmp_path):
    assert train.main(["--csv", str(tmp_path / "nope.csv")]) == 1
    bad = tmp_path / "bad.csv"
    bad.write_text("a,b\n1,2\n")
    with pytest.raises(SystemExit):
        train.main(["--csv", str(bad)])


def test_incompatible_model_is_ignored(tmp_path, monkeypatch):
    import joblib
    p = tmp_path / "m.joblib"
    joblib.dump({"model": None, "features": ["x"], "schema_version": 99, "version": "v"}, p)
    monkeypatch.setattr(inference, "MODEL_PATH", p)
    inference._cache.update(mtime=None, bundle=None)
    assert inference.predict_probability({n: "yes" for n in range(1, 21)}) == (None, inference.RULES_VERSION)
