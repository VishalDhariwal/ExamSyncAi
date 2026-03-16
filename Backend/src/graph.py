# src/graph.py

from langgraph.graph import StateGraph, START, END
from src.state import ExamState
from src.nodes.generator import generator_node
from src.nodes.vision import vision_node
from src.nodes.grader import grader_node
from src.nodes.critic import critic_node


# -----------------------------------
# Initialize Graph
# -----------------------------------
workflow = StateGraph(ExamState)


# -----------------------------------
# Add Nodes
# -----------------------------------
workflow.add_node("generate_exam", generator_node)
workflow.add_node("process_vision", vision_node)
workflow.add_node("grade_answers", grader_node)
workflow.add_node("critic_review", critic_node)


# -----------------------------------
# Routing Decisions
# -----------------------------------

def route_after_generation(state: ExamState):
    """
    Decide whether to run vision or go directly to grading.
    """
    if state.get("image_bytes"):
        return "vision"
    return "grade"


def decide_to_loop(state: ExamState):
    """
    Critic loop logic.
    """
    if state.get("critic_notes") and state.get("loop_count", 0) < 2:
        print(f"🔄 Loop {state.get('loop_count')}: Re-grading...")
        return "regrade"

    print("✅ Grade finalized.")
    return "finish"


# -----------------------------------
# Edges
# -----------------------------------

workflow.add_edge(START, "generate_exam")

# After exam generation → wait for answer
workflow.add_conditional_edges(
    "generate_exam",
    route_after_generation,
    {
        "vision": "process_vision",
        "grade": "grade_answers",
    },
)

workflow.add_edge("process_vision", "grade_answers")
workflow.add_edge("grade_answers", "critic_review")

workflow.add_conditional_edges(
    "critic_review",
    decide_to_loop,
    {
        "regrade": "grade_answers",
        "finish": END,
    },
)


# -----------------------------------
# Compile
# -----------------------------------
app = workflow.compile()
