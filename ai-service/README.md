# Autara AI service

Internal FastAPI service behind the Node API. **Screening aid, not a diagnosis** — nothing here ever outputs a diagnosis or an autism level.

| Endpoint | What it does |
| --- | --- |
| `GET /health` | Liveness (public) |
| `POST /screen` | Official M-CHAT-R scoring → `{ riskScore, riskTier, atRiskItems, domainBreakdown, modelProbability, modelVersion }` |
| `GET /instrument` | The 20 items, domain grouping, copyright, `wordingVerified` |
| `POST /insights` | Evidence-linked insight (RAG + LLM) validated before it is returned |
| `POST /ask` | "Ask Autara": guardrails → retrieval → answer with sources |
| `POST /ingest` | Build / refresh the vector index (same as `python -m app.rag.ingest`) |

Everything except `/health` requires the header `X-Internal-Key: $AI_SERVICE_KEY` (fail-closed if the key isn't configured). The service binds to `127.0.0.1` by default.

## Run

```bash
cd ai-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set AI_SERVICE_KEY (same as backend); GEMINI_API_KEY is optional
python -m app                   # or: uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Without `GEMINI_API_KEY`: `/screen` works; `/insights` returns `status: "failed"` (`LLM_NOT_CONFIGURED`); `/ask` works for guardrail cases and says "no reference material loaded" while the index is empty.

## Offline fallback copy

The backend keeps `backend/data/mchatr-instrument.json` so screening still works when this service is down. It is generated from `app/screening/mchatr.py`; after changing items, domains or scoring run `python -m scripts.export_instrument` (a pytest fails if you forget).

## Layout

```
app/screening/mchatr.py   20 items (+ copyright), official scoring, Autara domain grouping
app/screening/router.py   /screen, /instrument
app/llm/                  provider interface (base.py), Gemini (gemini.py), factory
app/rag/                  ingest.py (CLI + /ingest), store.py (Chroma), retriever.py
app/insights/             schema.py (Pydantic), validator.py (safety core), generator.py, router.py
app/assistant/            guardrails.py, ask.py, router.py
app/safety.py             banned diagnostic patterns, urgent/medication/diagnosis guardrail regexes
prompts/                  insight_v1.txt, ask_v1.txt (versioned system prompts)
knowledge/                approved reference documents (contents git-ignored) + sources.yaml
ml/                       optional ML probability: train.py, inference.py
eval/                     questions.json + run.py (evaluates the REAL LLM)
tests/                    pytest (LLM mocked)
```

## Reference corpus (RAG)

Autara ships **no** clinical reference content. The team adds approved sources:

1. Put files (PDF / Markdown / text) in `knowledge/` and list each in `knowledge/sources.yaml` (title, publisher, url, version, docType). **Unlisted files are not ingested.**
2. `python -m app.rag.ingest` (needs `GEMINI_API_KEY` for embeddings). Pipeline: load → clean → chunk (~600 tokens, 80 overlap) → metadata (source, page, section, docType, version, ingestedAt) → embed → ChromaDB (`storage/chroma/`, git-ignored).
3. Re-ingesting is safe: chunk ids are content hashes, unchanged chunks aren't duplicated or re-embedded, removed content is pruned. `--reset` wipes the index (needed after changing `EMBEDDING_MODEL`).

With an empty corpus everything still works: insights use patient evidence only (`references: []` + an uncertainty note) and Ask Autara says no reference material is loaded yet.

## Safety layers (why an insight can be trusted to be *checkable*)

1. Evidence sent by Node is minimal (no names; age in months) and the request model rejects unknown fields.
2. The system prompt (`prompts/insight_v1.txt`) forbids diagnosis/severity and requires citations + uncertainty.
3. **Validator** (`app/insights/validator.py`): valid JSON/schema, every evidence id exists in the supplied evidence, every reference matches a retrieved chunk, no banned diagnostic phrase anywhere, non-empty uncertainty. One retry with the reasons, then `failed` (reason codes only).
4. Ask Autara: urgent-safety / medication / diagnosis questions are answered with fixed messages *before* any LLM call; answers must cite retrieved passages; dosing text is rejected.

## Optional ML probability

`ml/train.py` trains a logistic regression from a CSV you provide (see `data/README.md`), does stratified 5-fold CV, saves `ml/model.joblib` and writes `docs/MODEL_CARD.md`, including a **label-leakage warning** if the dataset's label is derived from the M-CHAT-R score. At inference the probability is included only if a compatible model file exists; the rule-based tier is always authoritative.

## Tests and evaluation

```bash
python -m pytest              # LLM is mocked; no network
python -m eval.run            # real LLM + real index: retrieval hits, citation validity, banned-phrase violations, guardrails
```
