# src/nodes/critic_node.py

from src.state import ExamState
from typing import Dict, Any


def critic_node(state: ExamState) -> Dict[str, Any]:
    """Reviews the grade for potential bias or error."""

    if not state.get("grades"):
        return {}

    last_grade = state["grades"][-1]

    score = last_grade.get("score", 0)
    answer_text = ""

    if state.get("student_answers"):
        answer_text = state["student_answers"][-1].get("answer_text", "")

    # If low score but long answer → flag
    if score < 4 and len(answer_text) > 100:
        return {
            "critic_notes": "Answer is lengthy. Consider giving partial credit."
        }

    # Clear critic notes if grade looks fine
    return {"critic_notes": None}
