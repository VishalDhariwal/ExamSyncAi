"""
EVAL 2 — GENERATOR EVALUATION
Uses: eval/data/golden_generator.json
LLM Judge: Groq (same model as generator)

Metrics per test case:
  - Structure Validity:  exact question count + marks distribution
  - Topic Diversity:     fraction of unique topics out of total questions
  - Grounding Check:     no biographical/resume content in questions
  - LLM Quality Rating:  1-5 star academic quality from LLM-as-Judge

Run from Backend/ directory:
    python -m eval.eval_generator
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, Any, List
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(BACKEND_DIR / ".env")

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from src.nodes.generator import generator_node

EVAL_DIR = Path(__file__).resolve().parent
DATA_PATH = EVAL_DIR / "data" / "golden_generator.json"
RESULTS_PATH = EVAL_DIR / "data" / "generator_eval_results.json"

GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
judge_llm = ChatGroq(model=GROQ_MODEL, temperature=0.0, max_tokens=1024)


# ── Biographical / Resume contamination signals ────────────────────────────
RESUME_SIGNALS = [
    "resume", "cgpa", "gpa", "internship", "linkedin", "github.com",
    "work experience", "career", "certification", "portfolio",
    "candidate", "employee", "hired", "company", "personal profile",
]


def check_grounding(questions: List[dict]) -> Dict[str, Any]:
    """Scans all generated questions for biographical/resume contamination."""
    contaminated = []
    for q in questions:
        q_text = (q.get("question", "") + " " + q.get("topic", "")).lower()
        found = [sig for sig in RESUME_SIGNALS if sig in q_text]
        if found:
            contaminated.append({
                "question_id": q.get("id"),
                "question": q.get("question", "")[:120],
                "contamination_signals": found,
            })
    return {
        "contaminated_count": len(contaminated),
        "is_clean": len(contaminated) == 0,
        "contaminated_questions": contaminated,
    }


def evaluate_structure(questions: List[dict], config: dict) -> Dict[str, Any]:
    """Checks exact structure: count + marks distribution."""
    breakdown = config.get("breakdown", [])
    total_marks_expected = config.get("total_marks", 0)
    total_q_expected = sum(b["count"] for b in breakdown)

    total_q_actual = len(questions)
    total_marks_actual = sum(q.get("marks", 0) for q in questions)

    # Build expected distribution
    expected_dist: Dict[str, int] = {}
    for b in breakdown:
        key = f"{b['type']}_{b['marks']}m"
        expected_dist[key] = b["count"]

    # Build actual distribution
    actual_dist: Dict[str, int] = {}
    for q in questions:
        q_type = q.get("question_type", "subjective")
        m = q.get("marks", 0)
        key = f"{q_type}_{m}m"
        actual_dist[key] = actual_dist.get(key, 0) + 1

    dist_valid = all(
        actual_dist.get(f"{b['type']}_{b['marks']}m", 0) == b["count"]
        for b in breakdown
    )

    return {
        "total_q_expected": total_q_expected,
        "total_q_actual": total_q_actual,
        "total_marks_expected": total_marks_expected,
        "total_marks_actual": total_marks_actual,
        "marks_match": total_marks_actual == total_marks_expected,
        "count_match": total_q_actual == total_q_expected,
        "distribution_valid": dist_valid,
        "expected_dist": expected_dist,
        "actual_dist": actual_dist,
        "is_valid": total_marks_actual == total_marks_expected
                    and total_q_actual == total_q_expected
                    and dist_valid,
    }


def evaluate_topic_diversity(questions: List[dict], criteria: dict) -> Dict[str, Any]:
    """Checks unique topic fraction and min question length."""
    topics = [q.get("topic", "").strip().lower() for q in questions if q.get("topic")]
    unique = set(topics)
    diversity = len(unique) / len(questions) if questions else 0.0

    short_questions = [
        q for q in questions
        if len(q.get("question", "")) < criteria.get("min_question_length", 20)
    ]

    return {
        "total_questions": len(questions),
        "unique_topics": len(unique),
        "diversity_score": round(diversity, 4),
        "meets_min_diversity": diversity >= criteria.get("min_topic_diversity", 0.5),
        "short_question_count": len(short_questions),
        "topics_seen": sorted(unique),
    }


JUDGE_PROMPT = ChatPromptTemplate.from_template("""
You are an expert academic curriculum reviewer evaluating AI-generated exam questions.

Subject: {subject}
Exam Configuration: {config_summary}

Generated Questions (first 6 shown):
{sample_preview}

Please evaluate on these 4 axes:
1. academic_validity (bool): Are ALL questions genuinely academic/technical? Not biographical, not resume-based?
2. syllabus_relevance (bool): Are questions clearly about {subject} course material?
3. quality_rating (1-5): Overall academic quality. 5=excellent university standard, 1=generic/useless.
4. feedback (string): One concise sentence of critique or praise.

Deduct quality if:
- Questions ask about personal information, career history, internships, certifications of a person
- Questions are too generic (\"What is {subject}?\")
- Questions repeat the same concept multiple times

Return ONLY valid JSON:
{{
  "academic_validity": true,
  "syllabus_relevance": true,
  "quality_rating": 4,
  "feedback": "..."
}}
""")


def llm_judge(questions: List[dict], subject: str, config: dict) -> dict:
    """LLM-as-Judge: evaluates academic quality of generated questions."""
    sample = questions[:6]
    sample_preview = "\n".join(
        f"  Q{q.get('id')} [{q.get('question_type','?')} {q.get('marks','?')}m | {q.get('topic','?')}]: {q.get('question','')[:150]}"
        for q in sample
    )
    breakdown = config.get("breakdown", [])
    config_summary = f"{config.get('total_marks')} marks, " + ", ".join(
        f"{b['count']}×{b['marks']}m {b['type']}" for b in breakdown
    )

    parser = JsonOutputParser()
    chain = JUDGE_PROMPT | judge_llm | parser

    try:
        return chain.invoke({
            "subject": subject,
            "config_summary": config_summary,
            "sample_preview": sample_preview,
        })
    except Exception as e:
        return {
            "academic_validity": None,
            "syllabus_relevance": None,
            "quality_rating": 0,
            "feedback": f"Judge failed: {e}",
        }


def evaluate_generator() -> Dict[str, Any]:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Golden dataset not found: {DATA_PATH}")

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        cases: List[dict] = json.load(f)

    all_results = []
    overall_pass = 0

    print(f"\n{'='*60}")
    print(f"  📝 GENERATOR EVALUATION  |  {len(cases)} test cases")
    print(f"{'='*60}")

    for case in cases:
        cid = case["id"]
        subject = case["subject"]
        config = case["exam_config"]
        criteria = case.get("quality_criteria", {})
        selected_topics = case.get("selected_topics", [])
        desc = case.get("description", "")

        print(f"\n  ▶ [{cid}] {subject} — {desc}")

        # Build mock ExamState
        mock_state = {
            "student_id": "eval_test_user",
            "subject": subject,
            "exam_questions": [],
            "selected_pyqs": [],
            "selected_topics": selected_topics,
            "exam_config": config,
            "messages": [],
            "image_bytes": None,
            "raw_transcription": None,
            "student_answers": [],
            "current_rubric": None,
            "grades": [],
            "critic_notes": None,
            "diagnostic_report": None,
            "loop_count": 0,
        }

        try:
            gen_result = generator_node(mock_state)
            questions = gen_result.get("exam_questions", [])
        except Exception as e:
            print(f"     ❌ Generator crashed: {e}")
            all_results.append({"id": cid, "status": "ERROR", "error": str(e)})
            continue

        # Run checks
        structure = evaluate_structure(questions, config)
        diversity = evaluate_topic_diversity(questions, criteria)
        grounding = check_grounding(questions)
        judge = llm_judge(questions, subject, config)

        # Determine pass/fail
        case_pass = (
            structure["is_valid"]
            and grounding["is_clean"]
            and diversity["meets_min_diversity"]
            and (judge.get("academic_validity") is not False)
        )
        if case_pass:
            overall_pass += 1

        status = "PASS" if case_pass else "FAIL"
        icon = "✅" if case_pass else "❌"

        print(f"     {icon} Structure:    count={structure['count_match']}, marks={structure['marks_match']}, dist={structure['distribution_valid']}")
        grounding_msg = "CLEAN" if grounding["is_clean"] else f"CONTAMINATED ({grounding.get('contaminated_count', 0)} questions)"
        print(f"        Grounding:    {grounding_msg}")
        print(f"        LLM Judge:    {judge.get('quality_rating', '?')}/5 — {judge.get('feedback', '')[:80]}")
        print(f"        Status:       {status}")

        all_results.append({
            "id": cid,
            "subject": subject,
            "description": desc,
            "structure": structure,
            "diversity": diversity,
            "grounding": grounding,
            "llm_judge": judge,
            "status": status,
        })

    final_status = "PASS" if overall_pass == len(cases) else f"PARTIAL ({overall_pass}/{len(cases)})"
    summary = {
        "total_cases": len(cases),
        "passed": overall_pass,
        "status": final_status,
        "results": all_results,
    }

    print(f"\n{'─'*60}")
    print(f"  📊 GENERATOR RESULTS: {overall_pass}/{len(cases)} cases PASSED")
    print(f"  Overall Status: {final_status}")
    print(f"{'='*60}\n")

    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"  💾 Results saved → {RESULTS_PATH}\n")

    return summary


if __name__ == "__main__":
    evaluate_generator()
