# Ask Autara backup — how to build and test it

What it is: when Gemini is unavailable, Ask Autara shows the best-matching passages from the approved documents,
word for word, with their source. No AI writes anything, no API key is needed, nothing leaves the laptop.
Details and reasoning: D-074 in `DECISIONS.md`.

## One-time setup (PowerShell, in `ai-service`)
```powershell
cd C:\Users\ashus\Autara-AI-powered-early-autism-screening-and-support\ai-service
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt          # nothing new is needed; this just makes sure everything is present
python -m app.rag.ingest --backup        # builds the backup index (first run downloads ~80 MB once)
```
Expected: `Ingested 2 file(s): 15 chunks (15 new, 0 removed). Backup index size: 15` (numbers depend on your documents).
Your normal (Gemini) index is untouched.

## Test 1 — the backup finds the right passages (no key needed)
```powershell
python -m app.assistant.debug --local "What causes developmental delays in toddlers?"
python -m app.assistant.debug --local "What happens at a follow-up interview?"
python -m app.assistant.debug --local "What is the capital of France?"
```
Related questions should print `PASS` and 1–3 quoted passages; the France question should say it doesn't know.
If good matches are dropped, lower `RAG_BACKUP_MIN_SIMILARITY` in `ai-service/.env` (0.25). If unrelated text shows up, raise it (0.35).
To see all scores for your question list: `python -m eval.scores --backup`.

## Test 2 — automatic fallback when Gemini fails
1. In `ai-service/.env` make sure `ASK_MODE=auto` (or leave it out; auto is the default).
2. Break the Gemini key on purpose (add a letter to `GEMINI_API_KEY`), restart the AI service.
3. Open Ask Autara and ask a normal question. You should get quoted passages with the label **Quoted from approved sources**.
4. Put the key back and restart. Answers are written by Gemini again.

## Test 3 — never call Gemini at all
Set `ASK_MODE=local`, restart the AI service, and ask. Every answer is quoted passages (this also uses zero Gemini quota).

## Test 4 — safety still comes first
Ask: "my child stopped breathing" (emergency message), "how much melatonin" (medication refusal),
a question asking whether your child has a condition, e.g. "is my son on the spectrum" (no-diagnosis message). These never reach any model or the backup.

## Notes
- Re-run `python -m app.rag.ingest --backup` whenever you add or change a document (and the normal ingest for Gemini).
- The backup ignores the child's screening context, so those answers are general, not personal.
- If the first backup run cannot download the model (no internet), Ask Autara simply shows the usual "not available" message.

## Step 2: Mistral writes the answer (optional)
Order in `ASK_MODE=auto`: **Gemini → Mistral → quoted passages**. Mistral only *writes*; the passages are found with the
offline index you built above, so nothing else needs to be built.

1. Get a free key at https://console.mistral.ai (API keys). Read their data-use terms for your plan.
2. In `ai-service\.env` add (do not paste it anywhere):
   ```
   MISTRAL_API_KEY=your-key
   MISTRAL_MODEL=mistral-small-latest
   ```
3. Check it works:
   ```powershell
   cd C:\Users\ashus\Autara-AI-powered-early-autism-screening-and-support\ai-service
   .\.venv\Scripts\Activate.ps1
   python -m app.llm.check --mistral
   ```
   Expected: `PASS  text generation (mistral-small-latest)`.
4. Test the chain in the app: keep the Gemini key broken, set `ASK_MODE=mistral` (skips Gemini) or leave `auto`, restart the AI service,
   and ask "What causes developmental delays in toddlers?". You should now get a **written** answer with sources (no "Quoted from approved sources" label).
5. Break the Mistral key too (add a letter) and ask again: you should be back to quoted passages. Nothing is ever left blank.

Privacy: Mistral gets the question and public reference passages only. The child's screening context is never sent to it.
