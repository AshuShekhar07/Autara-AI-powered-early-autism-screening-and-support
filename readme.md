# Autara — AI-assisted early autism screening & behaviour support

> **Responsible, explainable AI for early screening support — a screening aid, not a diagnosis.**

[![Track: Generative AI](https://img.shields.io/badge/Track-Generative%20AI-blue.svg)](https://github.com/)
[![Domain: HealthTech](https://img.shields.io/badge/Domain-HealthTech-green.svg)](https://github.com/)
[![Clinical Safety: Human-in-the-loop](https://img.shields.io/badge/Clinical%20Safety-Human--in--the--loop-orange.svg)](https://github.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> ⚠️ **Important clinical & responsible-AI disclaimer.**
> Autara is a **screening-support** system. It never produces a diagnosis or an "autism level". It outputs a **risk tier** that says whether a professional evaluation is recommended, and every result, insight and report carries the line
> *"This is a screening aid, not a diagnosis. Please discuss results with a qualified clinician."*
> A qualified clinician is always the final authority: they can annotate and override, and caregivers only see AI-written insights **after** a clinician has approved them.
> **Use only synthetic / demo data.** Autara is an academic project, not a certified medical device.

## Team

* **Ashu Shekhar** (`PST-25-022`) · **Shivam Mishra** (`PST-25-0149`)
* Track: Generative AI · Domain: HealthTech · Users: caregivers, therapists, clinicians, admins

## What it does

| Role | What they can do |
| --- | --- |
| **Caregiver / patient** | Complete the M-CHAT-R screening (16–30 months) and see a plain-language result that shows *which answers* contributed · log behaviours (ABC: antecedent–behaviour–consequence) and see trends · add a verified therapist/clinician to the child's care team · read clinician-approved summaries · ask general questions ("Ask Autara") answered only from approved sources · download reviewed reports (PDF/CSV) |
| **Therapist** | Caseload list · log ABC entries and see trigger charts · write session notes · read screenings and approved insights (read-only) |
| **Clinician** | Review queue (highest risk first) · case page with all 20 answers, behaviour summary and timeline · generate an evidence-linked **AI insight** (jump from a claim to the exact answer/log, see sources and uncertainty) · annotate · override the risk tier with a required reason · mark reviewed · approve the family-facing summary · export PDF/CSV |
| **Admin** | Verify (approve/reject) professionals · user list · anonymised analytics (counts below 5 are hidden) — never individual children's data |

## Architecture

```
React (Vite :3000) ──► Node/Express API (:4000) ──► MongoDB
                              │
                              └──► FastAPI AI service (:8000, internal only, X-Internal-Key)
                                     ├─ POST /screen     M-CHAT-R scoring (+ optional ML probability)
                                     ├─ POST /insights   RAG + LLM insight, validated (evidence, sources, banned phrases)
                                     ├─ POST /ask        RAG Q&A with guardrails
                                     └─ POST /ingest     build the vector index (also a CLI)
```

**Stack:** MongoDB · Node.js/Express (CommonJS) · FastAPI (Python 3.11) · React 18 + Vite (plain CSS, Recharts) · Firebase Authentication · Google Gemini (behind a small provider interface) · ChromaDB. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Quick start

### Prerequisites
Node 20+ (22 recommended), Python 3.11+, a MongoDB instance (local or Atlas), a Firebase project with **Email/Password** sign-in enabled, and — optionally — a [Gemini API key](https://aistudio.google.com/apikey) for insights / Ask Autara / embeddings.

### 1. Backend (`:4000`)
```bash
cd backend
cp .env.example .env        # fill in MONGODB_URI, Firebase Admin credentials, AI_SERVICE_KEY, ALLOWED_ORIGINS
npm install
npm run dev
```

### 2. AI service (`:8000`, internal)
```bash
cd ai-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # AI_SERVICE_KEY (same value as the backend), GEMINI_API_KEY (optional)
python -m app               # binds to 127.0.0.1:8000
```
Screening works without a Gemini key — and even without the AI service running at all (the backend then scores locally with the same official rules). Insights and Ask Autara need the AI service; without a Gemini key they fail gracefully. Details: [`ai-service/README.md`](ai-service/README.md).

### 3. Frontend (`:3000`)
```bash
cd frontend
cp .env.example .env        # Firebase web config (leave VITE_API_BASE_URL empty in dev — Vite proxies /api)
npm install
npm run dev
```

### Or with Docker (Mongo + backend + AI service)
```bash
cp .env.example .env                  # AI_SERVICE_KEY, GEMINI_API_KEY
cp backend/.env.example backend/.env  # Firebase Admin credentials
docker compose up --build             # then: cd frontend && npm run dev
```
The AI service port is not published to the host; only the backend can reach it.

### Environment variables

| File | Variable | Purpose |
| --- | --- | --- |
| `backend/.env` | `MONGODB_URI` | MongoDB connection string |
| | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Firebase Admin credentials (verify ID tokens) |
| | `ALLOWED_ORIGINS` | CORS allow-list (default `http://localhost:3000`) |
| | `AI_SERVICE_URL`, `AI_SERVICE_KEY` | Where the AI service is + the shared secret |
| | `ASK_RATE_LIMIT_PER_HOUR` | Ask Autara limit per user (default 20) |
| `ai-service/.env` | `AI_SERVICE_KEY` | Must equal the backend's value |
| | `GEMINI_API_KEY`, `LLM_MODEL`, `EMBEDDING_MODEL` | LLM provider and models (check current names at ai.google.dev) |
| | `RAG_TOP_K`, `RAG_MIN_SIMILARITY` | Retrieval settings |
| `frontend/.env` | `VITE_FIREBASE_*` | Firebase web SDK config |
| | `VITE_API_BASE_URL` | Empty in dev (proxy); set for a separately hosted build |
| root `.env` | `AI_SERVICE_KEY`, `GEMINI_API_KEY` | Used by `docker-compose.yml` |

### Admin account and demo data
Sign-up deliberately cannot create admins. Sign up normally, then promote:
```bash
cd backend
npm run seed:admin -- you@example.com
```
After signing up a caregiver, a therapist and a clinician (three emails), attach **synthetic** demo data (idempotent):
```bash
npm run seed:demo -- --caregiver cg@example.com --therapist th@example.com --clinician cl@example.com
```
This creates two demo children, one screening per risk tier (one waiting in the clinician's queue), ~60 behaviour logs over six weeks with realistic patterns, session notes and care-team links, and verifies the two professionals.

### Tests
```bash
cd backend    && npm test        # Jest + supertest (mongodb-memory-server, or TEST_MONGODB_URI=mongodb://127.0.0.1:27017)
cd ai-service && python -m pytest
cd frontend   && npm test && npm run build
```
CI runs all three on every push and pull request (`.github/workflows/ci.yml`).

## Demo walkthrough

1. **Caregiver** signs up (child name + date of birth, 16–30 months) → *New Screening* → 20 yes/no questions → result page: tier in plain words, recommended next step, **which answers contributed**, disclaimer.
2. **Caregiver** logs a few behaviours (*Behaviour log*), sees trends, and adds the clinician to the **care team** by email.
3. **Admin** (promoted with `seed:admin`) opens `/admin`, approves the new clinician/therapist (org + licence shown).
4. **Clinician** opens the **review queue** → case page: flagged answers highlighted, behaviour summary, timeline → **Generate AI insight** (evidence links jump to the exact answer or log; sources; uncertainty) → annotate → **override** the tier with a reason → **approve** the insight → **mark reviewed** → **export PDF**.
5. **Caregiver** now sees the reviewed result (including the clinician's reason) and the approved plain-language summary, downloads the report, and asks **Ask Autara** a question.
6. **Therapist** logs sessions, writes notes and sees trigger charts (read-only on screenings).
7. **Admin** views anonymised analytics.

## Responsible-AI design

1. **Evidence before explanation** — every AI claim cites evidence IDs (answers / behaviour logs) and, when available, reference sources; a validator rejects anything that cites data that isn't in the evidence.
2. **Human in the loop** — clinicians annotate, override (reason required, both values stored, audited) and approve; caregivers never see AI text before approval.
3. **Explicit uncertainty** — every insight has a mandatory uncertainty statement.
4. **No diagnosis, ever** — banned-phrase validator (diagnosis / autism level / "confirms…"), guardrails on Ask Autara (urgent safety → emergency services, medication/dosing refused, no severity levels), fixed disclaimer everywhere.
5. **Traceability** — model, prompt version, retrieved chunk IDs and an audit log for sensitive actions.
6. **Privacy** — minimal, name-free evidence goes to the LLM; reports show initials only; admin analytics are k-anonymous; synthetic data only.

## What the team must provide

* **Gemini API key** (and confirm the model names in `.env.example`) — for insights, Ask Autara and embeddings.
* **Approved reference documents** for the RAG corpus (`ai-service/knowledge/` + `sources.yaml`). Autara ships **no** clinical reference content.
* **Verify the M-CHAT-R item wording** against the official instrument (`ai-service/app/screening/mchatr.py`, flag `ITEMS_VERIFIED_AGAINST_SOURCE`) — the UI shows a development notice until you do.
* *(Optional)* a training dataset for the ML probability (`ai-service/data/README.md`) — never synthetic data presented as real.
* Firebase project + MongoDB instance.

## Repository layout

```
backend/       Node/Express API (routes, controllers, models, middleware, lib, scripts, tests)
frontend/      React + Vite app (pages, components, hooks, context, lib)
ai-service/    FastAPI service (screening, RAG, insights, assistant, ml, eval, prompts, tests)
docs/          API.md · ARCHITECTURE.md · DECISIONS.md · MODEL_CARD.md · IMPLEMENTATION_PLAN.md
```

## Scope boundaries

* No autonomous diagnosis; no regulatory claims (not an FDA/CE device); demonstration and simulated data only.
* No LLM is trained from scratch — foundation models are used through prompts + retrieval.

## License

MIT, for academic and research purposes. The M-CHAT-R is © 2009 Diana Robins, Deborah Fein & Marianne Barton and is free for clinical, research and educational use but must not be reworded.
