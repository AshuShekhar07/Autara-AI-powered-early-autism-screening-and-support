"""Test doubles for the LLM provider. Nothing here calls a network."""
from __future__ import annotations

import hashlib
import json
import math
import re

from app.llm.base import LLMError


class FakeProvider:
    """Deterministic embeddings (hashed bag-of-words, so similar words → similar vectors) and scripted generations."""

    name = "fake"
    model = "fake-model"
    DIM = 96

    def __init__(self, responses=None):
        self.responses = list(responses or [])   # strings, dicts (dumped to JSON) or LLMError instances
        self.prompts: list[tuple[str, str]] = []
        self.embed_calls = 0

    def embed(self, texts, kind):
        self.embed_calls += 1
        return [self._vec(t) for t in texts]

    def _vec(self, text):
        v = [0.0] * self.DIM
        for word in re.findall(r"[a-z]+", text.lower()):
            h = int(hashlib.md5(word.encode()).hexdigest(), 16)
            v[h % self.DIM] += 1.0
        norm = math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / norm for x in v]

    def generate_json(self, system, user):
        self.prompts.append((system, user))
        if not self.responses:
            raise AssertionError("FakeProvider ran out of scripted responses")
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r if isinstance(r, str) else json.dumps(r)


def down():
    return LLMError("LLM_ERROR", "simulated outage")
