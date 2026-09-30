# Design decisions

Running log of choices made where the brief left room. Newest at the bottom of each section.

## Process
- **D-001 Branching.** Work is on `feature/core-mvp` (from up-to-date `main`), committed per phase, **not pushed** (per brief).
- **D-002 Baseline fixes.** `Milestones.jsx` had a JS syntax error breaking `npm run build`; `backend/package-lock.json` was out of sync with `package.json`. Both fixed before Phase 1.

## Ports / config
- **D-003 Frontend port = 3000.** `.env.example` said 3000, `server.js` and `vite.config.js` said 3001. 3000 chosen (matches the documented example); all three now agree.
- **D-004 `VITE_API_BASE_URL` empty in dev.** The example pointed at :4000 while claiming to use the Vite proxy. It is now empty by default so the proxy is used (no CORS involved); set it only for a separately-hosted production build.

## API conventions
- **D-005 Extra status codes.** The brief lists 200/201/400/401/403/404/409/500. We also use **429** (Ask Autara rate limit) and **503** (AI service down / timed out) because clients and proxies treat them specially. Everything else stays within the list.
- **D-006 Verified is enforced by default.** `requireRole()` rejects unverified therapist/clinician accounts with `403 ACCOUNT_NOT_VERIFIED` on every route; only `/api/auth/me` opts out (`allowUnverified`) so the UI can show the pending page. New routes are safe by default.
- **D-007 Child access errors.** For non-admins every "no access" is the same `404 CHILD_NOT_FOUND` (indistinguishable from a missing child). Admins get `403` because they are never allowed individual child data regardless of existence.
- **D-008 Idempotent child migration.** `GET /api/children` creates the child from the signup profile via an upsert keyed on `{caregiverUid, fromSignupProfile:true}`, only when the caregiver has no Child yet.
- **D-009 AI service health is public.** `GET /health` on FastAPI needs no key (Docker healthcheck, reveals only "ok"); everything else requires `X-Internal-Key` and fails closed if the key isn't configured.
- **D-010 DNS override only for Atlas.** `server.js` forced public DNS resolvers for every URI; that breaks plain `mongodb://` hosts inside Docker. It now applies only to `mongodb+srv://`.

## Testing
- **D-011 Backend test DB.** Tests use `TEST_MONGODB_URI` if set (CI uses a `mongo` service container) and otherwise `mongodb-memory-server`. In the authoring sandbox the MongoDB binary host was blocked by the egress policy, so local runs used FerretDB (Mongo wire-compatible, SQLite). FerretDB lacks `$avg`, date operators and `$facet`, which shaped the aggregation design (D-012).
- **D-012 Aggregations use only `$match/$group/$sum/$sort/$limit`.** Averages are computed from `$sum` ÷ count in JS; hour-of-day / weekday / week-start are stored on each log at write time in the *user's local time* (client sends `tzOffsetMinutes`). This is also more correct than grouping in UTC (a 4pm meltdown must land in the 4pm bar).

## Screening (Phase 2)
- **D-013 ⚠ M-CHAT-R item wording is UNVERIFIED.** The sandbox could not reach any host that publishes the official instrument (mchatscreen.com, university and clinic PDFs were all blocked by the egress policy). The 20 item texts in `ai-service/app/screening/mchatr.py` were entered from memory. They are flagged (`ITEMS_VERIFIED_AGAINST_SOURCE = False`), the API reports `wordingVerified: false`, and the wizard shows a visible "development build" notice until the team compares every item word-for-word with the official PDF and flips the flag. The scoring rules (items 2, 5, 12 reverse-scored; 0–2 / 3–7 / 8–20) come from the brief.
- **D-014 One source of truth for the questionnaire.** Items, domains and copyright live only in the AI service; Node caches `GET /instrument` for 10 min and exposes it as `GET /api/screenings/instrument`. The frontend never duplicates item text.
- **D-015 Child age is computed on the server** from the stored date of birth (never sent by the client), so the 16–30 month check (`AGE_OUT_OF_RANGE`) can't be bypassed.
- **D-016 `INSIGHTS_READY` = "risk score computed".** The brief's lifecycle reuses this name; the LLM insight text is a separate `Insight` document generated on demand by a clinician. A scorer outage never returns an error to the caregiver: the screening is saved as `PROCESSING_FAILED` and `POST /:id/retry` re-runs it.
- **D-017 What each viewer sees.** Caregivers never see the ML `modelProbability` (a bare probability is easy to misread). Clinician override (tier + reason) and reviewed status are shown to the caregiver only once the screening is `REVIEWED`; clinician annotations stay internal.
- **D-018 Domain grouping** (joint attention, social engagement, communication, imitation/play, sensory/motor) is Autara's own, has no clinical validation, and is labelled as such in code, API and UI.
- **D-019 ML model** uses raw yes/no answers as features (logistic regression, class-balanced, 5-fold stratified CV). `train.py` refuses to run without a CSV, detects label leakage (≥98% agreement with a rule threshold) and writes it into the model card. Tests of the pipeline use random noise CSVs in tmp dirs and assert mechanics only.
- **D-020 Frontend tests** use Vitest + Testing Library with the API and auth context mocked (Firebase can't be exercised offline).

## Behaviour tracking (Phase 3)
- **D-021 Local-time facets stored per log** (`local.hour`, `local.weekday` Mon=0, `local.weekStart`), computed from the client-sent `tzOffsetMinutes` (see D-012). Editing a log's time recomputes them.
- **D-022 One `$sum` per `$group`.** Count and intensity-sum are separate small aggregations merged in JS. Real MongoDB handles several accumulators fine; the Mongo-compatible engine used for local tests did not, and separate pipelines are also trivial to read.
- **D-023 Who can write logs:** caregiver, patient, therapist. Verified care-team clinicians can read logs and summaries but not create them (per brief). Edit/delete: author only, both audited.
- **D-024 Charts:** Recharts, lazy-loaded (only chart pages download it). Single series → one brand hue; every chart has loading / error+retry / empty states and a "View as table" switch; the trigger heat table always prints the number in the cell (colour is never the only channel).
- **D-025 Behaviour notes** are free text that may later be sent to the LLM as evidence: the form asks users not to include names and the evidence builder (Phase 5) truncates notes.
