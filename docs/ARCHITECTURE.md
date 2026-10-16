# Autara architecture

Autara is a **screening aid, not a diagnosis tool**. The design follows from that: risk tiers instead of diagnoses, evidence-linked explanations, a clinician who is always the final authority.

## 1. System overview

```
┌──────────────┐  HTTPS   ┌────────────────────┐        ┌───────────┐
│ React (Vite) │ ───────► │ Node/Express :4000 │ ─────► │  MongoDB  │
│ Firebase Auth│  Bearer  │ (auth, RBAC, data) │        └───────────┘
└──────────────┘  token   └─────────┬──────────┘
                                    │ X-Internal-Key (shared secret), 127.0.0.1 / private network only
                                    ▼
                          ┌───────────────────────┐   embeddings / generation   ┌────────┐
                          │ FastAPI AI service    │ ──────────────────────────► │ Gemini │
                          │  /screen /insights    │                             └────────┘
                          │  /ask /ingest         │ ◄──► ChromaDB (storage/chroma)
                          └───────────────────────┘
```

* The **browser** talks only to Node. It authenticates with Firebase; Node verifies the ID token with the Firebase Admin SDK and reads the role from MongoDB.
* **Node** owns all data, authorisation and workflow state, and builds the *minimum* evidence for the AI service.
* The **AI service** is stateless apart from the vector index. It is not reachable from the internet (bind address + shared secret; Docker does not publish its port).
* The LLM sits behind a two-method provider interface (`generate_json`, `embed`), so Gemini can be swapped for another provider without touching the rest.

## 2. Roles and access control

| Rule | Where |
| --- | --- |
| Role always read from MongoDB, never trusted from the client | `middleware/requireRole.js` |
| Therapist/clinician must be admin-**verified** on every route (unless a route opts out) | `requireRole` (default) |
| Child-scoped routes go through one helper: caregivers own, professionals need a care-team link, admins never | `middleware/childAccess.js` |
| Non-admin "no access" is indistinguishable from "does not exist" (404) | `childAccess.js`, screening/insight loaders |
| Signup trusts only the verified token for `uid`/`email` | `controllers/authController.js` |
| Sensitive actions are written to an append-only `AuditLog` | `lib/audit.js` |

## 3. Data model (MongoDB / Mongoose)

`User` · `Child` (caregiverUid, care team, milestone statuses) · `Screening` (answers, riskScore/Tier, domain breakdown, status + history, clinician review: annotations, override, reviewedAt) · `BehaviourLog` (ABC with fixed enums + local-time facets) · `Insight` · `SessionNote` · `Report` (history only) · `AuditLog`.

### Screening lifecycle (single source: `lib/screeningStatus.js`)

```
DRAFT ─► SCREENING_SUBMITTED ─► PROCESSING ─┬─► INSIGHTS_READY ─► UNDER_CLINICAL_REVIEW ─► REVIEWED
                                    ▲       └─► PROCESSING_FAILED ──(retry)──┘
```
`INSIGHTS_READY` means *the risk score has been computed*. The LLM insight is a separate `Insight` document generated on demand by a clinician.

### Behaviour aggregation
Every log stores `local.hour / weekday / weekStart` in the family's local time (from the client's `tzOffsetMinutes`). The summary is then plain `$match → $group($sum)` aggregations (counts, antecedent×behaviour matrix, consequences per behaviour, weekly trend, hour/weekday, top pairs), with averages computed as sum ÷ count.

## 4. Screening (M-CHAT-R)

The 20 items, the official scoring (items 2, 5, 12 reverse-scored; 0–2 low, 3–7 medium, 8–20 high) and the project-defined domain grouping ("Autara grouping, not part of the official instrument") live **only** in `ai-service/app/screening/mchatr.py`. Node caches the definition and forwards it to the UI. The rule-based tier is always authoritative; an optional ML probability (`ml/`) is informational and hidden from caregivers.

## 5. RAG explanations (what is actually built)

```
Clinician: "Generate AI insight"
  │
  ▼ Node: evidence builder (minimal)                                   AI service
  screening answers + flagged items + domains                    ┌───────────────────────────────┐
  + behaviour summary + ≤20 recent logs (ids, categories,        │ 1. build query from flagged   │
    short scrubbed notes; child age in months only)  ──────────► │    domains + top patterns     │
                                                                 │ 2. retrieve top-k chunks from │
                                                                 │    Chroma (drop < threshold)  │
                                                                 │ 3. prompt = system prompt     │
                                                                 │    (prompts/insight_v1.txt) + │
                                                                 │    evidence + numbered chunks │
                                                                 │ 4. LLM → JSON                 │
                                                                 │ 5. VALIDATE (below)           │
                                                                 │ 6. one retry, else "failed"   │
  Node stores Insight (generated | failed) ◄──────────────────── └───────────────────────────────┘
  Clinician reviews → approves → caregiver sees ONLY caregiverSummary
```

**Ingestion** (`python -m app.rag.ingest`): `knowledge/sources.yaml` lists the approved documents → load PDF pages / Markdown sections → clean → split (~600 tokens, 80 overlap; LangChain's splitter only) → metadata (source, page, section, docType, version, ingestedAt) → embed → Chroma with content-hash ids (idempotent; stale chunks pruned). Patient data never enters the index.

**Validator (safety core)** rejects an insight if: not valid JSON/schema · any evidence id isn't in the supplied evidence (checked per evidence type) · any reference doesn't match a retrieved chunk (source + page) · any text matches a banned diagnostic pattern · `uncertainty` is empty. The banned list is regex-based (see `ai-service/app/safety.py`): statements that a child has or is a condition, diagnostic wording, autism levels 1–3, severity labels, and claims that something "confirms" a condition — with negation handling only for meta-statements that deny being a diagnosis. Failures are stored as reason codes, never raw model text.

**Empty corpus:** retrieval returns nothing without needing an API key; insights are still generated from patient evidence with `references: []` and an uncertainty note appended *in code*; Ask Autara answers that no reference material is loaded yet.

**Ask Autara** (`POST /api/assistant/ask`): per-user rate limit → guardrails *before* any LLM call (urgent safety → "contact your clinician or local emergency services", medication/dosing refused, diagnosis/level questions redirected) → retrieval → answer strictly from cited passages (validated: citation labels exist, ≥1 citation, no banned/dosing text) → `sources` always returned, "I don't know" otherwise. Child context = latest **reviewed** tier and flagged areas only.

## 6. Reports and analytics

PDF (pdfkit) and CSV are generated on demand, streamed, and recorded as history rows. Reports contain initials + age in months, never the full name; the disclaimer is in the footer of every PDF page. Admin analytics are aggregate-only with k-anonymity (k = 5) plus secondary suppression.

## 7. Failure behaviour

| Failure | Behaviour |
| --- | --- |
| AI service down when scoring | Scored locally with the same official rules (`modelVersion: mchatr-rules-v1-local`, no ML probability). Only if that also fails is the screening saved as `PROCESSING_FAILED` for a retry |
| AI service down when generating an insight | `503 AI_SERVICE_UNAVAILABLE`, nothing stored |
| LLM output fails validation twice | `failed` insight with reason codes; nothing unsafe is shown or stored |
| No Gemini key | Screening works; insights `failed: LLM_NOT_CONFIGURED`; Ask Autara says it's unavailable (or "no reference material" while the index is empty) |
| Empty knowledge folder | See §5 |
