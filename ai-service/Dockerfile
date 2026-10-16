# Autara AI service (FastAPI). Build context: ./ai-service
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Inside a container the service must listen on all interfaces; compose does NOT publish this port to the
# host, so only the backend container can reach it (plus the shared X-Internal-Key secret).
ENV AI_HOST=0.0.0.0 AI_PORT=8000
EXPOSE 8000
CMD ["python", "-m", "app"]
