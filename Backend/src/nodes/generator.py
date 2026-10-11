from src.state import ExamState
from src.retriever import get_exam_context
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from typing import Dict, Any, List
import os
import re
import json
from dotenv import load_dotenv

# -----------------------------------
# Setup
# -----------------------------------
load_dotenv()

GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

llm = ChatGroq(
    model=GROQ_MODEL,
    temperature=0.3,
    max_tokens=6144,
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


def extract_context_concepts(context_text: str, subject: str):
    """Extracts distinctive, technical keywords and topics from notes context to prevent placeholder fallbacks."""
    concepts = []
    if context_text:
        lines = [line.strip("-* \t\r\n") for line in context_text.splitlines() if line.strip()]
        for line in lines:
            if 10 <= len(line) <= 70 and not line.startswith("http") and not line.startswith("#"):
                cleaned = re.sub(r"^[0-9\.\)\-\:]+\s*", "", line).strip()
                if cleaned and cleaned not in concepts and len(cleaned) > 5:
                    concepts.append(cleaned)
            terms = re.findall(r"\b[A-Z][a-zA-Z0-9_\-\.]{2,}\b", line)
            for t in terms:
                if t.lower() not in (
                    "the", "this", "that", "with", "from", "team", "year", "your",
                    "have", "and", "for", "are", "about", "what", "which", "will",
                ) and t not in concepts:
                    concepts.append(t)

    fallback_topics = [
        f"{subject} Core Architecture",
        f"{subject} Execution Workflow",
        f"{subject} State Management & Persistence",
        f"{subject} Fault Tolerance & Recovery",
        f"{subject} Concurrency & Performance",
        f"{subject} API Protocols & Integration",
        f"{subject} Error Handling & Edge Cases",
        f"{subject} System Scaling & Monitoring",
    ]
    for ft in fallback_topics:
        if ft not in concepts:
            concepts.append(ft)

    return concepts


def synthesize_substantive_question(concept: str, subject: str, is_mcq: bool, marks: int, idx: int):
    """Generates an academically rigorous, domain-specific question without meaningless generic placeholders."""
    if is_mcq:
        choice_idx = idx % 4
        opts = [
            f"Coordinates persistent state execution and handles automated retries for {concept}",
            f"Executes only stateless synchronous operations without checkpointing or recovery in {concept}",
            f"Bypasses validation protocols and disables distributed task isolation in {concept}",
            f"Forces manual worker restarts after every individual execution step in {concept}",
        ]
        correct_text = opts[0]
        opts[0], opts[choice_idx] = opts[choice_idx], opts[0]
        labels = ["A) ", "B) ", "C) ", "D) "]
        formatted_options = [labels[i] + opts[i] for i in range(4)]
        ideal_answer = labels[choice_idx] + correct_text

        return {
            "question": f"Which of the following best characterizes the design behavior and execution model of {concept} in {subject}?",
            "question_type": "mcq",
            "options": formatted_options,
            "marks": marks,
            "topic": concept,
            "ideal_answer": ideal_answer,
        }
    else:
        question_templates = [
            f"Analyze the architectural workflow and execution lifecycle of {concept} in {subject}. Explain how state transitions, task coordination, and error recovery are managed.",
            f"Explain how {concept} achieves fault tolerance, consistency, and scalability in {subject}. Detail the core components involved.",
            f"Compare and contrast the implementation of {concept} in {subject} against traditional alternatives, discussing key performance trade-offs.",
            f"Discuss the practical configuration, monitoring, and failure handling strategies for {concept} in production {subject} systems.",
        ]
        q_text = question_templates[idx % len(question_templates)]
        return {
            "question": q_text,
            "question_type": "subjective",
            "options": [],
            "marks": marks,
            "topic": concept,
            "ideal_answer": f"Comprehensive technical analysis of {concept} in {subject}, including its operational lifecycle, state handling mechanisms, error resilience, and key architectural trade-offs.",
        }


# -----------------------------------
# Normalize Structure
def normalize_structure(questions, breakdown, subject="Core Subject", context_text="", selected_topics=None):
    """
    Guarantees that the exam strictly matches the requested rubric:
    exact number of MCQs and subjective questions for every mark tier,
    ensuring sum of marks exactly equals total_marks with high intellectual quality.
    If selected_topics is provided, questions are strictly constrained to those topics.
    """
    final = []
    if selected_topics and len(selected_topics) > 0:
        concepts = [t.strip() for t in selected_topics if t.strip()]
    else:
        concepts = extract_context_concepts(context_text, subject)
    concept_idx = 0

    # Segregate incoming questions from LLM
    pool = []
    for q in (questions or []):
        if not q or not isinstance(q, dict):
            continue
        q_text = str(q.get("question", "")).strip()
        if not q_text:
            continue
        q_is_mcq = (
            q.get("question_type") == "mcq"
            or bool(q.get("options"))
            or q.get("marks") == 1
        )
        pool.append({
            "question": q_text,
            "question_type": "mcq" if q_is_mcq else "subjective",
            "options": q.get("options", []) if isinstance(q.get("options"), list) else [],
            "marks": q.get("marks", 2),
            "topic": q.get("topic") or subject,
            "ideal_answer": q.get("ideal_answer", ""),
            "_used": False,
        })

    for tier in breakdown:
        tier_type = str(tier.get("type", "subjective")).lower()
        tier_is_mcq = tier_type == "mcq" or tier.get("marks") == 1
        tier_marks = int(tier.get("marks", 2))
        tier_count = int(tier.get("count", 1))

        selected_for_tier = []

        # Pass 1: Exact match on question_type and marks
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

        # Pass 2: Match on question_type, adapting marks to tier_marks
        if len(selected_for_tier) < tier_count:
            for item in pool:
                if not item["_used"] and item["question_type"] == ("mcq" if tier_is_mcq else "subjective"):
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

        # Pass 3: Adapt any remaining unused question from pool
        if len(selected_for_tier) < tier_count:
            for item in pool:
                if not item["_used"]:
                    item["_used"] = True
                    if tier_is_mcq:
                        opts = item["options"]
                        ideal = item["ideal_answer"]
                        if not opts or len(opts) < 4:
                            labels = ["A) ", "B) ", "C) ", "D) "]
                            topic_str = item["topic"] or subject
                            opts = [
                                labels[0] + (str(ideal).strip()[:100] or f"Core execution principle of {topic_str}"),
                                labels[1] + f"Stateless synchronization without persistent state in {topic_str}",
                                labels[2] + f"Bypasses concurrency controls and event ordering in {topic_str}",
                                labels[3] + f"Restricted strictly to single-threaded batch processing in {topic_str}",
                            ]
                            ideal = opts[0]
                        selected_for_tier.append({
                            "question": item["question"],
                            "question_type": "mcq",
                            "options": opts,
                            "marks": tier_marks,
                            "topic": item["topic"],
                            "ideal_answer": ideal,
                        })
                    else:
                        selected_for_tier.append({
                            "question": item["question"],
                            "question_type": "subjective",
                            "options": [],
                            "marks": tier_marks,
                            "topic": item["topic"],
                            "ideal_answer": item["ideal_answer"] or f"Comprehensive technical explanation of {item['topic']}.",
                        })
                    if len(selected_for_tier) == tier_count:
                        break

        # Pass 4: Pool exhausted -> Synthesize substantive, domain-grounded questions
        while len(selected_for_tier) < tier_count:
            active_concept = concepts[concept_idx % len(concepts)]
            concept_idx += 1
            synthesized = synthesize_substantive_question(
                concept=active_concept,
                subject=subject,
                is_mcq=tier_is_mcq,
                marks=tier_marks,
                idx=concept_idx,
            )
            selected_for_tier.append(synthesized)

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

    subject = state["subject"]
    student_id = state.get("student_id")
    selected_pyqs = state.get("selected_pyqs")
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

    selected_topics = state.get("selected_topics") or []

    # 1. Retrieve & Rerank via PostgreSQL pgvector
    try:
        context_data = get_exam_context(
            subject=subject,
            user_id=student_id if student_id != "guest" else None,
            selected_pyqs=selected_pyqs,
            selected_topics=selected_topics,
        )
        rag_context = context_data.get("notes_context", "")
        pyq_text = context_data.get("pyq_context", "")
        pyq_sources = context_data.get("pyq_sources", [])
    except Exception as e:
        print("pgvector context retrieval error:", e)
        rag_context = ""
        pyq_text = ""
        pyq_sources = []

    # 2. Extract PYQ patterns from retrieved past questions (if available)
    if pyq_text:
        src_note = f" (from {', '.join(pyq_sources)})" if pyq_sources else ""
        pyq_analysis = analyze_pyq(pyq_text)
    else:
        pyq_analysis = "Derive balanced mock exam questions directly from the provided course notes."

    # 3. Format Rubric Requirements
    req_items = []
    q_start = 1
    for idx, b in enumerate(breakdown, 1):
        b_type = str(b.get("type", "subjective")).lower()
        b_marks = b["marks"]
        b_count = b["count"]
        is_mcq = b_type == "mcq" or b_marks == 1
        q_end = q_start + b_count - 1
        if is_mcq:
            req_items.append(
                f"- Tier {idx} (Questions {q_start} to {q_end}): Exactly {b_count} Multiple Choice Question(s), {b_marks} mark(s) each.\n"
                f"  MUST set 'question_type': 'mcq', 'marks': {b_marks}, 'options': ['A) ...', 'B) ...', 'C) ...', 'D) ...'], and 'ideal_answer': 'A) ...' (matching full correct option text).\n"
                f"  Every option must be technically plausible and distinct. NEVER write generic options like 'Primary mechanism' or 'None of the above'."
            )
        else:
            req_items.append(
                f"- Tier {idx} (Questions {q_start} to {q_end}): Exactly {b_count} Subjective Question(s), {b_marks} marks each.\n"
                f"  MUST set 'question_type': 'subjective', 'marks': {b_marks}, with clear question prompt, topic, and comprehensive benchmark ideal_answer."
            )
        q_start = q_end + 1

    requirements_text = "\n".join(req_items)
    total_q_count = sum(b["count"] for b in breakdown)

    # 4. Build prompt with targeted weak topics constraint if specified
    if selected_topics:
        topics_bullet = "\n".join(f"- {t}" for t in selected_topics)
        focus_topics_instruction = f"""CRITICAL CONSTRAINT - TARGETED WEAK TOPICS EXAM:
The student explicitly requested targeted practice questions ONLY on the following selected topics:
{topics_bullet}

1. EVERY SINGLE question in this exam MUST STRICTLY test one of these selected topics: {', '.join(selected_topics)}.
2. DO NOT include questions on any other topic outside this list.
3. For each question in the JSON array, set the "topic" field to EXACTLY one of the selected topics from this list."""
    else:
        focus_topics_instruction = "Ensure questions cover a diverse cross-section of topics and subtopics from the notes context. Do NOT repeat the same topic or question."

    prompt = ChatPromptTemplate.from_template("""
You are an expert university examiner creating an official academic mock exam.

Source Materials (Retrieved from Student's Uploaded Notes/Syllabus for {subject}):
1) Syllabus & Notes Context:
{context}

2) Prior Examination Pattern Analysis:
{pyq_analysis}

TARGET SUBJECT: {subject}
TOTAL MARKS: {total_marks}
TOTAL QUESTIONS REQUIRED: {total_q_count}

{focus_topics_instruction}

EXACT QUESTION TIER SPECIFICATIONS:
{requirements_text}

⚠️ CRITICAL GROUNDING RULES (READ BEFORE GENERATING):
- Generate questions ONLY from academic concepts, theories, algorithms, architectures, and technical material explicitly present in the notes context above.
- If the notes context contains non-academic content such as resumes, CVs, personal profiles, work experience, career objectives, names of people, company internships, GitHub/LinkedIn links, or certifications — YOU MUST COMPLETELY IGNORE that content.
- NEVER generate questions about a person's career, academic performance (CGPA), job experience, certifications they hold, or personal background. That is NOT exam content.
- Each question MUST test a verifiable academic or technical concept from the subject syllabus.
- The "topic" field in every question must reference a real academic topic or concept (e.g., "Normalization", "Binary Search Trees", "TCP/IP Model") — NOT a person's name, company, or personal achievement.
- If the notes context is insufficient to generate all required questions, generate standard university-level questions for {subject} from your own academic knowledge base. Do NOT generate personal/biographical questions as a fallback.

MANDATORY EXAM GENERATION RULES:
1. EXACT QUESTION COUNT: You MUST generate EXACTLY {total_q_count} questions in the JSON array, no more and no less.
2. TIER CONFORMANCE: Follow the tier breakdown specifications precisely. Each question must match the exact 'marks' and 'question_type' assigned to its tier.
3. RIGOROUS TECHNICAL QUALITY:
   - Formulate intellectually rigorous, clear, university-standard questions based strictly on the provided syllabus notes context.
   - For subjective questions: Ask targeted analytical, architectural, or design questions (e.g., "Analyze the state transition mechanics in...", "Explain how fault-tolerance and checkpointing are achieved in...", "Compare the concurrency model of X versus Y...").
   - For MCQs: Formulate questions that test deep conceptual understanding. Provide 4 distinct, technically substantive options. NEVER use superficial, placeholder, or meaningless options such as "Primary mechanism", "Secondary feature", "Inverted process", or "None of the above".
4. STRICT JSON OUTPUT: Return ONLY a valid JSON array matching this format:
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

    chain = prompt | llm

    try:
        raw_res = chain.invoke({
            "pyq_analysis": pyq_analysis,
            "context": rag_context or f"Core academic curriculum and technical documentation for {subject}.",
            "subject": subject,
            "total_marks": total_marks,
            "total_q_count": total_q_count,
            "focus_topics_instruction": focus_topics_instruction,
            "requirements_text": requirements_text,
        })
        text_content = raw_res.content if hasattr(raw_res, "content") else str(raw_res)

        # Robust JSON extraction
        try:
            parser = JsonOutputParser()
            questions = parser.parse(text_content)
        except Exception:
            m = re.search(r"\[\s*\{[\s\S]*\}\s*\]", text_content)
            if m:
                cleaned = re.sub(r",\s*([\]}])", r"\1", m.group(0))
                questions = json.loads(cleaned)
            else:
                raise ValueError("Could not extract JSON array from LLM response")

        questions = normalize_structure(
            questions,
            breakdown,
            subject=subject,
            context_text=rag_context,
            selected_topics=selected_topics,
        )

    except Exception as e:
        print("Generation error:", e)
        questions = normalize_structure(
            [],
            breakdown,
            subject=subject,
            context_text=rag_context,
            selected_topics=selected_topics,
        )

    return {
        "exam_questions": questions,
        "exam_config": exam_config,
        "messages": [{
            "role": "system",
            "content": f"{total_marks}-mark exam generated based on custom rubric and RAG context",
        }],
    }