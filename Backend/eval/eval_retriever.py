"""
EVAL 1 — RETRIEVER EVALUATION
Metric: Recall@K + Keyword Recall
Dataset: eval/data/golden_retrieval.json

Run from Backend/ directory:
    python -m eval.eval_retriever
"""

import json
import sys
import time
from pathlib import Path
from typing import Dict, Any, List

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from src.retriever import retrieve_chunks

EVAL_DIR = Path(__file__).resolve().parent
DATA_PATH = EVAL_DIR / "data" / "golden_retrieval.json"
RESULTS_PATH = EVAL_DIR / "data" / "retriever_eval_results.json"


def evaluate_retriever(k: int = 10) -> Dict[str, Any]:
    """
    Evaluates the PostgreSQL pgvector retriever against golden_retrieval.json.

    Metrics:
    - Recall@K (Hit Rate):   Did any retrieved chunk contain at least one expected keyword?
    - Keyword Recall:        Fraction of expected keywords found across all K retrieved chunks.
    - Avg Latency (ms):      Mean retrieval latency per query.
    """
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Golden dataset not found: {DATA_PATH}")

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        cases: List[dict] = json.load(f)

    results = []
    total_latency_ms = 0.0
    hits = 0
    total_kw_recall = 0.0

    print(f"\n{'='*60}")
    print(f"  📡 RETRIEVER EVALUATION  |  K={k}  |  {len(cases)} queries")
    print(f"{'='*60}")

    for case in cases:
        qid = case["id"]
        subject = case["subject"]
        doc_type = case.get("doc_type")
        query_text = case["query"]
        expected_keywords = [kw.lower() for kw in case.get("expected_keywords", [])]

        # ── Retrieval + Timing ──────────────────────────────────────────────
        t0 = time.perf_counter()
        retrieved = retrieve_chunks(
            subject=subject,
            query=query_text,
            user_id=None,          # evaluate against public/system corpus
            doc_type=doc_type,
            k=k,
        )
        latency_ms = (time.perf_counter() - t0) * 1000
        total_latency_ms += latency_ms

        # Flatten all retrieved text for keyword scanning
        combined_text = " ".join(doc.content.lower() for doc, _ in retrieved)
        retrieved_sources = [doc.source.lower() for doc, _ in retrieved]

        # ── Recall@K (Hit) ─────────────────────────────────────────────────
        # A "hit" = at least one expected keyword appears in any retrieved chunk
        matched_kws = [kw for kw in expected_keywords if kw in combined_text]
        is_hit = len(matched_kws) > 0
        if is_hit:
            hits += 1

        # ── Keyword Recall ────────────────────────────────────────────────
        kw_recall = len(matched_kws) / len(expected_keywords) if expected_keywords else 1.0
        total_kw_recall += kw_recall

        hit_icon = "✅" if is_hit else "❌"
        print(
            f"  {hit_icon} [{qid}] {subject}/{doc_type or 'ANY'}  "
            f"kw_recall={kw_recall*100:.0f}%  "
            f"chunks={len(retrieved)}  "
            f"latency={latency_ms:.0f}ms"
        )
        if not is_hit:
            print(f"       ↳ Missing keywords: {[kw for kw in expected_keywords if kw not in combined_text]}")

        results.append({
            "id": qid,
            "subject": subject,
            "doc_type": doc_type,
            "query": query_text,
            "hit": is_hit,
            "keyword_recall": round(kw_recall, 4),
            "matched_keywords": matched_kws,
            "missing_keywords": [kw for kw in expected_keywords if kw not in combined_text],
            "chunks_retrieved": len(retrieved),
            "top_sources": retrieved_sources[:3],
            "latency_ms": round(latency_ms, 2),
        })

    # ── Aggregate Summary ─────────────────────────────────────────────────
    n = len(cases)
    recall_at_k = hits / n if n else 0.0
    avg_kw_recall = total_kw_recall / n if n else 0.0
    avg_latency = total_latency_ms / n if n else 0.0

    # Threshold: Recall@K >= 60% and Keyword Recall >= 55%
    # (lenient because user corpus may be small/empty for some subjects)
    status = "PASS" if recall_at_k >= 0.60 and avg_kw_recall >= 0.55 else "FAIL"

    summary = {
        "k": k,
        "total_queries": n,
        "recall_at_k": round(recall_at_k, 4),
        "avg_keyword_recall": round(avg_kw_recall, 4),
        "avg_latency_ms": round(avg_latency, 2),
        "status": status,
        "detailed_results": results,
    }

    print(f"\n{'─'*60}")
    print(f"  📊 RESULTS")
    print(f"  Recall@{k}:          {recall_at_k*100:.1f}%  (hits: {hits}/{n})")
    print(f"  Avg Keyword Recall: {avg_kw_recall*100:.1f}%")
    print(f"  Avg Latency:        {avg_latency:.1f} ms")
    print(f"  Status:             {status} {'✅' if status=='PASS' else '❌'}")
    print(f"{'='*60}\n")

    # Save results
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"  💾 Results saved → {RESULTS_PATH}\n")

    return summary


if __name__ == "__main__":
    evaluate_retriever(k=10)
