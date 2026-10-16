"""Train the OPTIONAL M-CHAT-R probability model from a CSV the team provides.

    cd ai-service
    python -m ml.train --csv data/my_dataset.csv --dataset-name "Name of dataset" \
                       --dataset-source "https://…" [--label-column label]

Expected CSV (header row required):
    q1 … q20   the 20 item answers, "yes"/"no" (any case) or 1/0 where 1 = "Yes"
    label      1 = positive outcome, 0 = negative  (the DATASET's outcome column)
Extra columns are ignored. Rows with missing/invalid values are dropped and counted.

What it does
  1. 5-fold STRATIFIED cross-validation of a logistic regression (AUROC, precision, recall).
  2. Fits the final model on all rows → ml/model.joblib  (git-ignored).
  3. Writes docs/MODEL_CARD.md with the REAL metrics + limitations.
  4. Checks for LABEL LEAKAGE: if the label is (almost) reproducible from the M-CHAT-R rule
     score, the CV metrics only measure "does the model re-learn the scoring rule" and say
     nothing about clinical performance. The model card then says so, loudly.

No synthetic data is generated here. If no CSV is given, this script stops with an error.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from app.screening import mchatr
from ml.inference import FEATURES, SCHEMA_VERSION

ROOT = Path(__file__).resolve().parent.parent
LEAKAGE_AGREEMENT = 0.98  # label matches a rule-score threshold on ≥98% of rows → treat as leakage


def _to_bit(value: str) -> int | None:
    v = str(value).strip().lower()
    if v in ("yes", "y", "1", "1.0", "true"):
        return 1
    if v in ("no", "n", "0", "0.0", "false"):
        return 0
    return None


def load_csv(path: Path, label_column: str) -> tuple[np.ndarray, np.ndarray, int]:
    """Returns X (n×20 of yes=1/no=0), y (n), and number of dropped rows."""
    X, y, dropped = [], [], 0
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        missing = [c for c in FEATURES + [label_column] if c not in (reader.fieldnames or [])]
        if missing:
            raise SystemExit(f"CSV is missing required columns: {missing}")
        for row in reader:
            bits = [_to_bit(row[c]) for c in FEATURES]
            label = _to_bit(row[label_column])
            if label is None or any(b is None for b in bits):
                dropped += 1
                continue
            X.append(bits)
            y.append(label)
    return np.array(X, dtype=float), np.array(y, dtype=int), dropped


def rule_scores(X: np.ndarray) -> np.ndarray:
    scores = []
    for row in X:
        answers = {n: ("yes" if row[n - 1] == 1 else "no") for n in range(1, 21)}
        scores.append(mchatr.score_answers(answers)["riskScore"])
    return np.array(scores)


def leakage_report(X: np.ndarray, y: np.ndarray) -> dict:
    scores = rule_scores(X)
    out = {"leakage": False, "details": []}
    for threshold in (3, 8):  # medium and high cut-offs
        agreement = float(np.mean((scores >= threshold).astype(int) == y))
        out["details"].append({"threshold": threshold, "agreement": round(agreement, 4)})
        if agreement >= LEAKAGE_AGREEMENT:
            out["leakage"] = True
    return out


def cross_validate(X: np.ndarray, y: np.ndarray) -> dict:
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import precision_score, recall_score, roc_auc_score
    from sklearn.model_selection import StratifiedKFold, cross_val_predict

    counts = np.bincount(y, minlength=2)
    if counts.min() < 5:
        raise SystemExit(f"Need at least 5 rows of each class for 5-fold CV; class counts = {counts.tolist()}")

    model = LogisticRegression(max_iter=1000, class_weight="balanced")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    proba = cross_val_predict(model, X, y, cv=cv, method="predict_proba")[:, 1]
    pred = (proba >= 0.5).astype(int)

    fold_auc = []
    for train_idx, test_idx in cv.split(X, y):
        m = LogisticRegression(max_iter=1000, class_weight="balanced").fit(X[train_idx], y[train_idx])
        fold_auc.append(roc_auc_score(y[test_idx], m.predict_proba(X[test_idx])[:, 1]))

    return {
        "auroc": float(roc_auc_score(y, proba)),
        "auroc_fold_mean": float(np.mean(fold_auc)),
        "auroc_fold_sd": float(np.std(fold_auc)),
        "precision": float(precision_score(y, pred, zero_division=0)),
        "recall": float(recall_score(y, pred, zero_division=0)),
        "n": int(len(y)),
        "positives": int(y.sum()),
    }


def fit_and_save(X, y, csv_path: Path, out: Path) -> str:
    import joblib
    from sklearn.linear_model import LogisticRegression

    digest = hashlib.sha256(csv_path.read_bytes()).hexdigest()[:8]
    version = f"mchatr-lr-{digest}"
    model = LogisticRegression(max_iter=1000, class_weight="balanced").fit(X, y)
    joblib.dump(
        {
            "model": model,
            "features": FEATURES,
            "schema_version": SCHEMA_VERSION,
            "version": version,
            "trained_at": datetime.now(timezone.utc).isoformat(),
        },
        out,
    )
    return version


def write_model_card(path: Path, *, version, dataset_name, dataset_source, dropped, metrics, leak) -> None:
    leak_block = ""
    if leak["leakage"]:
        agreements = ", ".join(f"score>={d['threshold']}: {d['agreement']:.1%}" for d in leak["details"])
        leak_block = (
            "\n> ⚠️ **LABEL LEAKAGE DETECTED.** The dataset's label agrees with an M-CHAT-R rule-score "
            "threshold on ≥98% of rows "
            f"({agreements}). "
            "That means the label is (almost certainly) *derived from the same questionnaire score*. "
            "The metrics below only show that the model can re-learn the scoring rule — they say **nothing** "
            "about clinical accuracy and must not be presented as such.\n"
        )
    text = f"""# Model Card — Autara optional M-CHAT-R probability model

*Generated by `ml/train.py` on {datetime.now(timezone.utc):%Y-%m-%d}. Model version: `{version}`.*

> **This is a screening aid, not a diagnosis.** The M-CHAT-R rule score is always the authoritative
> risk tier in Autara. This model only supplies an *additional, informational* probability that is shown
> to clinicians. It never changes the tier.
{leak_block}
## Intended use
Give a clinician a second, data-driven signal next to the rule-based M-CHAT-R score for children
16–30 months. Not for stand-alone decisions, not for diagnosis, not for any age outside 16–30 months.

## Data
- **Dataset:** {dataset_name}
- **Source:** {dataset_source}
- **Rows used:** {metrics['n']} ({metrics['positives']} positive); {dropped} rows dropped for missing/invalid values.
- **Features:** the 20 M-CHAT-R answers (`q1`–`q20`, yes=1/no=0).
- **Label:** the dataset's outcome column (see leakage note above if present).

## Method
Logistic regression (`class_weight="balanced"`), 5-fold stratified cross-validation, decision threshold 0.5.

## Results (cross-validated)
| Metric | Value |
| --- | --- |
| AUROC (pooled out-of-fold) | {metrics['auroc']:.3f} |
| AUROC per fold (mean ± sd) | {metrics['auroc_fold_mean']:.3f} ± {metrics['auroc_fold_sd']:.3f} |
| Precision @0.5 | {metrics['precision']:.3f} |
| Recall @0.5 | {metrics['recall']:.3f} |

## Limitations
- Trained only on questionnaire answers; no clinical observation, no developmental history.
- Performance on the dataset above may not transfer to other populations, languages or settings.
- Not calibrated for individual-level risk; the probability is a ranking signal, not a diagnosis likelihood.
- No fairness / subgroup analysis has been performed.
- Cross-validation on one dataset is not external validation.

## Ethical considerations
Screening tools have false positives and false negatives. A low score never rules out a need for
evaluation; a high score never confirms a condition. A qualified clinician makes every decision.
"""
    path.write_text(text, encoding="utf-8")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", type=Path, required=True, help="path to the training CSV (put it in ai-service/data/)")
    ap.add_argument("--label-column", default="label")
    ap.add_argument("--dataset-name", default="(not provided)")
    ap.add_argument("--dataset-source", default="(not provided)")
    ap.add_argument("--out", type=Path, default=ROOT / "ml" / "model.joblib")
    ap.add_argument("--model-card", type=Path, default=ROOT.parent / "docs" / "MODEL_CARD.md")
    args = ap.parse_args(argv)

    if not args.csv.exists():
        print(f"CSV not found: {args.csv}\nPlace your dataset in ai-service/data/ (see data/README.md).", file=sys.stderr)
        return 1

    X, y, dropped = load_csv(args.csv, args.label_column)
    print(f"Loaded {len(y)} rows ({dropped} dropped).")
    leak = leakage_report(X, y)
    if leak["leakage"]:
        print("WARNING: label looks derived from the M-CHAT-R score (label leakage). See model card.", file=sys.stderr)
    metrics = cross_validate(X, y)
    print({k: round(v, 3) if isinstance(v, float) else v for k, v in metrics.items()})
    version = fit_and_save(X, y, args.csv, args.out)
    write_model_card(args.model_card, version=version, dataset_name=args.dataset_name,
                     dataset_source=args.dataset_source, dropped=dropped, metrics=metrics, leak=leak)
    print(f"Saved {args.out} and {args.model_card}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
