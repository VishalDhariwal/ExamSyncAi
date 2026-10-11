from typing import List, Optional, Tuple, Dict, Any
from pathlib import Path
from langchain_huggingface import HuggingFaceEmbeddings

from src.database import SessionLocal, DocumentChunk


embeddings = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2",
    model_kwargs={"local_files_only": True},
)


from sqlalchemy import or_

def retrieve_chunks(
    subject: str,
    query: str,
    semester: Optional[int] = None,
    user_id: Optional[Any] = None,
    doc_type: Optional[str] = None,
    k: int = 8,
) -> List[Tuple[DocumentChunk, float]]:
    """
    Retrieves chunks directly from PostgreSQL using pgvector cosine distance.
    Filtered by subject, optional user_id (user docs + public docs), optional semester, and doc_type.
    """
    db = SessionLocal()
    try:
        query_emb = embeddings.embed_query(query)
        distance_expr = DocumentChunk.embedding.cosine_distance(query_emb).label("distance")

        q = db.query(DocumentChunk, distance_expr).filter(
            DocumentChunk.subject == subject.strip().upper()
        )

        # Tenant filtering: user's own documents or global system documents
        if user_id:
            q = q.filter(
                or_(
                    DocumentChunk.user_id == user_id,
                    DocumentChunk.user_id.is_(None),
                )
            )

        if semester is not None:
            q = q.filter(DocumentChunk.semester == semester)

        if doc_type:
            q = q.filter(DocumentChunk.doc_type == doc_type.upper())

        results = q.order_by(distance_expr.asc()).limit(k).all()
        return results
    except Exception as e:
        print(f"PostgreSQL pgvector search notice: {e}")
        return []
    finally:
        db.close()


def rerank_chunks(scored_docs: List[Tuple[DocumentChunk, float]], top_n: int = 5) -> List[str]:
    """
    Reranks chunks by vector cosine distance (smaller distance = higher similarity)
    and deduplicates similar snippets.
    """
    if not scored_docs:
        return []

    # Sort ascending by distance (cosine distance 0 = identical)
    sorted_docs = sorted(scored_docs, key=lambda x: x[1])

    seen_snippets = set()
    selected_texts = []

    for doc, dist in sorted_docs:
        content = doc.content.strip()
        preview = content[:100].lower()

        if preview in seen_snippets:
            continue
        seen_snippets.add(preview)
        selected_texts.append(content)

        if len(selected_texts) >= top_n:
            break

    return selected_texts


def get_exam_context(
    subject: str,
    semester: Optional[int] = None,
    user_id: Optional[Any] = None,
) -> Dict[str, str]:
    """
    Retrieves and reranks syllabus notes and PYQ patterns from PostgreSQL.
    Supports user-uploaded materials for any class or subject.
    Falls back to disk only if an uningested semester folder exists.
    """
    subject_clean = subject.strip().upper()

    # 1. Retrieve & Rerank Notes from PostgreSQL
    notes_query = f"Core concepts, definitions, architecture, and important syllabus topics for {subject_clean}"
    notes_scored = retrieve_chunks(
        subject=subject_clean,
        query=notes_query,
        semester=semester,
        user_id=user_id,
        doc_type="NOTES",
        k=8,
    )
    notes_reranked = rerank_chunks(notes_scored, top_n=5)
    notes_context = "\n\n---\n\n".join(notes_reranked)

    # 2. Retrieve & Rerank PYQs from PostgreSQL
    pyq_query = f"Previous year exam questions, long answer questions, 2-mark definitions, marks distribution for {subject_clean}"
    pyq_scored = retrieve_chunks(
        subject=subject_clean,
        query=pyq_query,
        semester=semester,
        user_id=user_id,
        doc_type="PYQ",
        k=10,
    )
    pyq_reranked = rerank_chunks(pyq_scored, top_n=6)
    pyq_context = "\n\n---\n\n".join(pyq_reranked)

    # 3. If notes_context is still empty, search across all documents for this subject regardless of doc_type
    if not notes_context.strip():
        general_scored = retrieve_chunks(
            subject=subject_clean,
            query=f"Overview, key ideas, principles, and concepts of {subject_clean}",
            semester=semester,
            user_id=user_id,
            k=8,
        )
        general_reranked = rerank_chunks(general_scored, top_n=5)
        notes_context = "\n\n---\n\n".join(general_reranked)

    return {
        "notes_context": notes_context,
        "pyq_context": pyq_context,
    }
