from typing import List, Optional, Tuple, Dict, Any
from pathlib import Path
from src.database import SessionLocal, DocumentChunk
from src.embeddings import embeddings


from sqlalchemy import or_

def retrieve_chunks(
    subject: str,
    query: str,
    user_id: Optional[Any] = None,
    doc_type: Optional[str] = None,
    k: int = 10,
) -> List[Tuple[DocumentChunk, float]]:
    """
    Retrieves chunks directly from PostgreSQL using pgvector cosine distance.
    Filtered strictly by subject, optional user_id (user docs + public docs), and doc_type.
    """
    db = SessionLocal()
    try:
        query_emb = embeddings.embed_query(query)
        distance_expr = DocumentChunk.embedding.cosine_distance(query_emb).label("distance")

        q = db.query(DocumentChunk, distance_expr).filter(
            DocumentChunk.subject == subject.strip().upper()
        )

        # Tenant filtering: user's own documents or global system documents
        valid_uuid = None
        if user_id:
            try:
                import uuid
                valid_uuid = uuid.UUID(str(user_id))
            except (ValueError, TypeError):
                valid_uuid = None

        if valid_uuid is not None:
            q = q.filter(
                or_(
                    DocumentChunk.user_id == valid_uuid,
                    DocumentChunk.user_id.is_(None),
                )
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


def rerank_chunks(scored_docs: List[Tuple[DocumentChunk, float]], top_n: int = 8) -> List[str]:
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
    user_id: Optional[Any] = None,
    selected_pyqs: Optional[List[str]] = None,
    selected_topics: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    1. If selected_topics is provided, retrieves embeddings for those topics ONLY,
       guaranteeing questions are derived strictly from the chosen weak topics.
    2. Otherwise, fetches ALL notes for the given subject via RAG vector search + direct document chunks.
    3. Fetches selected multiple PYQ files for this subject (or all available PYQ papers if none specified).
    """
    subject_clean = subject.strip().upper()
    db = SessionLocal()
    try:
        valid_uuid = None
        if user_id:
            try:
                import uuid
                valid_uuid = uuid.UUID(str(user_id))
            except Exception:
                valid_uuid = None

        # ---------------------------------------------------------
        # 1. FETCH NOTES CONTEXT (TARGETED TOPICS VS FULL SYLLABUS)
        # ---------------------------------------------------------
        if selected_topics and len(selected_topics) > 0:
            # Clean list of target topics
            target_list = [t.strip() for t in selected_topics if t.strip()]
            topic_chunks_scored = []
            for topic in target_list:
                # Retrieve vector chunks closest to this specific weak topic
                t_scored = retrieve_chunks(
                    subject=subject_clean,
                    query=f"Detailed concepts, definitions, explanations, formulas, algorithms, and problems on {topic} in {subject_clean}",
                    user_id=user_id,
                    doc_type="NOTES",
                    k=12,
                )
                topic_chunks_scored.extend(t_scored)

            # Rerank & deduplicate topic-specific chunks
            topic_reranked = rerank_chunks(
                topic_chunks_scored,
                top_n=min(25, max(12, len(target_list) * 5)),
            )

            # Also search for direct text matches in notes chunks
            topic_filters = [DocumentChunk.content.ilike(f"%{t}%") for t in target_list]
            direct_topic_chunks = []
            if topic_filters:
                direct_topic_q = db.query(DocumentChunk).filter(
                    DocumentChunk.subject == subject_clean,
                    DocumentChunk.doc_type == "NOTES",
                    or_(*topic_filters),
                )
                if valid_uuid:
                    direct_topic_q = direct_topic_q.filter(
                        or_(DocumentChunk.user_id == valid_uuid, DocumentChunk.user_id.is_(None))
                    )
                direct_topic_chunks = direct_topic_q.limit(10).all()

            combined_notes = list(topic_reranked)
            seen_previews = {t[:100].lower() for t in combined_notes}
            for chunk in direct_topic_chunks:
                p = chunk.content.strip()[:100].lower()
                if p not in seen_previews:
                    seen_previews.add(p)
                    src_label = f"[{chunk.source}] " if chunk.source else ""
                    combined_notes.append(f"{src_label}{chunk.content.strip()}")

            if combined_notes:
                notes_context = (
                    f"=== TARGETED REVISION TOPICS: {', '.join(target_list)} ===\n\n"
                    + "\n\n---\n\n".join(combined_notes)
                )
            else:
                notes_context = (
                    f"=== TARGETED REVISION TOPICS: {', '.join(target_list)} ===\n"
                    f"Core curriculum materials and technical concepts for {subject_clean} focusing on {', '.join(target_list)}."
                )

            # Retrieve past questions specifically for these selected topics
            pyq_topic_scored = []
            for topic in target_list:
                p_scored = retrieve_chunks(
                    subject=subject_clean,
                    query=f"Past exam question, problem, numerical, or exercise on {topic} in {subject_clean}",
                    user_id=user_id,
                    doc_type="PYQ",
                    k=4,
                )
                pyq_topic_scored.extend(p_scored)

            pyq_reranked = rerank_chunks(pyq_topic_scored, top_n=6)
            if pyq_reranked:
                pyq_context = (
                    f"=== PAST EXAM QUESTIONS FOR TARGETED TOPICS ({', '.join(target_list)}) ===\n\n"
                    + "\n\n---\n\n".join(pyq_reranked)
                )
            else:
                pyq_context = ""
            pyq_papers = {}

        else:
            # FULL SYLLABUS RAG
            # MULTI-QUERY RAG: Fire diverse queries for broader topic coverage
            diverse_queries = [
                f"Core concepts, definitions, and fundamentals of {subject_clean}",
                f"Algorithms, formulas, mathematical methods, and computations in {subject_clean}",
                f"Architecture, design patterns, system models, and structures in {subject_clean}",
                f"Practical applications, examples, case studies, and problem solving in {subject_clean}",
                f"Comparison, trade-offs, analysis, and evaluation topics in {subject_clean}",
            ]
            all_notes_scored = []
            for q in diverse_queries:
                q_results = retrieve_chunks(
                    subject=subject_clean,
                    query=q,
                    user_id=user_id,
                    doc_type="NOTES",
                    k=20,
                )
                all_notes_scored.extend(q_results)
            notes_reranked = rerank_chunks(all_notes_scored, top_n=15)

            # Direct chunks from NOTES documents for full coverage
            direct_notes_q = db.query(DocumentChunk).filter(
                DocumentChunk.subject == subject_clean,
                DocumentChunk.doc_type == "NOTES",
            )
            if valid_uuid:
                direct_notes_q = direct_notes_q.filter(
                    or_(DocumentChunk.user_id == valid_uuid, DocumentChunk.user_id.is_(None))
                )
            all_notes_records = direct_notes_q.limit(25).all()

            combined_notes = list(notes_reranked)
            seen_previews = {t[:100].lower() for t in combined_notes}
            for chunk in all_notes_records:
                p = chunk.content.strip()[:100].lower()
                if p not in seen_previews:
                    seen_previews.add(p)
                    src_label = f"[{chunk.source}] " if chunk.source else ""
                    combined_notes.append(f"{src_label}{chunk.content.strip()}")

            notes_context = "\n\n---\n\n".join(combined_notes)

            # ---------------------------------------------------------
            # 2. FETCH MULTIPLE PYQ PAPERS FOR THIS SUBJECT
            # ---------------------------------------------------------
            pyq_q = db.query(DocumentChunk).filter(
                DocumentChunk.subject == subject_clean,
                DocumentChunk.doc_type == "PYQ",
            )
            if valid_uuid:
                pyq_q = pyq_q.filter(
                    or_(DocumentChunk.user_id == valid_uuid, DocumentChunk.user_id.is_(None))
                )

            # Filter by selected PYQs if specified by user
            if selected_pyqs and len(selected_pyqs) > 0:
                target_ids = []
                target_sources = []
                for item in selected_pyqs:
                    item_str = str(item).strip()
                    try:
                        import uuid
                        target_ids.append(uuid.UUID(item_str))
                    except Exception:
                        target_sources.append(item_str)

                conditions = []
                if target_ids:
                    conditions.append(DocumentChunk.document_id.in_(target_ids))
                if target_sources:
                    conditions.append(DocumentChunk.source.in_(target_sources))
                if conditions:
                    pyq_q = pyq_q.filter(or_(*conditions))

            pyq_records = pyq_q.all()

            # Group PYQ chunks by paper / source
            pyq_papers = {}
            for c in pyq_records:
                src = c.source or "Past Paper"
                if src not in pyq_papers:
                    pyq_papers[src] = []
                pyq_papers[src].append(c.content.strip())

            pyq_sections = []
            for src, contents in pyq_papers.items():
                combined_paper_text = "\n\n".join(contents[:8])
                pyq_sections.append(f"=== PAST EXAM PAPER: {src} ===\n{combined_paper_text}")

            pyq_context = "\n\n=========================================\n\n".join(pyq_sections)

        # Fallback: if notes_context is still empty, search across all documents for this subject
        if not notes_context.strip():
            general_scored = retrieve_chunks(
                subject=subject_clean,
                query=f"Overview, key ideas, principles, and concepts of {subject_clean}",
                user_id=user_id,
                k=12,
            )
            general_reranked = rerank_chunks(general_scored, top_n=8)
            notes_context = "\n\n---\n\n".join(general_reranked)

        return {
            "notes_context": notes_context,
            "pyq_context": pyq_context,
            "pyq_sources": list(pyq_papers.keys()),
        }
    finally:
        db.close()
