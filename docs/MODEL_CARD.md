# Model Card — Autara optional M-CHAT-R probability model

**Status: no model has been trained.** Autara currently reports only the rule-based M-CHAT-R
score (`modelVersion: "mchatr-rules-v1"`, `modelProbability: null`).

This file is overwritten by `python -m ml.train` (see `ai-service/data/README.md`) with the real
dataset description, cross-validated AUROC / precision / recall, limitations, and — if it applies —
a **label-leakage warning** (when the dataset's label is derived from the M-CHAT-R score itself,
metrics only show the model re-learning the scoring rule, not clinical performance).

## Principles (apply to any future model)
- The M-CHAT-R rule score is the authoritative risk tier. A model may only add an informational probability.
- Screening aid, not a diagnosis. A qualified clinician makes every decision.
- No synthetic data is ever presented as evidence of real-world performance.
