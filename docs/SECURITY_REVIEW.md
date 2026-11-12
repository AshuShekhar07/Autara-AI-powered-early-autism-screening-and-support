# Security review (penetration test), 12 Nov 2026

Scope: backend API (Express + MongoDB), AI service (FastAPI), frontend (React), dependencies, secrets and deployment files.
Method: code review of every route, then attacks written as automated tests so each result is repeatable.
Data: synthetic only; tests run against throw-away databases, never the real Atlas database.

## Result in one line
No way found to read another family's data, escalate a role, skip the clinician approval of AI insights, or leak a secret.
Six real weaknesses were found and fixed (table below). One accepted risk and four recommendations remain.

## What was attacked and held
| Area | Attacks tried | Outcome |
|---|---|---|
| Authentication | missing, empty, wrong-scheme, expired and invalid tokens on 10 routes; token for a user with no profile | always 401 / 404, never data |
| Sign-up | role "admin", operator objects as role, extra `verified` / `uid` fields, object-valued names | refused or ignored; new clinicians start unverified |
| Injection | `$ne` / `$gt` operators in query strings and JSON bodies on every id and text field | 400, never executed |
| Prototype pollution | `__proto__` / `constructor` keys in bodies, milestones, answers | no effect |
| Access control (IDOR) | a second caregiver and a clinician who is not on the care team against every per-child and per-screening route (reads and writes, incl. approve, export, retry) | uniform 404 (same as "does not exist") |
| Role matrix | wrong role on 18 privileged routes (admin, review, approve, export, notes, care team) | 4xx every time |
| Mass assignment | extra fields on child edit, log edit, screening submit | ignored (owner, author, tier, status, age cannot be set) |
| AI insight gate | caregiver, timeline and overview before approval; after approval; failed insights | caregiver sees only the approved plain-language summary |
| Review lock | every clinician write after REVIEWED | 409 |
| Input hardening | 200 kB body, malformed JSON, wrong content type, array body, path tricks | clean 400 / 404, no stack traces |
| Headers and CORS | foreign origin, pre-flight from a foreign origin, fingerprint headers | blocked; helmet headers present; no `x-powered-by` |
| Secrets | tracked files and full git history scanned for API keys, private keys, database passwords | only placeholders |
| AI service | internal key (constant-time, fails closed), port not published in compose | OK |

## Findings that were fixed
| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | High (cost) | **Rate limit bypass.** 30 parallel Ask requests: 27 passed a 20-per-hour limit. This is how a free Gemini quota gets drained. | D-070 |
| 2 | High (safety) | **Urgent wording missed.** "stopped breathing", "end her life", "ate bleach", "turning blue", "ran into the road" were sent to the model instead of showing the emergency message. | D-071 |
| 3 | Medium (safety) | **Output filter gaps.** Statements such as "on the spectrum", "meets the criteria", "very likely…", "I would diagnose…", other named conditions and spelled-out doses were not caught. | D-071 |
| 4 | Medium (safety) | **Insights accepted medication doses**, so a caregiver's note could try to steer the model. | D-072 |
| 5 | Medium (privacy) | **Child's name leaked to the model** when it had accents or was non-Latin (Ānya, José, आरव): JavaScript `\b` only knows A–Z. | D-073a |
| 6 | Low | Answer keys like `"1.0"` / `"0x2"` accepted and overwrote real answers; source links not restricted to http(s); a clinician could not undo a mistaken tier override; guardrails could be dodged with dotted, digit-swapped, full-width or zero-width letters; backend dependency advisories (mongoose, body-parser, qs). | D-071, D-073 |

## Accepted risk
- Four moderate advisories remain in `firebase-admin`'s own dependency chain (glob / minimatch). They concern glob patterns; Autara never passes user input to them.
- The frontend audit shows findings in Firebase's unused server-side modules (`undici`, `@grpc/grpc-js`, not in the browser bundle) and a `react-router` open-redirect advisory. Autara never navigates to a user-supplied address. Upgrading react-router to v7 is a breaking change; schedule it after the milestone.

## Recommendations before any public deployment
1. **Atlas access:** remove the temporary `0.0.0.0/0` rule; allow only the host's address.
2. **Content-Security-Policy** for the frontend host (the API already sends helmet headers): `default-src 'self'`, Firebase and Google Fonts allowed.
3. **Containers:** the AI service and its volume run as root. Add a non-root user once `docker compose` has been run for real (not yet done, see M4 in TEAMMATE_TODO).
4. **Gemini:** use a restricted key (only the Generative Language API), set a spending cap, and keep `AUTH_CHECK_REVOKED=true`.
5. **Regex guardrails** (urgent / medication / diagnosis) are a first line, not a guarantee; keep adding wordings to `ai-service/tests/test_guardrail_bypass.py`, and run `python -m eval.redteam` with a working key.

## Not tested
Real Firebase tokens (the tests replace the verifier), the live Gemini model (key unavailable), load testing, social-engineering and physical security.
