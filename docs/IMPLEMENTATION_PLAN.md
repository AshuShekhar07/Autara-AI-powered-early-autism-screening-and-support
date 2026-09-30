# Autara — Core MVP Implementation Plan

Branch: `feature/core-mvp`. Autara is a **screening aid, not a diagnosis tool**. Every phase follows
the clinical-safety rules in the task brief (no diagnosis / autism level, evidence-traceable AI output,
clinician is final authority, disclaimer everywhere, synthetic data only, no self-written clinical corpus).

## What exists today (verified by reading the repo)

| Area | State |
| --- | --- |
| `backend/` | Express + Mongoose, CommonJS. Only `/api/auth/signup` and `/api/auth/me`. `User` model with roles. Firebase Admin token verification. Responses are ad-hoc (`{error}` / bare objects). |
| `frontend/` | React 18 + Vite + react-router 6, plain CSS with `--brand`/`--ink` tokens. Auth pages, caregiver `Dashboard` (built from `components/dashboard/*`), `ChildProfile`, `Milestones`, placeholder `Screening`, stub `ClinicianDashboard`, inline admin stub. `CareTeamSection`, `RecentActivity`, `NotificationBell` ship **mock data**; other cards are empty shells. No chart lib. |
| `ai-service/` | README only. |
| Docs | `readme.md` says PostgreSQL / Python backend — wrong. Truth: MongoDB + Node/Express + FastAPI + Firebase Auth. |

### Defects found (all addressed in the plan)

1. `POST /api/auth/signup` trusts `uid` from body (no token check) → **Phase 1**.
2. Unverified therapist/clinician can call clinical routes (there are none yet, but the guard must exist) → **Phase 1**.
3. No way to create an admin → `seed:admin` script, **Phase 1**.
4. Port drift: `server.js` default CORS `3001`, `.env.example` `3000`, `vite.config.js` `3001` → all set to `3000`, **Phase 1**.
5. `frontend/src/pages/Milestones.jsx` has a syntax error (unescaped apostrophe) so `npm run build` fails on `main` → fixed at the start of the branch.
6. `backend/package-lock.json` was out of sync with `package.json` (`npm ci` failed) → regenerated.
7. Docs disagree on the stack → **Phase 7**.

## Target architecture

```
React (Vite :3000) ─► Node/Express API (:4000) ─► MongoDB
                              └─► FastAPI AI service (:8000, internal; X-Internal-Key)
                                    /screen  /insights  /ask  /ingest  /health
```

## Phases

Each phase ends with: tests/build run, commit (`feat(scope): …`), 5–10 line summary.

### Phase 1 — Foundations
- `utils/respond.js` (`ok`, `created`, `fail`, `AppError`), central error handler, 404 handler, async wrapper. All endpoints use the `{success, data | error}` envelope; frontend callers updated.
- Signup fix (token required; `uid`/`email` from verified token). `requireVerified` enforcement. `seed:admin`.
- Models: `Child`, `AuditLog` (+ `audit()` helper). `middleware/childAccess.js`.
- Endpoints: `/api/children` (+ care-team, caseload), admin verification.
- AI service skeleton (FastAPI, `X-Internal-Key`, `/health`) and `backend/lib/aiClient.js` (timeouts, single retry, error codes).
- Frontend: `lib/api.js`, role-based redirect, `/pending-verification`.

### Phase 2 — M-CHAT-R screening
- `ai-service/app/screening/mchatr.py` (20 items verbatim + copyright notice, official scoring, project domain grouping), `POST /screen`, pytest.
- Optional ML (`ai-service/ml/train.py`, model card); rule score always authoritative.
- Node `Screening` model + lifecycle state machine (one module), `/api/screenings` routes.
- Frontend wizard + result page.

### Phase 3 — ABC behaviour tracking
- `BehaviourLog` model, CRUD, `behaviour-summary` aggregation.
- Frontend quick-log form, history, Recharts charts (each with loading / empty / error states).

### Phase 4 — Role dashboards
- Caregiver dashboard wired to real data (mock adapters deleted), milestones persistence, child switcher, care-team management.
- Therapist workspace (caseload, ABC, session notes, read-only screenings/insights).
- Clinician review queue + case page (annotate / override / review).
- Admin console, `/pending-verification`. Role-specific nav in `DashboardLayout`.

### Phase 5 — RAG + Ask Autara
- Ingestion (hash IDs, Chroma), retriever, evidence builder, generator with `prompts/insight_v1.txt`, Pydantic schema, **validator** (banned patterns, evidence-ID and reference checks, retry once).
- Node insights routes + approve; assistant `/ask` with guardrails and rate limit. Works with an **empty corpus**.
- Eval harness under `ai-service/eval/`.

### Phase 6 — Reports + admin analytics
- PDF (`pdfkit`) / CSV export + `Report` history; `/api/admin/analytics` with k-anonymity (k = 5); admin charts.

### Phase 7 — Quality, demo data, docs
- Jest + supertest + mongodb-memory-server, pytest, frontend build, GitHub Actions.
- `seed:demo`, `docker-compose.yml`.
- Docs: `readme.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/MODEL_CARD.md`, `ai-service/README.md`.

## Out of scope / needs the team
Gemini API key, approved reference documents for the RAG corpus, and (optionally) a real training dataset.
See the final summary and `docs/DECISIONS.md`.
