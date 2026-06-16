import math
import json
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models import Chunk, Document

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """
    Computes cosine similarity between two float vectors.
    """
    dot_product = sum(a * b for a, b in zip(v1, v2))
    norm_a = sum(a * a for a in v1)
    norm_b = sum(b * b for b in v2)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (math.sqrt(norm_a) * math.sqrt(norm_b))

def search_similar_chunks(
    db: Session,
    user_id: int,
    query_vector: List[float],
    limit: int = 5,
    document_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Searches user's indexed chunks in SQLite and returns top matches sorted by similarity.
    """
    # 1. Fetch chunks belonging to the user
    query = db.query(Chunk).filter(Chunk.user_id == user_id)
    if document_id:
        query = query.filter(Chunk.document_id == document_id)
        
    chunks = query.all()
    if not chunks:
        return []

    # Map document IDs to names to construct source metadata
    doc_ids = list(set(c.document_id for c in chunks))
    documents = db.query(Document).filter(Document.id.in_(doc_ids)).all()
    doc_map = {doc.id: doc.name for doc in documents}

    # 2. Score similarity
    scored_results = []
    for chunk in chunks:
        try:
            # Deserialize the stored embedding vector JSON string
            chunk_vector = json.loads(chunk.embedding)
            score = cosine_similarity(query_vector, chunk_vector)
            
            scored_results.append({
                "chunk_id": chunk.id,
                "content": chunk.content,
                "page_number": chunk.page_number,
                "document_id": chunk.document_id,
                "document_name": doc_map.get(chunk.document_id, "Unknown Document"),
                "score": score
            })
        except Exception as error:
            print(f"Failed to score chunk {chunk.id}: {error}")
            continue

    # 3. Sort by score descending and return top limit
    scored_results.sort(key=lambda x: x["score"], reverse=True)
    return scored_results[:limit]
