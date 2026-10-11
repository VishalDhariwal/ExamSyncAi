from src.state import ExamState
from src.retriever import get_exam_context
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from typing import Dict, Any
import os
from dotenv import load_dotenv

# -----------------------------------
# Setup
# -----------------------------------
load_dotenv()

GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

llm = ChatGroq(
    model=GROQ_MODEL,
    temperature=0.5,
)

# -----------------------------------
# Analyze PYQ Patterns
# -----------------------------------
def analyze_pyq(pyq_text: str) -> str:
    """Uses LLM to summarize frequently asked topics and patterns from retrieved PYQ chunks."""
    if not pyq_text or not pyq_text.strip():
        return ""

    prompt = ChatPromptTemplate.from_template("""
You are analyzing previous year question papers.

Extract:
1. Frequently asked topics
2. Repeated questions (if any)
3. Common question types (define, explain, long answer)
4. Important exam patterns

PYQ Context:
{pyq}

Return concise structured analysis.
""")

    chain = prompt | llm
    response = chain.invoke({"pyq": pyq_text})

    if isinstance(response.content, str):
        return response.content
    return str(response.content)


# -----------------------------------
# Normalize Structure
# -----------------------------------
def normalize_structure(questions):
    """Guarantees a strict 40-mark paper: 5x2m, 4x3m, 2x4m, 2x5m = 13 questions."""
    required = {2: 5, 3: 4, 4: 2, 5: 2}
    final = []

    by_marks = {2: [], 3: [], 4: [], 5: []}

    for q in questions:
        m = q.get("marks")
        if m in by_marks:
            by_marks[m].append(q)

    for marks, count in required.items():
        selected = by_marks[marks][:count]

        # Fallback if missing
        while len(selected) < count:
            topic = questions[0].get("topic", "Core Concepts") if questions else "Core Concepts"

            selected.append({
                "question": f"Explain {topic} with an example.",
                "marks": marks,
                "topic": topic,
                "ideal_answer": f"Detailed explanation of {topic} with technical terminology and examples."
            })

        final.extend(selected)

    for i, q in enumerate(final, 1):
        q["id"] = i

    return final


# -----------------------------------
# Generator Node
# -----------------------------------
def generator_node(state: ExamState) -> Dict[str, Any]:
    """Generates syllabus-aligned exam using ChromaDB retrieval and reranked context."""
    if state.get("exam_questions"):
        return {}

    semester = state["semester"]
    subject = state["subject"]

    # 1. Retrieve & Rerank via ChromaDB (with automatic fallback to disk if needed)
    try:
        context_data = get_exam_context(semester, subject)
        rag_context = context_data.get("notes_context", "")
        pyq_text = context_data.get("pyq_context", "")
    except Exception as e:
        print("ChromaDB context retrieval error:", e)
        rag_context = ""
        pyq_text = ""

    # 2. Extract PYQ patterns from retrieved past questions
    pyq_analysis = analyze_pyq(pyq_text)

    # 3. Generate exam using Groq LLM
    parser = JsonOutputParser()

    prompt = ChatPromptTemplate.from_template("""
You are an expert university examiner.

Use:
1) PYQ analysis (patterns, repeated topics):
{pyq_analysis}

2) Syllabus & Notes context retrieved from vector store:
{context}

Create a **40-mark exam** for {subject}.

STRICT REQUIREMENT:
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
- Follow PYQ style and exam trends
- Cover important syllabus topics
- No markdown formatting around JSON
- No extra commentary
""")

    chain = prompt | llm | parser

    try:
        questions = chain.invoke({
            "pyq_analysis": pyq_analysis,
            "context": rag_context,
            "subject": subject,
        })

        questions = normalize_structure(questions)

    except Exception as e:
        print("Generation error:", e)
        questions = []

    return {
        "exam_questions": questions,
        "messages": [{
            "role": "system",
            "content": "40-mark exam generated using ChromaDB RAG and PYQ analysis"
        }]
    }