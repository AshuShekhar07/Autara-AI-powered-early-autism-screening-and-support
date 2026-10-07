# Teammate hand-off — what is left to do

Status: the core MVP (screening, behaviour logs, role dashboards, RAG insights, Ask Autara, reports,
admin analytics) is built and runs end to end on demo data. It lives on branch **`feature/core-mvp`**.
Read `readme.md`, `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` first (20 minutes). This file lists what
is still open, grouped by effort.

## Rules that never change (read before touching anything)
1. **Screening aid, not a diagnosis.** Never add wording that diagnoses, names an "autism level", or gives
   medication/dosing advice. `backend/tests/contentSafety.test.js` scans for banned phrases — keep it green.
2. Every result, insight, report and AI answer shows: *"This is a screening aid, not a diagnosis. Please
   discuss results with a qualified clinician."*
3. A clinician has the final say. Caregivers see AI insights **only after** clinician approval.
4. **Synthetic / demo data only.** No real children's data anywhere.
5. Do **not** write clinical reference text yourself. Only approved, licensed documents go into the RAG corpus.
6. **Never commit secrets** (`.env`, Firebase private key, Gemini key, Mongo URI). New env vars go in `.env.example`.
7. **Never run backend tests against the real Atlas database.** Use a separate empty test database
   (`TEST_MONGODB_URI`) — the suite creates and wipes data.
8. Backend is CommonJS; frontend is plain CSS + JSX (no Tailwind, no TypeScript). Match the surrounding code.
9. If you add or change an API route, update `docs/API.md` (a test fails otherwise). If you change a design
   choice, add a line to `docs/DECISIONS.md`.

## Git workflow
```
git clone https://github.com/AshuShekhar07/Autara-AI-powered-early-autism-screening-and-support.git
git checkout feature/core-mvp
git checkout -b feature/<short-task-name>      # one branch per task
# ... work, run the tests for the part you touched ...
git add <files> && git commit -m "feat(area): what and why"
git push -u origin feature/<short-task-name>   # then open a pull request into feature/core-mvp
```
Run the checks before pushing: backend `npm test`, frontend `npm test` + `npm run build`,
ai-service `python -m pytest` (venv active). CI runs the same three jobs.

---

## LOW effort (each about 1–3 hours, little risk)

**L1. Secrets audit.** Run `git log -p | findstr /i "BEGIN PRIVATE KEY AIza mongodb+srv"` (or use GitHub secret
scanning). Confirm no real key/URI was ever committed. If a key was ever pasted into chat, a screenshot or a
file, rotate it (Firebase service-account key, Atlas DB user password, Gemini key, `AI_SERVICE_KEY`).

**L2. Verify the M-CHAT-R wording.** The 20 questions in `ai-service/app/screening/mchatr.py` were written
from memory. Compare each, word for word, with the official M-CHAT-R/F from https://mchatscreen.com (free for
clinical/research/educational use; keep its attribution and copyright notice). Fix any difference, set
`ITEMS_VERIFIED_AGAINST_SOURCE = True`, then run `python -m scripts.export_instrument` (regenerates the Node
fallback JSON) and `python -m pytest`. Add the required attribution to the screening page and readme.

**L3. Unit-test the Gemini retry.** `ai-service/app/llm/gemini.py` now retries 429/500/503 (`_with_retry`).
Add a pytest that fakes an exception with `.code = 503` twice then succeeds (patch `time.sleep`), and one that
checks a 403 is not retried.

**L4. Run every test suite and report.** The backend suite has only run on FerretDB locally; its first run on
real MongoDB is CI. Open the Actions tab, confirm all three jobs are green on `feature/core-mvp`, and fix
anything red. Record the exact pass counts in the readme.

**L5. Open the pull request** `feature/core-mvp` → `main`, fill in a description (what each phase added, how to
run, the safety rules above), and merge once CI is green and Ashu has reviewed.

**L6. Readme polish.** Add 4–6 screenshots (caregiver dashboard, screening result, behaviour charts,
clinician review, Ask Autara, admin analytics) from the demo data; add a Windows quick-start (venv commands,
`py -3.11`); remove anything the readme claims that is not built.

**L7. Docs sanity pass.** Check `.env.example` files list every variable the code reads (grep `process.env` and
`os.environ`). Check `docs/API.md` examples still match the responses.

## MEDIUM effort (about 0.5–2 days, needs some judgement)

**M1. Manual QA of every role with demo data.** In `backend`: `npm run seed:demo -- --caregiver --therapist --clinician`.
Walk through each role and write a bug list (GitHub issues): caregiver (screening → result → behaviour log → ask
→ report), therapist (read-only, notes), clinician (queue → case → generate insight → annotate → override →
approve), admin (verify users, analytics with k=5 hiding). Specifically check that a caregiver never sees an
insight before approval. Fix what you find.

**M2. Add approved reference documents to the RAG corpus.** Find public documents Autara is allowed to use
(for example a government or professional-body fact sheet; check the licence/terms allow reuse). Put each file
in `ai-service/knowledge/`, add an entry in `knowledge/sources.yaml` (title, publisher, url, version, docType),
run `python -m app.rag.ingest`. **Do not write or paraphrase clinical content yourself.** Keep the licence info
in `docs/DECISIONS.md`.

**M3. Evaluate and tune retrieval.** With real documents in place, edit `ai-service/eval/questions.json`
(currently 10 questions) to fit them, run `python -m eval.run`, and record retrieval hit rate, citation
validity and banned-phrase violations in `docs/`. Tune `RAG_MIN_SIMILARITY` (default 0.55 is a guess) and
document the value you pick and why. Report the numbers exactly as printed.

**M4. Run docker-compose for real.** `docker-compose.yml` was only checked with `docker compose config`.
Run `docker compose up --build`, fix whatever breaks (health checks, env vars, Chroma volume), and document
the working commands in the readme.

**M5. Accessibility and mobile pass.** Run Lighthouse and axe on the main pages at 360px and 1280px; fix
contrast, labels, focus order, keyboard use of the screening wizard and charts. The 360px layout was checked
once with a throw-away harness — re-check after any UI change.

**M6. Frontend states audit.** For each page confirm loading, empty and error states exist and show friendly
text (the AI-unavailable message must still show the "contact your clinician" line).

**M7. Persistent rate limiting.** Ask Autara's limit (20/hour/user) is in memory, so it resets on restart and
does not work across several server instances. Move it to MongoDB (TTL collection) or Redis; keep the same
HTTP 429 contract.

**M8. Analytics scale.** `backend/lib/analytics.js` computes in JavaScript over up to 50k documents (D-049).
Move heavy counts to Mongo aggregation, keeping the k=5 and secondary-suppression rules and their tests.
Note: FerretDB (local test DB) lacks some operators — test against real Mongo (the CI service container).

**M9. Auth edge cases.** Check what happens with password reset, unverified email, expired Firebase tokens and
a user deleted in Firebase but present in MongoDB. Write tests or fix as needed.

## HARD effort (multi-day, design needed, some are not just code)

**H1. Public demo deployment.** Frontend (Vercel/Netlify), backend (Render/Railway/Fly), AI service
(container). Needs: environment variables on each host, CORS and Firebase "authorized domains", the AI service
kept private (shared `X-Internal-Key`), a **persistent volume for `ai-service/storage/chroma`** (otherwise the
index is lost on each deploy — or re-ingest at start-up), HTTPS, MongoDB Atlas network rules, spending limits
on the Gemini key. Document it in `docs/`. Demo data only.

**H2. End-to-end browser tests.** Add Playwright (Chromium is the easy target) covering the main journeys for
each role against a seeded test database, wired into CI. Include the "caregiver cannot see unapproved insight"
and "therapist is read-only" checks.

**H3. Security review.** Systematically check access control on every route (owner / care-team / admin; others
get 404), audit-log coverage, input validation, error messages that leak information, dependency audit
(`npm audit`, `pip-audit`), Content-Security-Policy headers, and prompt-injection tests against insights and
Ask Autara (try to make the model diagnose, give doses, or reveal other children's data; add failing cases as
regression tests).

**H4. Real-world validation plan (not just code).** The product has no user or clinical evidence yet. Plan a
small, ethical pilot: written consent, no real child identifiers, a clinician reviewing AI insights for safety
and usefulness, a short caregiver usability test. Record real numbers (completion rate, time, rejected
insights, quotes). Do not present synthetic-data results as accuracy.

**H5. Optional probability model.** `docs/MODEL_CARD.md` says no model is trained; the rule-based score is
authoritative. Only attempt this with a real, properly licensed dataset and ethics approval; check for label
leakage (labels derived from the score itself); report cross-validated metrics and limits in the model card;
the model may only add an informational probability and must never change the risk tier.

**H6. Multi-language support (for example Hindi).** Needs translated and clinically checked questionnaire
wording, UI strings extracted into a translation layer, and RAG documents in that language. Translation of the
M-CHAT-R must come from an approved official translation, not machine translation.

**H7. Persistent notifications and email.** Notifications are derived on the fly (D-029). A real store with
read-state, plus email alerts for "review needed" / "insight approved", needs a mail provider, templates,
unsubscribe handling and tests.

---

## Suggested order for the next two weeks
1. L1, L2, L4, L5 (safety, correctness, merge) → 2. M1, M4 (find real bugs) → 3. M2, M3 (real reference
documents and measured eval numbers) → 4. H1 (public demo) → 5. H4 (first real feedback).
