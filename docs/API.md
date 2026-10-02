# Autara API reference

Base URL (dev): `http://localhost:4000`. The browser only talks to this Node API; the FastAPI service is internal.
Every endpoint below is **Implemented** unless marked **Planned**. A test (`backend/tests/apiDocs.test.js`)
fails if a route exists in the code but is missing from this file.

> **Screening aid, not a diagnosis.** Screening results, insights and reports all carry the disclaimer
> *"This is a screening aid, not a diagnosis. Please discuss results with a qualified clinician."*

## Conventions

**Authentication.** `Authorization: Bearer <Firebase ID token>` on everything except `GET /api/health`.
The user's role is always read from MongoDB, never from the token or the client.

**Envelope** (every endpoint, including auth):

```jsonc
// success
{ "success": true, "data": { ... } }
// error
{ "success": false, "error": { "code": "SCREENING_NOT_FOUND", "message": "Screening not found.", "details": { } } }
```

File downloads (`POST /api/reports/export`) stream the file on success and use the error envelope on failure.

**Status codes:** 200, 201, 400, 401, 403, 404, 409, 500 — plus **429** (rate limit) and **503** (AI service down/timeout).

**Roles:** `caregiver`, `patient` (both "care roles"), `therapist`, `clinician` (**clinical roles** — must be admin-verified,
otherwise `403 ACCOUNT_NOT_VERIFIED`), `admin`.

**Child access rule** (all `/api/children/:id/...` routes and anything keyed by a child/screening):
care roles → only their own children; therapist/clinician → only children whose care team includes them (and verified);
admin → never (`403 ADMIN_NO_CHILD_ACCESS`). Any other "no" is `404 CHILD_NOT_FOUND` / `SCREENING_NOT_FOUND` (existence is never leaked).

**Pagination.** Lists take `limit` (default 20, max 100) and a `before` cursor (ISO date); responses include `nextBefore` (or `null`).

### Error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `AUTH_REQUIRED` / `AUTH_INVALID_TOKEN` | 401 | Missing / bad Firebase token |
| `FORBIDDEN_ROLE`, `OWNER_ONLY`, `AUTHOR_ONLY`, `ADMIN_NO_CHILD_ACCESS`, `REPORT_NOT_AVAILABLE`, `CORS_BLOCKED` | 403 | Not allowed |
| `ACCOUNT_NOT_VERIFIED` | 403 | Therapist/clinician awaiting admin verification |
| `PROFILE_NOT_FOUND` | 404 | Signed in but no Autara profile yet |
| `CHILD_NOT_FOUND`, `SCREENING_NOT_FOUND`, `INSIGHT_NOT_FOUND`, `LOG_NOT_FOUND`, `USER_NOT_FOUND`, `PROFESSIONAL_NOT_FOUND`, `CARE_TEAM_MEMBER_NOT_FOUND`, `ROUTE_NOT_FOUND` | 404 | Not found (or not yours) |
| `VALIDATION_ERROR`, `INVALID_BODY`, `INVALID_JSON`, `INVALID_ROLE`, `INVALID_ANSWERS`, `INCOMPLETE_ANSWERS`, `REASON_REQUIRED`, `NO_CHANGE`, `NOT_A_CLINICAL_ACCOUNT` | 400 | Bad input |
| `AGE_OUT_OF_RANGE` | 400 | M-CHAT-R is validated for 16–30 months; `details` has `childAgeMonths`, `minMonths`, `maxMonths` |
| `ACCOUNT_EXISTS`, `ALREADY_ON_CARE_TEAM`, `INVALID_STATUS_TRANSITION`, `SCREENING_ALREADY_REVIEWED`, `SCREENING_NOT_SCORED`, `INSIGHT_NOT_APPROVABLE`, `DUPLICATE` | 409 | State conflict |
| `RATE_LIMITED` | 429 | Ask Autara limit (20/hour/user); `Retry-After` header + `details.retryAfterSeconds` |
| `AI_SERVICE_UNAVAILABLE`, `AI_SERVICE_TIMEOUT` | 503 | AI service down / too slow |
| `AI_SERVICE_ERROR`, `INTERNAL_ERROR` | 500 | Upstream / unexpected error |

## Health

| Method & path | Roles | Description |
| --- | --- | --- |
| `GET /api/health` | public | `{ status: "ok" }` |
| `GET /api/health/ai` | public | Also pings the AI service (`503` if it is down) |

## Auth

| Method & path | Roles | Description |
| --- | --- | --- |
| `POST /api/auth/signup` | any signed-in Firebase user | Body `{ name, role, roleDetails }`. **`uid` and `email` come from the verified token, never the body.** Roles: caregiver, patient, therapist, clinician (admins are promoted with `npm run seed:admin`). `roleDetails`: `{childName, childDob}` or `{orgName, licenseNumber}`. Clinical accounts start unverified. → `201 { uid, role, verified }` |
| `GET /api/auth/me` | any (unverified clinical allowed) | `{ uid, name, email, role, verified, roleDetails }` |

## Children, care team, milestones

| Method & path | Roles | Description |
| --- | --- | --- |
| `GET /api/children` | care roles, clinical | Care roles: their children (creates the child from the signup profile once, idempotently). Clinical: their caseload children |
| `POST /api/children` | care roles | `{ name, dob, sex? }` |
| `GET /api/children/:id` | anyone with access | Child incl. `ageMonths`, care-team uids |
| `PATCH /api/children/:id` | owner | `{ name?, dob?, sex? }` |
| `GET /api/children/:id/care-team` | anyone with access | Members with names / organisation |
| `POST /api/children/:id/care-team` | owner | `{ email }` → adds a **verified** therapist/clinician; `404 PROFESSIONAL_NOT_FOUND` otherwise; audited `CARE_TEAM_ADDED` |
| `DELETE /api/children/:id/care-team/:uid` | owner | Audited `CARE_TEAM_REMOVED` |
| `GET /api/children/:id/milestones` | anyone with access | `{ statuses: { language, social, motor, cognitive, adaptive } }` each `not_reviewed \| in_progress \| reviewed` |
| `PUT /api/children/:id/milestones` | owner | `{ statuses: { category: status } }` (merges) |
| `GET /api/children/:id/overview` | care roles (owner) | Stat-card numbers, screening trend, latest domain breakdown, open actions |
| `GET /api/children/:id/timeline` | anyone with access | Merged feed of screenings, reviews, logs (+ annotations and session notes for professionals only). `?limit=` |

## Screening (M-CHAT-R)

| Method & path | Roles | Description |
| --- | --- | --- |
| `GET /api/screenings/instrument` | care roles, clinical | The 20 items, domains, copyright, `wordingVerified` (from the AI service, cached; a built-in copy is used if it is down) |
| `POST /api/screenings` | care roles (owner) | `{ childId, answers: {"1":"yes"…"20":"no"} }`. Age computed server-side; `400 AGE_OUT_OF_RANGE` outside 16–30 months. Saved as `PROCESSING` first. If the AI service is unreachable it is scored locally with the same rules (`modelVersion` `mchatr-rules-v1-local`); only if that fails too is it kept as `PROCESSING_FAILED` (still `201`) |
| `GET /api/screenings?childId=&limit=&before=` | anyone with access | Newest first |
| `GET /api/screenings/:id` | anyone with access | Caregivers never see `modelProbability`; review details only once `REVIEWED` |
| `POST /api/screenings/:id/retry` | owner | Only from `PROCESSING_FAILED` |
| `POST /api/screenings/:id/open` | clinician | `INSIGHTS_READY → UNDER_CLINICAL_REVIEW` (idempotent) |
| `POST /api/screenings/:id/annotations` | clinician | `{ text }` |
| `POST /api/screenings/:id/override` | clinician | `{ riskTier, reason }` — reason required; both tiers stored; audited `SCREENING_OVERRIDDEN` |
| `POST /api/screenings/:id/review` | clinician | → `REVIEWED` (locks the case); audited `SCREENING_REVIEWED` |

Status lifecycle (one place: `backend/lib/screeningStatus.js`):
`DRAFT → SCREENING_SUBMITTED → PROCESSING → INSIGHTS_READY | PROCESSING_FAILED → UNDER_CLINICAL_REVIEW → REVIEWED` (`PROCESSING_FAILED → PROCESSING` on retry).

## Behaviour (ABC) tracking

| Method & path | Roles | Description |
| --- | --- | --- |
| `POST /api/children/:id/behaviour-logs` | caregiver, patient, therapist | `{ antecedent:{category,notes?}, behaviour:{category,description?}, consequence:{category,notes?}, intensity 1–5, occurredAt?, durationMinutes?, setting?, tzOffsetMinutes? }` — fixed category enums |
| `GET /api/children/:id/behaviour-logs` | anyone with access | `?from=&to=&category=&limit=&before=` |
| `PATCH /api/children/:id/behaviour-logs/:logId` | author only | Audited |
| `DELETE /api/children/:id/behaviour-logs/:logId` | author only | Audited |
| `GET /api/children/:id/behaviour-summary` | anyone with access | `?from=&to=` → counts per behaviour, antecedent × behaviour matrix, consequences per behaviour, weekly trend, average intensity, hour/weekday distribution, top-3 pairs |
| `POST /api/children/:id/session-notes` | therapist | `{ text }` |
| `GET /api/children/:id/session-notes` | therapist, clinician | Never caregivers |

## AI insights and Ask Autara

| Method & path | Roles | Description |
| --- | --- | --- |
| `POST /api/insights/generate` | clinician | `{ screeningId }`. Sends minimal, name-free evidence to the AI service. Stores `generated` or `failed` (reason codes only). `503` if the AI service is down. Audited `INSIGHT_GENERATED` |
| `GET /api/insights?screeningId=` | care roles, clinical | Clinician: all. Therapist: approved (full). Caregiver: approved, **`caregiverSummary` only** |
| `POST /api/insights/:id/approve` | clinician | Only `generated` insights; makes the summary visible to the caregiver; audited `INSIGHT_APPROVED` |
| `POST /api/assistant/ask` | care roles | `{ question (≤500 chars), childId? }` → `{ answer, sources[], guardrail, usedChildContext, disclaimer }`. With `childId`, only the latest **reviewed** tier + flagged areas are shared. Rate limited (20/h) |

## Reports

| Method & path | Roles | Description |
| --- | --- | --- |
| `POST /api/reports/export` | care roles (reviewed screenings only), clinician | `{ screeningId, format: "pdf" \| "csv" }` → file stream. PDF: initials + age in months, tier (+override), domains, flagged items, behaviour table, approved insight with sources, annotations (clinician copy), disclaimer on every page. CSV: answers + logs. Audited `REPORT_EXPORTED` |
| `GET /api/reports?childId=` | anyone with access | Export history (no files are stored) |

## Dashboards / feeds

| Method & path | Roles | Description |
| --- | --- | --- |
| `GET /api/me/caseload` | therapist, clinician | Assigned children with last log / last screening tier / awaiting-review flag |
| `GET /api/me/review-queue` | clinician | Screenings in `INSIGHTS_READY` / `UNDER_CLINICAL_REVIEW` on the caseload, high risk first then oldest first |
| `GET /api/me/notifications` | any | Derived from real data (no separate store) |

## Admin

| Method & path | Roles | Description |
| --- | --- | --- |
| `GET /api/admin/users` | admin | `?role=&verified=&status=pending\|approved\|rejected&page=&limit=`. Shows organisation + licence for clinical accounts; never child details |
| `PATCH /api/admin/users/:uid/verify` | admin | `{ verified: true \| false }` (reject / revoke = false); audited |
| `GET /api/admin/analytics` | admin | Anonymised aggregates, every count < 5 hidden (`null`), secondary suppression |

## Internal AI service (FastAPI, not reachable from the browser)

All except `/health` need the `X-Internal-Key` header (`401` without it; `503` if the service has no key configured).

| Method & path | Description |
| --- | --- |
| `GET /health` | Liveness (public) |
| `POST /screen` | `{ answers }` → `{ riskScore, riskTier, atRiskItems, domainBreakdown, modelProbability, modelVersion }` (rules are authoritative; `modelProbability` is `null` unless a trained model exists) |
| `GET /instrument` | Questionnaire definition |
| `POST /insights` | Evidence → validated insight JSON or `status: "failed"` with reason codes |
| `POST /ask` | Guardrails → retrieval → answer with sources |
| `POST /ingest` | Build the vector index from `ai-service/knowledge/` (same as the CLI) |
| `GET /corpus` | `{ indexSize }` |

## Planned (not built)

| Item | Note |
| --- | --- |
| `GET /api/admin/audit-logs` | Audit rows are written for every sensitive action but there is no viewer yet |
| Clinician editing of an AI summary before approval | Today: approve or regenerate |
| Push / email notifications for behaviour-frequency spikes | Notifications are in-app and derived |
| Therapist report export | Therapists are read-only by design for now |
| Multi-instance rate limiting (Redis) | The Ask limiter is in-memory |
