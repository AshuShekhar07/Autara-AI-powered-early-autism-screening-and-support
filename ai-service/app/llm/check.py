"""Quick self-test for the Gemini setup:   python -m app.llm.check

Makes ONE tiny generation call and ONE tiny embedding call with the models from your .env and says
which worked. Nothing is stored. Your key is never printed.
"""
from __future__ import annotations

import json
import sys

from app import config


def _redact(text: str) -> str:
    key = config.gemini_api_key()
    return text.replace(key, "***") if key else text


def main() -> int:
    key = config.gemini_api_key()
    print(f"LLM_MODEL        = {config.llm_model()}")
    print(f"EMBEDDING_MODEL  = {config.embedding_model()}")
    if not key:
        print("\nFAIL: GEMINI_API_KEY is empty. Put your key in ai-service/.env and run this again.")
        return 1
    print(f"GEMINI_API_KEY   = set ({len(key)} characters)\n")

    from app.llm import gemini
    provider = gemini.build()
    ok = True

    try:
        resp = provider._client.models.generate_content(  # direct call so we can show the real reason on failure
            model=provider.model,
            contents='Reply with exactly this JSON and nothing else: {"ok": true}',
            config=provider._types.GenerateContentConfig(response_mime_type="application/json", temperature=0),
        )
        data = json.loads(resp.text)
        print(f"PASS  text generation ({provider.model}) → {data}")
    except Exception as exc:  # noqa: BLE001
        ok = False
        print(f"FAIL  text generation ({provider.model}): {type(exc).__name__}: {_redact(str(exc))[:300]}")

    try:
        vec = provider.embed(["hello"], "query")[0]
        print(f"PASS  embeddings ({provider.embedding_model}) → vector of {len(vec)} numbers")
    except Exception as exc:  # noqa: BLE001
        ok = False
        print(f"FAIL  embeddings ({provider.embedding_model}): {type(exc).__name__}: {_redact(str(exc.__cause__ or exc))[:300]}")

    print("\nAll good — insights and Ask Autara can use Gemini." if ok else
          "\nSomething failed. Common causes: wrong key, a model name your key can't use (change LLM_MODEL / EMBEDDING_MODEL "
          "in ai-service/.env), the free-tier rate limit, or no internet.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
