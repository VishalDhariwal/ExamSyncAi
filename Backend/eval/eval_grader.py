"""
EVAL 3 — GRADER EVALUATION
Uses: eval/data/golden_grading.json  (8 hand-crafted test cases)
Output: eval/data/grader_eval_results.json  — machine results
        eval/data/grader_review_for_human.md — human-readable review sheet

The grader is invoked directly via grader_node().
We record: question, student_answer, grader_score, grader_justification,
           human_benchmark_score, and acceptable_score_range.

YOU (the user) then open grader_review_for_human.md and manually check
whether the grader's scores and justifications are reasonable.

Run from Backend/ directory:
    python -m eval.eval_grader
"""

import json
import sys
import time
from pathlib import Path
from typing import Dict, Any, List

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from src.nodes.grader import grader_node

EVAL_DIR = Path(__file__).resolve().parent
DATA_PATH  = EVAL_DIR / "data" / "golden_grading.json"
JSON_OUT   = EVAL_DIR / "data" / "grader_eval_results.json"
HUMAN_OUT  = EVAL_DIR / "data" / "grader_review_for_human.md"


def run_grader_on_case(case: dict) -> dict:
    """Calls grader_node with a single question + student answer."""
    question = {
        "id": 1,
        "question": case["question"],
        "question_type": "subjective",
        "marks": case["max_marks"],
        "topic": case["topic"],
        "ideal_answer": case["ideal_answer"],
        "options": [],
        "expected_keywords": case.get("expected_keywords", []),
    }
    answer = {
        "question_id": 1,
        "answer_text": case["student_answer"],
    }
    mock_state = {
        "student_id": "eval_grader_test",
        "subject": "DBMS",
        "exam_questions": [question],
        "student_answers": [answer],
        "messages": [],
        "image_bytes": None,
        "raw_transcription": None,
        "current_rubric": None,
        "grades": [],
        "critic_notes": None,
        "diagnostic_report": None,
        "loop_count": 0,
        "selected_pyqs": [],
        "selected_topics": [],
        "exam_config": None,
    }
    result = grader_node(mock_state)
    grade = result.get("grades", [{}])[0]
    return grade


def evaluate_grader() -> Dict[str, Any]:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Golden grading dataset not found: {DATA_PATH}")

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        cases: List[dict] = json.load(f)

    print(f"\n{'='*60}")
    print(f"  🎓 GRADER EVALUATION  |  {len(cases)} test cases")
    print(f"{'='*60}")

    records = []
    within_range = 0
    exact_match = 0

    for case in cases:
        cid = case["id"]
        category = case.get("category", "")
        human_score = case["human_benchmark_score"]
        acceptable = case.get("acceptable_score_range", [human_score, human_score])
        max_marks = case["max_marks"]

        print(f"\n  ▶ [{cid}] {category}  (topic: {case['topic']}, max: {max_marks}m)")
        print(f"     Answer: \"{case['student_answer'][:80]}...\"" if len(case['student_answer']) > 80 else f"     Answer: \"{case['student_answer']}\"")

        try:
            grade = run_grader_on_case(case)
            grader_score = grade.get("score", -1)
            grader_just  = grade.get("justification", "")
        except Exception as e:
            print(f"     ❌ Grader crashed: {e}")
            records.append({
                "id": cid, "category": category,
                "error": str(e), "status": "ERROR",
            })
            continue

        # Score agreement checks
        is_exact      = grader_score == human_score
        is_in_range   = acceptable[0] <= grader_score <= acceptable[1]
        if is_exact:   exact_match += 1
        if is_in_range: within_range += 1

        range_icon = "✅" if is_in_range else "❌"
        exact_icon = "🎯" if is_exact else "  "
        print(f"     {range_icon}{exact_icon} Grader: {grader_score}/{max_marks}  |  Human: {human_score}/{max_marks}  |  Range: {acceptable}")
        print(f"        Justification: \"{grader_just[:120]}\"")

        records.append({
            "id": cid,
            "category": category,
            "topic": case["topic"],
            "question": case["question"],
            "max_marks": max_marks,
            "student_answer": case["student_answer"],
            "ideal_answer": case["ideal_answer"],
            "expected_keywords": case.get("expected_keywords", []),
            "human_benchmark_score": human_score,
            "acceptable_score_range": acceptable,
            "human_rationale": case.get("human_rationale", ""),
            "grader_score": grader_score,
            "grader_justification": grader_just,
            "is_exact_match": is_exact,
            "is_within_acceptable_range": is_in_range,
        })
        time.sleep(1.0)

    n = len(cases)
    exact_acc = exact_match / n if n else 0
    range_acc = within_range / n if n else 0
    status = "PASS" if range_acc >= 0.75 else "FAIL"

    summary = {
        "total_cases": n,
        "exact_score_match": exact_match,
        "within_acceptable_range": within_range,
        "exact_accuracy": round(exact_acc, 4),
        "range_accuracy": round(range_acc, 4),
        "status": status,
        "records": records,
    }

    print(f"\n{'─'*60}")
    print(f"  📊 GRADER RESULTS")
    print(f"  Exact Score Match:     {exact_match}/{n} ({exact_acc*100:.0f}%)")
    print(f"  Within Acceptable Range: {within_range}/{n} ({range_acc*100:.0f}%)")
    print(f"  Status: {status} {'✅' if status=='PASS' else '❌'}")
    print(f"{'='*60}\n")

    # ── Save machine-readable JSON ─────────────────────────────────────────
    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"  💾 JSON results → {JSON_OUT}")

    # ── Write human review markdown ────────────────────────────────────────
    _write_human_review(records, summary)
    print(f"  📄 Human review sheet → {HUMAN_OUT}\n")

    return summary


def _write_human_review(records: List[dict], summary: dict) -> None:
    """Writes a human-readable markdown review sheet for manual inspection."""
    lines = [
        "# 🎓 Grader Evaluation — Human Review Sheet",
        "",
        "> **Instructions for Reviewer:**",
        "> Go through each case below. Check whether the **Grader Score** and **Justification** are reasonable.",
        "> Mark each case as ✅ (agree) or ❌ (disagree) in the **Your Verdict** column.",
        "> Note any patterns of over-grading or under-grading at the bottom.",
        "",
        f"**Total Cases:** {summary['total_cases']}  ",
        f"**Exact Matches:** {summary['exact_score_match']}/{summary['total_cases']}  ",
        f"**Within Acceptable Range:** {summary['within_acceptable_range']}/{summary['total_cases']}  ",
        f"**Automated Status:** {summary['status']}",
        "",
        "---",
        "",
    ]

    for i, r in enumerate(records, 1):
        if "error" in r:
            lines += [
                f"## Case {i}: `{r['id']}` — {r.get('category', 'UNKNOWN')}",
                f"> ❌ **ERROR:** {r['error']}",
                "",
                "---",
                "",
            ]
            continue

        # Score agreement indicator
        if r["is_exact_match"]:
            agreement = "🎯 Exact Match"
        elif r["is_within_acceptable_range"]:
            agreement = "✅ Within Range"
        else:
            agreement = "❌ Out of Range"

        lines += [
            f"## Case {i}: `{r['id']}` — {r['category']}",
            "",
            f"**Topic:** {r['topic']}  ",
            f"**Max Marks:** {r['max_marks']}",
            "",
            f"### Question",
            f"> {r['question']}",
            "",
            f"### Ideal Answer",
            f"> {r['ideal_answer']}",
            "",
            f"### Student Answer",
            f"> {r['student_answer']}",
            "",
            f"### Expected Keywords",
            f"> {', '.join(r.get('expected_keywords', []))}",
            "",
            "### Scoring",
            "",
            f"| | Score | Rationale |",
            f"|---|---|---|",
            f"| **Human Benchmark** | {r['human_benchmark_score']}/{r['max_marks']} | {r['human_rationale']} |",
            f"| **Grader Output** | {r['grader_score']}/{r['max_marks']} | {r['grader_justification']} |",
            f"| **Acceptable Range** | {r['acceptable_score_range'][0]}–{r['acceptable_score_range'][1]}/{r['max_marks']} | |",
            f"| **Agreement** | {agreement} | |",
            "",
            "### Your Verdict",
            "",
            "- [ ] ✅ Agree — Grader score and justification are reasonable",
            "- [ ] ❌ Disagree — Grader is wrong because: _______________",
            "",
            "---",
            "",
        ]

    lines += [
        "## 📝 Overall Reviewer Notes",
        "",
        "_Write your overall observations here:_",
        "",
        "- Pattern observed: _______________",
        "- Grader tends to over-grade: [ ] Yes [ ] No",
        "- Grader tends to under-grade: [ ] Yes [ ] No",
        "- Security cases (prompt injection) handled correctly: [ ] Yes [ ] No",
        "- Recommended threshold adjustment: _______________",
        "",
    ]

    with open(HUMAN_OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    evaluate_grader()
