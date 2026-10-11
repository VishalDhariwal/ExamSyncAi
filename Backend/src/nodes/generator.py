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
def normalize_structure(questions, breakdown, subject="Core Subject"):
    """
    Guarantees that the exam strictly matches the requested rubric:
    exact number of MCQs and subjective questions for every mark tier,
    ensuring sum of marks exactly equals total_marks.
    """
    final = []

    # Segregate incoming questions by (is_mcq, marks)
    pool = []
    for q in questions:
        q_is_mcq = (
            q.get("question_type") == "mcq"
            or bool(q.get("options"))
            or q.get("marks") == 1
        )
        pool.append({
            "question": q.get("question"),
            "question_type": "mcq" if q_is_mcq else "subjective",
            "options": q.get("options", []),
            "marks": q.get("marks", 2),
            "topic": q.get("topic", "Core Concepts"),
            "ideal_answer": q.get("ideal_answer", ""),
            "_used": False,
        })

    for tier in breakdown:
        tier_type = tier.get("type", "subjective").lower()
        tier_is_mcq = tier_type == "mcq" or tier.get("marks") == 1
        tier_marks = tier.get("marks", 2)
        tier_count = tier.get("count", 1)

        selected_for_tier = []

        # Find matching questions in pool
        for item in pool:
            if not item["_used"] and item["marks"] == tier_marks and item["question_type"] == ("mcq" if tier_is_mcq else "subjective"):
                item["_used"] = True
                selected_for_tier.append({
                    "question": item["question"],
                    "question_type": item["question_type"],
                    "options": item["options"],
                    "marks": tier_marks,
                    "topic": item["topic"],
                    "ideal_answer": item["ideal_answer"],
                })
                if len(selected_for_tier) == tier_count:
                    break

        # Fallback if LLM generated fewer questions than requested
        while len(selected_for_tier) < tier_count:
            topic = questions[0].get("topic", subject) if questions else subject
            if tier_is_mcq:
                selected_for_tier.append({
                    "question": f"Which of the following is correct regarding {topic}?",
                    "question_type": "mcq",
                    "options": [
                        f"A) Primary mechanism of {topic}",
                        f"B) Secondary feature of {topic}",
                        f"C) Inverted process of {topic}",
                        "D) None of the above",
                    ],
                    "marks": tier_marks,
                    "topic": topic,
                    "ideal_answer": f"A) Primary mechanism of {topic}",
                })
            else:
                selected_for_tier.append({
                    "question": f"Explain {topic} and discuss its importance in {subject}.",
                    "question_type": "subjective",
                    "marks": tier_marks,
                    "topic": topic,
                    "ideal_answer": f"Detailed technical explanation of {topic} with core concepts, diagrams/equations if applicable, and examples.",
                })

        final.extend(selected_for_tier)

    # Re-number IDs sequentially
    for i, q in enumerate(final, 1):
        q["id"] = i

    return final


# -----------------------------------
# Generator Node
# -----------------------------------
def generator_node(state: ExamState) -> Dict[str, Any]:
    """Generates syllabus-aligned exam matching user-configured rubric."""
    if state.get("exam_questions"):
        return {}

    semester = state.get("semester")
    subject = state["subject"]
    student_id = state.get("student_id")
    exam_config = state.get("exam_config")

    # Default to 40-mark standard if not specified
    if not exam_config or not exam_config.get("breakdown"):
        exam_config = {
            "total_marks": 40,
            "breakdown": [
                {"type": "short", "marks": 2, "count": 5},
                {"type": "short", "marks": 3, "count": 4},
                {"type": "medium", "marks": 4, "count": 2},
                {"type": "long", "marks": 5, "count": 2},
            ],
        }

    total_marks = exam_config["total_marks"]
    breakdown = exam_config["breakdown"]

    # 1. Retrieve & Rerank via PostgreSQL pgvector
    try:
        context_data = get_exam_context(
            subject=subject,
            semester=semester,
            user_id=student_id if student_id != "guest" else None,
        )
        rag_context = context_data.get("notes_context", "")
        pyq_text = context_data.get("pyq_context", "")
    except Exception as e:
        print("pgvector context retrieval error:", e)
        rag_context = ""
        pyq_text = ""

    # 2. Extract PYQ patterns from retrieved past questions (if available)
    pyq_analysis = (
        analyze_pyq(pyq_text)
        if pyq_text
        else "No prior PYQ documents uploaded. Derive balanced mock exam questions directly from the provided course notes."
    )

    # 3. Format Rubric Requirements
    req_items = []
    for b in breakdown:
        b_type = b.get("type", "subjective").lower()
        b_marks = b["marks"]
        b_count = b["count"]
        if b_type == "mcq" or b_marks == 1:
            req_items.append(
                f"- {b_count} Multiple Choice Question(s) of {b_marks} mark(s) each. MUST have 'question_type': 'mcq', 'options': ['A) ...', 'B) ...', 'C) ...', 'D) ...'], and 'ideal_answer': 'A) ...'"
            )
        else:
            req_items.append(
                f"- {b_count} subjective question(s) of {b_marks} marks each. 'question_type': 'subjective'"
            )
    requirements_text = "\n".join(req_items)
    total_q_count = sum(b["count"] for b in breakdown)

    # 4. Generate exam using Groq LLM
    parser = JsonOutputParser()

    prompt = ChatPromptTemplate.from_template("""
You are an expert examiner creating an academic mock exam.

Source Materials (Retrieved from Student's Uploaded Notes/Syllabus):
1) Syllabus & Notes Context:
{context}

2) Prior Examination Pattern Analysis:
{pyq_analysis}

Target Subject: {subject}
Total Marks: {total_marks}
Total Questions Required: {total_q_count}

STRICT RUBRIC REQUIREMENTS:
{requirements_text}

CRITICAL INSTRUCTIONS:
- STRICT GROUNDING: You MUST formulate all questions directly and exclusively from the syllabus topics, concepts, modules, and terminology provided in the "Syllabus & Notes Context" above.
- DO NOT invent questions about an unrelated discipline. If the source material covers Computer Science, AI search, or algorithms, ALL questions MUST be strictly about those topics.
- Strictly adhere to the requested question counts and marks distribution.
- For MCQs, provide 4 plausible options with the correct option in 'ideal_answer'.
- For subjective questions, provide technical definitions and ideal answers.
- Return ONLY the JSON array without Markdown code fences or extra text.

Return ONLY a valid JSON array matching this format:
[
  {{
    "id": 1,
    "question": "What is ...?",
    "question_type": "mcq",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "marks": 1,
    "topic": "...",
    "ideal_answer": "A) ..."
  }},
  {{
    "id": 2,
    "question": "Explain ...",
    "question_type": "subjective",
    "marks": 2,
    "topic": "...",
    "ideal_answer": "..."
  }}
]
""")

    chain = prompt | llm | parser

    try:
        questions = chain.invoke({
            "pyq_analysis": pyq_analysis,
            "context": rag_context,
            "subject": subject,
            "total_marks": total_marks,
            "total_q_count": total_q_count,
            "requirements_text": requirements_text,
        })

        questions = normalize_structure(questions, breakdown, subject=subject)

    except Exception as e:
        print("Generation error:", e)
        questions = normalize_structure([], breakdown, subject=subject)

    return {
        "exam_questions": questions,
        "exam_config": exam_config,
        "messages": [{
            "role": "system",
            "content": f"{total_marks}-mark exam generated based on custom rubric and RAG context",
        }],
    }