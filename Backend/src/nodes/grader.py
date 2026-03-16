from src.state import ExamState
from groq import Groq
from typing import Dict, Any
import json
from dotenv import load_dotenv

load_dotenv()

client = Groq()


def grader_node(state: ExamState) -> Dict[str, Any]:
    """
    Grades the FULL exam (all questions).
    """

    questions = state.get("exam_questions", [])
    answers = state.get("student_answers", [])

    if not questions or not answers:
        return {}

    # Map answers by question_id
    answer_map = {a["question_id"]: a["answer_text"] for a in answers}

    grades = []

    for question in questions:
        qid = question["id"]
        student_ans = answer_map.get(qid, "").strip()

        max_marks = question.get("marks", 0)
        topic = question.get("topic")
        ideal_answer = question.get("ideal_answer")

        # -----------------------------
        # No answer case
        # -----------------------------
        if not student_ans:
            grades.append({
                "question_id": qid,
                "score": 0,
                "max_marks": max_marks,
                "justification": "No answer provided.",
                "topic": topic
            })
            continue

        # -----------------------------
        # LLM grading
        # -----------------------------
        prompt = f"""
You are a strict university examiner.

Topic: {topic}
Maximum Marks: {max_marks}

Ideal Answer:
{ideal_answer}

Student Answer:
{student_ans}

Evaluate based on:
- Technical accuracy
- Coverage
- Terminology
- Completeness

Return ONLY JSON:
{{
  "score": int (0 to {max_marks}),
  "justification": "mistakes and improvements"
}}
"""

        try:
            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=200,
            )

            text_output = response.choices[0].message.content or ""
            text_output = text_output.replace("```json", "").replace("```", "").strip()


            parsed = json.loads(text_output)
            score = min(max(parsed.get("score", 0), 0), max_marks)

            grades.append({
                "question_id": qid,
                "score": score,
                "max_marks": max_marks,
                "justification": parsed.get("justification", ""),
                "topic": topic
            })

        except Exception as e:
            print("Grading error:", e)
            grades.append({
                "question_id": qid,
                "score": max_marks // 2,
                "max_marks": max_marks,
                "justification": "Fallback evaluation.",
                "topic": topic
            })

    # ---------------------------------
    # Overall diagnostic
    # ---------------------------------
    total_score = sum(g["score"] for g in grades)
    total_max = sum(g["max_marks"] for g in grades)

    weak_topics = [
        g["topic"]
        for g in grades
        if g["score"] < g["max_marks"] * 0.5
    ]

    diagnostic = {
        "overall_feedback": f"Total Score: {total_score}/{total_max}. Focus on weak topics.",
        "weak_topics": list(set(weak_topics)),
        "improvement_tips": [
            "Revise weak topics",
            "Practice previous year questions",
            "Focus on technical terminology"
        ]
    }

    return {
        "grades": grades,   # full list
        "diagnostic_report": diagnostic,
        "loop_count": 1
    }
