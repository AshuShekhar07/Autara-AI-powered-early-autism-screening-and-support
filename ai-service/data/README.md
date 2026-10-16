# Training data (optional)

Autara works without a trained model: the M-CHAT-R **rule score** is always the authoritative
risk tier. To add the optional probability, place a CSV here (its contents are git-ignored) and run:

```bash
cd ai-service
python -m ml.train --csv data/your_file.csv --dataset-name "…" --dataset-source "https://…"
```

## Expected columns
| Column | Meaning |
| --- | --- |
| `q1` … `q20` | The 20 M-CHAT-R answers: `yes`/`no` (any case) or `1`/`0` where `1` = "Yes" |
| `label` | `1` = positive outcome, `0` = negative, as defined by the dataset provider (`--label-column` to rename) |

## Read this before trusting the numbers
- Use **only** data you are allowed to use, and never real patient data in this repo.
- If the label was **derived from the M-CHAT-R score itself**, the model just re-learns the scoring rule.
  `train.py` detects this (≥98% agreement with a rule threshold) and writes a leakage warning into
  `docs/MODEL_CARD.md`. Such metrics are not clinical performance.
- Do not generate synthetic training data and report its metrics as real.
