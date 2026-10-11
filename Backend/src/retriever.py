from typing import List, Optional, Tuple, Dict, Any
from pathlib import Path
from langchain_huggingface import HuggingFaceEmbeddings

from src.database import SessionLocal, DocumentChunk

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "Data"

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")


def retrieve_chunks(
    semester: int,
    subject: str,
    query: str,
    doc_type: Optional[str] = None,
    k: int = 8,
) -> List[Tuple[DocumentChunk, float]]:
    """
    Retrieves chunks directly from PostgreSQL using pgvector cosine distance.
    Filtered by semester, subject, and optionally doc_type ('NOTES' or 'PYQ').
    """
    db = SessionLocal()
    try:
        query_emb = embeddings.embed_query(query)
        distance_expr = DocumentChunk.embedding.cosine_distance(query_emb).label("distance")

        q = db.query(DocumentChunk, distance_expr).filter(
            DocumentChunk.semester == semester,
            DocumentChunk.subject == subject.upper(),
        )

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


def get_exam_context(semester: int, subject: str) -> Dict[str, str]:
    """
    Retrieves and reranks syllabus notes and PYQ patterns from PostgreSQL.
    Falls back to disk if uningested semester.
    """
    subject_clean = subject.upper()

    # 1. Retrieve & Rerank Notes from PostgreSQL
    notes_query = f"Core concepts, definitions, architecture, and important syllabus topics for {subject_clean}"
    notes_scored = retrieve_chunks(
        semester=semester,
        subject=subject_clean,
        query=notes_query,
        doc_type="NOTES",
        k=8,
    )
    notes_reranked = rerank_chunks(notes_scored, top_n=5)
    notes_context = "\n\n---\n\n".join(notes_reranked)

    # 2. Retrieve & Rerank PYQs from PostgreSQL
    pyq_query = f"Previous year exam questions, long answer questions, 2-mark definitions, marks distribution for {subject_clean}"
    pyq_scored = retrieve_chunks(
        semester=semester,
        subject=subject_clean,
        query=pyq_query,
        doc_type="PYQ",
        k=10,
    )
    pyq_reranked = rerank_chunks(pyq_scored, top_n=6)
    pyq_context = "\n\n---\n\n".join(pyq_reranked)

    # Fallback to disk if PostgreSQL is empty for this semester
    if not notes_context.strip():
        notes_file = DATA_DIR / f"sem{semester}" / subject_clean / "NOTES" / "notes.txt"
        if notes_file.exists():
            with open(notes_file, "r", encoding="utf-8") as f:
                notes_context = f.read()

    if not pyq_context.strip():
        pyq_dir = DATA_DIR / f"sem{semester}" / subject_clean / "PYQ"
        if pyq_dir.exists():
            pyq_files = sorted(pyq_dir.glob("*.txt"))
            pyq_parts = []
            for pf in pyq_files:
                with open(pf, "r", encoding="utf-8") as f:
                    pyq_parts.append(f.read())
            pyq_context = "\n\n".join(pyq_parts)

    return {
        "notes_context": notes_context,
        "pyq_context": pyq_context,
    }
