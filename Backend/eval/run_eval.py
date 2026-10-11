"""
MASTER EVALUATION RUNNER
Runs all three component evaluations in sequence:
  1. Retriever  — Recall@K + Keyword Recall
  2. Generator  — Structure + Diversity + Grounding + LLM-Judge
  3. Grader     — Score accuracy vs human benchmark + writes human review sheet

Run from Backend/ directory:
    python -m eval.run_eval

Or individual components:
    python -m eval.eval_retriever
    python -m eval.eval_generator
    python -m eval.eval_grader
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

EVAL_DIR   = Path(__file__).resolve().parent
REPORT_OUT = EVAL_DIR / "latest_eval_report.json"


def main():
    results = {}
    timestamp = datetime.now(timezone.utc).isoformat()

    print("\n" + "█"*60)
    print("  StudySync AI — Full Component Evaluation Suite")
    print(f"  {timestamp}")
    print("█"*60)

    # ── 1. RETRIEVER ──────────────────────────────────────────────────────
    try:
        from eval.eval_retriever import evaluate_retriever
        results["retriever"] = evaluate_retriever(k=10)
    except Exception as e:
        print(f"\n❌ Retriever eval failed: {e}")
        results["retriever"] = {"status": "ERROR", "error": str(e)}

    # ── 2. GENERATOR ──────────────────────────────────────────────────────
    try:
        from eval.eval_generator import evaluate_generator
        results["generator"] = evaluate_generator()
    except Exception as e:
        print(f"\n❌ Generator eval failed: {e}")
        results["generator"] = {"status": "ERROR", "error": str(e)}

    # ── 3. GRADER ─────────────────────────────────────────────────────────
    try:
        from eval.eval_grader import evaluate_grader
        results["grader"] = evaluate_grader()
    except Exception as e:
        print(f"\n❌ Grader eval failed: {e}")
        results["grader"] = {"status": "ERROR", "error": str(e)}

    # ── Final Report ─────────────────────────────────────────────────────
    def status_icon(s):
        if not isinstance(s, str): return "⚠️"
        return "✅" if "PASS" in s else ("⚠️" if "PARTIAL" in s else "❌")

    r_status = results.get("retriever", {}).get("status", "ERROR")
    g_status = results.get("generator", {}).get("status", "ERROR")
    gr_status = results.get("grader", {}).get("status", "ERROR")

    print("\n" + "█"*60)
    print("  📋 FINAL EVALUATION SUMMARY")
    print("█"*60)
    print(f"  {status_icon(r_status)}  Retriever:  {r_status}")
    print(f"       Recall@10: {results['retriever'].get('recall_at_k', 'N/A')}")
    print(f"       Avg Keyword Recall: {results['retriever'].get('avg_keyword_recall', 'N/A')}")
    print()
    print(f"  {status_icon(g_status)}  Generator:  {g_status}")
    print(f"       Cases passed: {results['generator'].get('passed', 'N/A')}/{results['generator'].get('total_cases', 'N/A')}")
    print()
    print(f"  {status_icon(gr_status)}  Grader:     {gr_status}")
    print(f"       Range accuracy: {results['grader'].get('range_accuracy', 'N/A')}")
    print(f"       Exact accuracy: {results['grader'].get('exact_accuracy', 'N/A')}")
    print()
    print(f"  📄 Human review sheet: eval/data/grader_review_for_human.md")
    print("█"*60 + "\n")

    full_report = {
        "timestamp": timestamp,
        "retriever": results.get("retriever"),
        "generator": results.get("generator"),
        "grader": results.get("grader"),
    }

    with open(REPORT_OUT, "w", encoding="utf-8") as f:
        json.dump(full_report, f, indent=2)
    print(f"  💾 Full report saved → {REPORT_OUT}\n")


if __name__ == "__main__":
    main()
