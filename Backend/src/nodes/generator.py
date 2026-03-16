from src.state import ExamState
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from src.retriever import get_retriever
from typing import Dict, Any, List
from dotenv import load_dotenv
import os

load_dotenv()

llm = ChatGroq(
    model="llama-3.1-8b-instant",
    temperature=0,
)


# -----------------------------------
# Load Previous Year Questions
# -----------------------------------
def load_pyq(semester: int, subject: str) -> str:
    path = f"Data/sem{semester}/{subject.lower()}_pyq.md"
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except:
        return ""


# -----------------------------------
# Enforce Exact Paper Structure
# -----------------------------------
def enforce_structure(questions: List[dict]) -> List[dict]:
    required = {2: 5, 3: 4, 4: 2, 5: 2}
    final = []

    for marks, count in required.items():
        group = [q for q in questions if q.get("marks") == marks]
        final.extend(group[:count])

    # Reassign IDs
    for i, q in enumerate(final, 1):
        q["id"] = i

    return final
def normalize_structure(questions):
    """
    Ensures final paper always has:
    5×2, 4×3, 2×4, 2×5 = 13 questions
    """
    required = {2: 5, 3: 4, 4: 2, 5: 2}
    final = []

    # Group by marks
    by_marks = {2: [], 3: [], 4: [], 5: []}
    for q in questions:
        m = q.get("marks")
        if m in by_marks:
            by_marks[m].append(q)

    # Select required counts
    for marks, count in required.items():
        selected = by_marks[marks][:count]

        # If not enough, create simple fallback questions
        while len(selected) < count:
            selected.append({
                "question": f"Write short note on {questions[0].get('topic', 'DBMS')}.",
                "marks": marks,
                "topic": questions[0].get("topic", "General"),
                "ideal_answer": "Relevant explanation."
            })

        final.extend(selected)

    # Reassign IDs
    for i, q in enumerate(final, 1):
        q["id"] = i

    return final


# -----------------------------------
# Generator Node
# -----------------------------------
def generator_node(state: ExamState) -> Dict[str, Any]:

    if state.get("exam_questions"):
        return {}

    semester = state["semester"]
    subject = state["subject"]

    # -------- RAG Context --------
    retriever = get_retriever(semester)
    docs = retriever.vectorstore.similarity_search(
        f"Important topics for {subject}", k=8
    )
    rag_context = "\n\n".join([d.page_content for d in docs])

    # -------- PYQ Context --------
    pyq_context = load_pyq(semester, subject)

    parser = JsonOutputParser()

    prompt = ChatPromptTemplate.from_template("""
You are an expert university examiner.

Use:
1) Previous Year Question pattern
2) Notes context

====================
PYQ Pattern:
{pyq}

Notes:
{context}
====================

Create a **40-mark exam** for {subject}.

STRICT REQUIREMENT — DO NOT DEVIATE:

Generate EXACTLY:

- 5 questions of 2 marks
- 4 questions of 3 marks
- 2 questions of 4 marks
- 2 questions of 5 marks

Total questions = 13  
Total marks = 40

Return ONLY JSON array:
[
  {{
    "id": 1,
    "question": "...",
    "marks": 2,
    "topic": "...",
    "ideal_answer": "..."
  }}
]

Rules:
- Follow PYQ style
- Cover important syllabus topics
- No markdown
- No extra text
""")

    chain = prompt | llm | parser

    try:
        questions = chain.invoke({
            "pyq": pyq_context,
            "context": rag_context,
            "subject": subject
        })

        # Enforce exact structure
        # questions = enforce_structure(questions)

        # # Safety check
        # if len(questions) != 13:
        #     print("⚠️ Incorrect structure, regenerating fallback")
        #     questions = []
        questions = normalize_structure(questions)

    except Exception as e:
        print("Generation error:", e)
        questions = []

    return {
        "exam_questions": questions,
        "messages": [{
            "role": "system",
            "content": "40-mark exam generated using PYQ + RAG"
        }]
    }
