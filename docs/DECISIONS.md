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
