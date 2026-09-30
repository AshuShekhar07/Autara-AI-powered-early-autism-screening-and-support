"""ChromaDB persistence (ai-service/storage/chroma/, git-ignored).

We compute embeddings ourselves (through the LLM provider) and hand them to Chroma, so Chroma is
only a vector store here. Cosine distance is used; similarity = 1 - distance.
"""
from __future__ import annotations

import chromadb

from app import config

COLLECTION = "autara_reference"


def get_collection():
    client = chromadb.PersistentClient(path=str(config.chroma_dir()))
    return client.get_or_create_collection(COLLECTION, metadata={"hnsw:space": "cosine"})


def corpus_size() -> int:
    try:
        return get_collection().count()
    except Exception:
        return 0
