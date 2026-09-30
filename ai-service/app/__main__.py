"""`python -m app` — starts uvicorn bound to AI_HOST (default 127.0.0.1, internal only)."""
import uvicorn

from app import config

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=config.host(), port=config.port())
