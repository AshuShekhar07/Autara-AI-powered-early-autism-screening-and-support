# Reference corpus (approved sources only)

This folder feeds Autara's retrieval-augmented explanations ("insights") and **Ask Autara**.
**Autara does not ship any clinical reference content.** The team adds approved source documents here.

1. Put an approved PDF / Markdown / text file in this folder (file contents are git-ignored).
2. Add an entry for it in `sources.yaml` (title, publisher, URL, version, docType). Unlisted files are NOT ingested.
3. Build the index (needs `GEMINI_API_KEY` for embeddings):
   ```bash
   cd ai-service && python -m app.rag.ingest          # or POST /ingest with X-Internal-Key
   ```
   Re-running is safe: unchanged chunks are not duplicated and removed content is pruned.

Until at least one source is ingested, insights are generated from the patient's own evidence only
(`references: []`, with an uncertainty note) and Ask Autara answers that no reference material is loaded yet.

## Try the pipeline with the demo document (optional)
`docs/examples/autara-product-help.md` is a **non-clinical** help sheet about how the Autara app works, for testing only.
```bash
cp ../docs/examples/autara-product-help.md knowledge/        # from ai-service/ (Windows: copy ..\docs\examples\autara-product-help.md knowledge\)
```
then add this to `knowledge/sources.yaml` (replace `sources: []`):
```yaml
sources:
  - file: autara-product-help.md
    title: "Autara product help (demo)"
    publisher: "Autara team"
    url: "https://example.test/autara-help"
    version: "demo-1"
    docType: fact-sheet
```
and run `python -m app.rag.ingest`. Remove the entry (and re-ingest with `--reset`) before real use.

## Approved sources
_None yet — list them here (title · publisher · version · link) as they are approved._
