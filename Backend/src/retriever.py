from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
import os

BASE_DIR = Path(__file__).resolve().parent.parent
CHROMA_DIR = BASE_DIR / "chroma_db"
DATA_DIR = BASE_DIR / "Data"

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")


def get_vectorstore(semester: int) -> Chroma:
    """Connect to the persistent ChromaDB directory for a given semester."""
    persist_dir = CHROMA_DIR / f"sem{semester}"
    return Chroma(
        persist_directory=str(persist_dir),
        embedding_function=embeddings,
    )


def retrieve_chunks(
    semester: int,
    subject: str,
    query: str,
    doc_type: Optional[str] = None,
    k: int = 8,
) -> List[Tuple[Any, float]]:
    """
    Retrieves chunks from ChromaDB with distance scores, filtered by subject and optionally doc_type.
    """
    vectorstore = get_vectorstore(semester)

    filter_dict = {}
    if subject:
        filter_dict["subject"] = subject.upper()
    if doc_type:
        filter_dict["type"] = doc_type

    if len(filter_dict) == 1:
        search_filter = filter_dict
    elif len(filter_dict) > 1:
        search_filter = {"$and": [{key: val} for key, val in filter_dict.items()]}
    else:
        search_filter = None

    try:
        if search_filter:
            results = vectorstore.similarity_search_with_score(
                query, k=k, filter=search_filter
            )
        else:
            results = vectorstore.similarity_search_with_score(query, k=k)
    except Exception as e:
        print(f"Chroma filtered search notice: {e}, running fallback query...")
        try:
            results = vectorstore.similarity_search_with_score(query, k=k)
        except Exception:
            results = []

    return results


def rerank_chunks(scored_docs: List[Tuple[Any, float]], top_n: int = 5) -> List[str]:
    """
    Reranks chunks by distance (lower distance = higher similarity)
    and deduplicates repetitive content snippets.
    """
    if not scored_docs:
        return []

    # Sort ascending by distance score
    sorted_docs = sorted(scored_docs, key=lambda x: x[1])

    seen_snippets = set()
    selected_texts = []

    for doc, dist in sorted_docs:
        content = doc.page_content.strip()
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
    End-to-end retrieval and reranking for both NOTES and PYQs.
    Falls back to direct files if Chroma vectorstore is empty for this semester.
    """
    subject_clean = subject.upper()

    # 1. Retrieve & Rerank Notes
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

    # 2. Retrieve & Rerank PYQs
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

    # Fallback to disk if Chroma returned nothing (e.g. uningested semester)
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


def get_retriever(semester: int, k: int = 4):
    """Backwards-compatible retriever function."""
    vectorstore = get_vectorstore(semester)
    return vectorstore.as_retriever(search_kwargs={"k": k})
