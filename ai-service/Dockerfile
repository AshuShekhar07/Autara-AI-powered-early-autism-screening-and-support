# Autara AI service (FastAPI). Build context: ./ai-service
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Build the OFFLINE search index (local MiniLM model, no API key) from the approved documents in knowledge/
# while the image is built, so Ask Autara has its passages as soon as the service starts. With no documents
# committed this builds nothing and the service still runs ("no reference material loaded yet").
RUN python -m app.rag.ingest --backup || echo "[build] offline index not built - see the log above"
# Inside a container the service must listen on all interfaces; compose does NOT publish this port to the
# host, so only the backend container can reach it (plus the shared X-Internal-Key secret).
# Port: $PORT when the host sets one (Render), otherwise 8000 (docker compose). Don't hard-code AI_PORT here.
ENV AI_HOST=0.0.0.0
EXPOSE 8000
CMD ["python", "-m", "app"]
