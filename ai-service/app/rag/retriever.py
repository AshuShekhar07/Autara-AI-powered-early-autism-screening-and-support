"""Retrieval: query → top-k chunks (with scores and metadata) above a similarity threshold."""
from __future__ import annotations

from dataclasses import dataclass

from app import config
from app.rag import store


@dataclass(frozen=True)
class Chunk:
    id: str
    text: str
    score: float           # cosine similarity, 0–1 (higher = closer)
    source: str            # document title
    publisher: str
    url: str
    version: str
    doc_type: str
    page: int | None
    section: str

    def label(self) -> str:
        page = f", page {self.page}" if self.page else ""
        section = f', section "{self.section}"' if self.section else ""
        return f'"{self.source}" ({self.publisher}, {self.version}){page}{section}'


def build_query(flagged_areas: list[str], behaviour_patterns: list[str]) -> str:
    """Turns the case into a short search query from flagged domains and top behaviour patterns."""
    parts = []
    if flagged_areas:
        parts.append("Early developmental screening flagged areas: " + ", ".join(flagged_areas))
    if behaviour_patterns:
        parts.append("Behaviour patterns: " + "; ".join(behaviour_patterns))
    return ". ".join(parts) or "early developmental screening follow-up"


def retrieve(query: str, k: int | None = None, min_similarity: float | None = None) -> list[Chunk]:
    """Returns [] for an empty / missing corpus — callers must cope with that."""
    from app.llm.factory import get_provider

    k = k or config.rag_top_k()
    threshold = config.rag_min_similarity() if min_similarity is None else min_similarity

    if store.corpus_size() == 0:
        return []
    vector = get_provider().embed([query], "query")[0]
    res = store.get_collection().query(query_embeddings=[vector], n_results=k)

    chunks = []
    for cid, text, meta, dist in zip(res["ids"][0], res["documents"][0], res["metadatas"][0], res["distances"][0]):
        similarity = 1.0 - float(dist)
        if similarity < threshold:
            continue  # drop weak matches instead of padding the prompt with noise
        chunks.append(Chunk(
            id=cid, text=text, score=round(similarity, 4), source=meta["source"], publisher=meta["publisher"],
            url=meta["url"], version=meta["version"], doc_type=meta["docType"],
            page=meta["page"] if meta["page"] != -1 else None, section=meta.get("section", ""),
        ))
    return chunks
