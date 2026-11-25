# Deploying Autara (Render)

Autara is three programs: the **website** (React, static files), the **backend** (Node/Express) and the
**AI service** (Python/FastAPI). Render runs all three from one file, `render.yaml` (a "Blueprint"), on the free plan.
Vercel/Netlify only host websites and short serverless functions, so they can't run the Python AI service.

Free plan notes: a service that gets no visits for 15 minutes goes to sleep; the next visit takes ~1 minute to wake
it. Before a demo, open the three URLs once. Screening still gets a result if the AI service is asleep (the backend
applies the same scoring rules itself).

## 0. Before you start (once)
1. **Reference documents (Ask Autara):** the PDFs in `ai-service/knowledge/` are git-ignored, so Render can't see
   them. Commit the approved public documents and their `sources.yaml` entries (CDC material is US-government public
   domain):
   ```
   git add -f ai-service/knowledge/sources.yaml ai-service/knowledge/*.pdf
   git commit -m "Add approved reference documents for deployment"
   git push
   ```
   The AI service builds its offline search index from them while it is being deployed.
2. **MongoDB Atlas → Network Access:** allow `0.0.0.0/0` (Render's addresses change). Keep the database user's
   password strong.

## 1. Create the services
Render dashboard → **New → Blueprint** → connect GitHub → pick this repository and the branch you deploy → **Apply**.
Render asks for every value marked `sync: false`. On this first pass the three service URLs are not known yet:
type `https://example.com` for `AI_SERVICE_URL`, `ALLOWED_ORIGINS` and `VITE_API_BASE_URL`; fill in the rest:

| Service | Variable | Value |
| --- | --- | --- |
| autara-ai | `BACKUP_LLM_API_KEY` | your Groq key |
| autara-ai | `GEMINI_API_KEY` | leave empty |
| autara-backend | `MONGODB_URI` | from `backend/.env` |
| autara-backend | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | from `backend/.env` (paste the key exactly, with its `\n`) |
| autara-backend | `ADMIN_EMAILS` | the admin emails, comma-separated |
| autara-web | `VITE_FIREBASE_*` (6 values) | from `frontend/.env` |

`AI_SERVICE_KEY` is created by Render and shared between the AI service and the backend automatically.

## 2. Put in the real URLs (once the first deploy finishes)
Each service's page shows its address, like `https://autara-backend-xxxx.onrender.com`.
1. **autara-backend → Environment:** `AI_SERVICE_URL` = the autara-ai address; `ALLOWED_ORIGINS` = the autara-web
   address (exactly, no `/` at the end). Save → it redeploys.
2. **autara-web → Environment:** `VITE_API_BASE_URL` = the autara-backend address (no `/` at the end). Save → then
   **Manual Deploy → Clear build cache & deploy** (the website reads it while being built).
3. **Firebase console → Authentication → Settings → Authorized domains → Add domain:** the autara-web address
   without `https://`.

## 3. Check it
- `https://<autara-ai>/health` → `{"status":"ok",...}`
- `https://<autara-backend>/api/health` → `{"success":true,...}` and `/api/health/ai` → AI reachable
- open the website, log in, run a screening, ask a question; admins use `https://<autara-web>/admin/login`.

Later changes: push to the same branch → Render redeploys automatically.
