# M-CHAT-R/F — source, verification and terms of use

## What Autara uses
Autara implements **stage 1, the M-CHAT-R** (20 parent-report questions, scoring, three likelihood bands) from the
*Modified Checklist for Autism in Toddlers, Revised, with Follow-Up (M-CHAT-R/F)*, © 2009 Diana Robins, Deborah Fein
& Marianne Barton, **terminology update March 2025** (file `M-CHAT-R_F_March_2025.v2.pdf`, from www.mchatscreen.com).

## Verification (done 2026-10-16)
- All 20 item texts in `ai-service/app/screening/mchatr.py` were compared with page 3 of that PDF. They are
  **identical** (whitespace-normalised); one typographic difference (a straight vs curly apostrophe in item 18) was corrected.
- The official instructions printed above the questions are stored word for word (`INSTRUCTIONS`) and shown to the caregiver.
- Scoring was checked against page 2 of the PDF: items 2, 5 and 12 are scored the opposite way (a "yes" counts);
  total 0–2 low, 3–7 moderate, 8–20 high; valid for 16–30 months.
- `ai-service/tests/test_mchatr.py::test_items_match_verified_digest` fails if any item is changed. Update the stored
  digest only after re-checking the official document.

## Official terms of use (summarised from the PDF — read the original)
1. Free to download and use for **clinical, research and educational purposes**; it is copyrighted, not open source.
2. Any reproduction must show the copyright (© 2009 Robins, Fein, & Barton). **No modifications** to items,
   instructions or item order without the authors' permission.
3. The M-CHAT-R must be used **in its entirety** (partial item sets lose their validated properties).
4. **Putting the M-CHAT-R/F into electronic products or software for use by others needs the authors' permission**
   (contact: mchatscreen2009@gmail.com). A medical practice may use stage 1 inside its own electronic record, but
   needs a licensing agreement to distribute that page outside the practice.

### What this means for the project
- As an **academic / educational project** shown to your mentor and evaluators, this use fits the free educational
  permission. Keep it on demo data.
- Before you **publish a public demo link** (for example on AWS), or let people outside your course use it, send the
  authors a short email describing the project and ask for permission. Keep the reply. Do this before deployment.
- The instructions say "circle yes or no"; Autara shows them verbatim. If you want wording suited to a web form, that is a
  modification and needs the authors' permission.

## Not implemented: the Follow-Up interview (stage 2)
For a **moderate** likelihood result (total 3–7) the official process is a structured Follow-Up interview on the items
that were answered in the elevated-likelihood way; the child "screens positive" if two or more Follow-Up items still
score at high likelihood, otherwise "screens negative". Autara currently shows the tier and recommends a Follow-Up and
a professional conversation, but the interview itself is done outside the app with the official document (pages 4–25).
Building it would mean transcribing 20 decision-flow pages into data, a new clinician screen and scoring, and
getting the authors' permission first. It is listed as an optional feature in `docs/TEAMMATE_TODO.md`.

## Terminology note (March 2025 update)
The official document speaks of **low / moderate / high likelihood** for autism. Autara's labels and API fields use
**risk tier** (`low` / `medium` / `high`). Renaming the visible wording to "likelihood" would follow the authors'
terminology more closely; it touches the UI text, reports and docs (not the scoring) and is a possible follow-up.
