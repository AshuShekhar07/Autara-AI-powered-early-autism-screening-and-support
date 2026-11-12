"""ChromaDB persistence (ai-service/storage/chroma/, git-ignored).

We compute embeddings ourselves (through the LLM provider) and hand them to Chroma, so Chroma is
only a vector store here. Cosine distance is used; similarity = 1 - distance.
"""
from __future__ import annotations

import chromadb

from app import config

COLLECTION = "autara_reference"
BACKUP_COLLECTION = "autara_reference_local"   # same documents, embedded by the local model (a different vector size)


def get_collection(backup: bool = False):
    client = chromadb.PersistentClient(path=str(config.chroma_dir()))
    return client.get_or_create_collection(BACKUP_COLLECTION if backup else COLLECTION, metadata={"hnsw:space": "cosine"})


def corpus_size(backup: bool = False) -> int:
    try:
        return get_collection(backup).count()
    except Exception:
        return 0
