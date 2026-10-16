# Autara — small usability pilot plan (template)

Purpose: collect **real, honest evidence** that people can use Autara and that clinicians find the AI-assisted
explanations safe and useful. This is a *usability and safety-review* pilot, not a clinical validation study.
Nothing in it measures diagnostic accuracy, and results must never be described that way.

> Screening aid, not a diagnosis. Please discuss results with a qualified clinician.

## 1. Ground rules (ethics and safety)
- **Fictional data only.** Participants use a provided fictional child profile (a made-up name and date of birth).
  They must **not** enter their own child's or anyone's real information. This keeps the "synthetic data only" rule intact.
- **Voluntary and informed.** Everyone reads and agrees to the consent text (section 6) before starting. They can stop at any time.
- **No personal data in the results.** Record a participant number (P1, P2…), not names. Keep any signed consent
  separately from the results table.
- **Ask your mentor/college first.** If your institution has an ethics or approval process, follow it before recruiting.
- **Be honest about the limits.** Small sample, convenience sample, demo data, one model, one short document set.

## 2. Who to recruit (suggested minimum)
| Group | Target | Notes |
| --- | --- | --- |
| Caregiver-style testers | 5–10 | Friends/family/classmates who play the caregiver role with the fictional child |
| Clinician or therapist reviewers | 1–3 | A psychologist, paediatrician, therapist or special educator; they review the AI insight outputs |
| Mentor / evaluator | 1 | Optional walkthrough |

## 3. Tasks for caregiver-style testers (about 15 minutes)
1. Sign up as a caregiver using the fictional child details.
2. Complete the screening questionnaire from the scenario card.
3. Find the result and say what it means in your own words.
4. Log one behaviour entry and open the trend charts.
5. Ask the assistant one general question (for example "What happens at a follow-up interview?") and one question it should refuse (for example "Can you diagnose my child?").
6. Find the reports page.
Record: did they finish each task without help (yes/no), minutes taken, any place they got stuck.

## 4. Tasks for clinician/therapist reviewers (about 20 minutes)
Use the seeded demo data (`npm run seed:demo`), open the review queue and, for 3–5 AI insights, rate each:
| Question | Scale |
| --- | --- |
| Every claim is traceable to an answer, behaviour log or reference | Yes / Partly / No |
| The text avoids diagnosing or labelling the child | Yes / No (describe any problem) |
| The family summary is clear and calm | 1 (poor) – 5 (excellent) |
| I would be comfortable approving this for a family after editing | Yes / With edits / No |
Also ask: "What is missing or risky?" and record the exact wording of any unsafe or misleading sentence.

## 5. Metrics to record (and how to calculate them)
| Metric | How |
| --- | --- |
| Task completion rate | tasks finished without help ÷ tasks attempted (per task and overall) |
| Median time to finish the screening | median of the minutes recorded |
| Usability score (SUS) | 10-question System Usability Scale (see below); score = ((sum of odd-item scores − 5) + (25 − sum of even-item scores)) × 2.5, range 0–100 |
| Guardrail check | out of the refusal questions asked, how many were refused correctly |
| Insight safety review | share of reviewed insights rated "avoids diagnosing = Yes"; list every "No" |
| Clinician approval | share rated "comfortable approving" Yes or With edits, and the number of edits needed |

**SUS items (1 = strongly disagree … 5 = strongly agree):** 1) I would use Autara frequently. 2) It was unnecessarily complex.
3) It was easy to use. 4) I would need technical support to use it. 5) The functions were well integrated.
6) There was too much inconsistency. 7) Most people would learn it quickly. 8) It was awkward to use.
9) I felt confident using it. 10) I needed to learn a lot before I could use it.

## 6. Consent text (copy, adapt, ask participants to tick)
> I understand that I am testing a student project called Autara. It uses **fictional demo data only**; I will not enter real
> information about any child or person. Autara is a screening aid, not a diagnosis, and I will not use it to make decisions
> about a real child. My feedback will be used anonymously (as Participant P#) for the project report. I can stop at any
> time. ☐ I agree.

## 7. Results table (fill with real numbers only)
| Participant | Role | Tasks completed (of 6) | Minutes for screening | SUS | Main problem | One-line quote (with permission) |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | | | | | | |

Summary line to report, using only what you measured, for example:
"N testers completed the screening unaided in a median of M minutes; mean SUS = X; K of L reviewed insights were rated as avoiding a diagnosis."
If a number was not measured, write **not measured**. Do not round up and do not describe the results as accuracy or clinical validation.

## 8. After the pilot
Turn each recorded problem into an issue; fix the top three; re-test with two people; update `docs/DECISIONS.md` with what changed and why.
