# Measuring Ask Autara (step by step)

Three commands, all run from `ai-service` with the venv active and `GEMINI_API_KEY` set in `.env`.
**Report numbers exactly as printed.** If something was not measured, say "not measured".

| Command | Needs a key? | What it tells you |
| --- | --- | --- |
| `python -m eval.scores` | yes (embeddings only) | best similarity per question, and how many questions still find a chunk at each `RAG_MIN_SIMILARITY` |
| `python -m eval.run` | yes | per question: retrieval hit, citation validity, banned wording, guardrail behaviour; totals at the end |
| `python -m eval.redteam` | optional | adversarial questions (diagnosis, doses, other families' data, instruction overrides, emergencies). Without a key it still checks every guardrail and lists the rest as `NEEDS_LLM` |

## 1. Write questions that fit your documents
Edit `eval/questions.json`. Keep the shipped `guardrail` questions. For `info` questions, write 8–12 plain questions that a
parent might ask **and that your documents actually answer**, plus 2–3 whose answer is *not* in the documents (the right reply is
"I don't know"). Optional field `"expectSection": "words from the heading or title"` lets `eval.scores` count a top-1 match.

## 2. Tune the threshold
```powershell
python -m eval.scores
```
Read the table "Questions that find at least one chunk, by threshold". Pick the strictest value where your on-topic questions
still find chunks but your "not in the documents" questions do not. Set it in `ai-service\.env` as `RAG_MIN_SIMILARITY=0.xx`, restart
`python -m app`, and record the value and why in `docs/DECISIONS.md`. The default (0.55) is a starting guess.

## 3. Run the full evaluation
```powershell
python -m eval.run
python -m eval.redteam
```
`eval.run` exits with an error if there is any banned wording, an invalid citation or a wrong guardrail. `eval.redteam` exits with an
error on any `FAIL`. **Every FAIL is a bug:** add the question to `tests/test_guardrail_paraphrases.py` (or `tests/test_ask.py`), fix
the pattern or prompt, and re-run. (The offline run already caught and fixed one gap: "give me a diagnosis" phrased indirectly.)

## 4. Results template (copy into your report)
| Item | Value (exactly as printed) |
| --- | --- |
| Date and model (`LLM_MODEL`, `EMBEDDING_MODEL`) | |
| Documents in the index (titles, chunk count) | |
| `RAG_MIN_SIMILARITY` used | |
| eval.run: Retrieval hits / Citation validity / Guardrails OK / Banned-phrase violations | |
| eval.redteam: PASS / FAIL / NEEDS_LLM | |
| Failures found and how each was fixed | |
| Limits (number of questions, one run, small corpus) | |

Honest framing: this measures whether answers stay grounded, cited and safe on a small question set. It does **not** measure clinical
accuracy or usefulness to families.

## Running the checks in backup mode (Groq writer + offline index)
`eval.run`, `eval.scores` and `eval.redteam` follow `ASK_MODE` in `ai-service/.env`, so they measure what Ask Autara really does:

| `ASK_MODE` | Index searched | Who writes the answer | Needs |
|---|---|---|---|
| `gemini` / `auto` | main (Gemini) index | Gemini | `GEMINI_API_KEY` |
| `backup` | offline index (`--backup`) | the backup writer (`BACKUP_LLM_*`, e.g. Groq) | `BACKUP_LLM_API_KEY` |
| `local` | offline index | nobody: quoted passages | nothing |

```powershell
cd ai-service ; .\.venv\Scripts\Activate.ps1
python -m app.rag.ingest --backup          # once, and after any document change
python -m eval.scores --backup             # similarity per question; tune RAG_BACKUP_MIN_SIMILARITY
python -m eval.run                         # retrieval, citations, guardrails, banned wording, no-answer
python -m eval.redteam                     # 34 adversarial questions
```
`eval.run` prints which source produced each reply (the writer's model name, quoted passages, or a fixed guardrail message).
Free plans limit requests per minute: if Groq answers 429, the reply falls back to quoted passages (visible in that count), so wait a minute and re-run for a clean model-only result.
Report the numbers exactly as printed (see "Measured results" above) and write down the date, `ASK_MODE`, model name and corpus size next to them.
