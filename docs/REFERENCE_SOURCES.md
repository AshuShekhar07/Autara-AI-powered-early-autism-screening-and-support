# Adding approved reference documents (step by step)

Autara answers questions and writes explanations **only from documents your team approves**. It ships none. You pick them,
check their licence, and add them. **Never write or paraphrase clinical text yourself** — use the publisher's own document.

## 1. Pick 3–5 documents
Good starting points (my understanding of their terms — **read each page's own terms/footer before using it**, I could not open
these sites from my environment to check):
| Candidate | Publisher | Licence (check!) | Notes |
| --- | --- | --- | --- |
| "Learn the Signs. Act Early." developmental monitoring / screening pages | US CDC | Most CDC web content is US-government public domain; images and third-party material may not be | The dashboard already links CDC pages |
| Autism information pages (signs, screening, evaluation) | US NICHD / NIH | US-government work, normally public domain | Prefer the plain-language pages |
| Autism spectrum disorders fact sheet | WHO | CC BY-NC-SA 3.0 IGO (attribution, non-commercial, share-alike) | Fine for a college project; not for commercial use |

**Do not ingest:** the M-CHAT-R/F itself (electronic reproduction needs the authors' permission — see `docs/MCHATR_TERMS.md`; the
questionnaire is already built in), pages from sites with all-rights-reserved copyright (for example parenting-advice sites,
advocacy groups, publishers' paywalled guidelines), or anything you cannot show a licence for.

## 2. Save each as a PDF
Open the page in your browser → **Print → Save as PDF** (or use the publisher's own PDF). PDFs keep page numbers, so answers can
cite "page 2". Check the PDF opens and the text is selectable (not a picture).

## 3. Add it with one command (no YAML editing)
In the AI-service window (venv active, `ai-service` folder):
```powershell
python -m app.rag.add_source --file "C:\Users\you\Downloads\cdc-screening.pdf" `
  --title "Exact title of the document" --publisher "CDC" `
  --url "https://the-page-url" --version "retrieved 2026-10" --type fact-sheet `
  --licence "US government work, public domain (checked <date>)"
```
It copies the file into `knowledge/`, adds the entry to `sources.yaml` (keeping the comments), and refuses a broken file.
`--type` is one of `guideline`, `screening-manual`, `fact-sheet`, `other`. Repeat for each document.

## 4. Build the index and look at it
```powershell
python -m app.rag.ingest        # expect: Ingested N file(s): M chunks ...
python -m eval.scores           # which chunks match which question, and how strict the threshold can be
```
Then restart `python -m app` and try a few questions on `/ask`. Every answer must show its sources.

## 5. Record your decision
Add a line to `docs/DECISIONS.md` for each document: title, publisher, URL, date retrieved, licence and who approved it.
The files in `knowledge/` are git-ignored on purpose; keep the original PDFs somewhere safe so the index can be rebuilt.
To start over: `python -m app.rag.ingest --reset`.
