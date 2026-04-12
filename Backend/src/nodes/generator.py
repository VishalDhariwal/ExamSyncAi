from src.state import ExamState
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from typing import Dict, Any
from dotenv import load_dotenv
import os

# LlamaIndex imports
from llama_index.core import Document, TreeIndex
from llama_index.core.node_parser import SimpleNodeParser

# -----------------------------------
# Setup
# -----------------------------------
load_dotenv()

llm = ChatGroq(
    model="llama-3.1-8b-instant",
    temperature=0.5,
)

# ✅ Change this to your absolute path if needed
BASE_DIR = "Data"

# -----------------------------------
# Load PYQ
# -----------------------------------
def load_pyq(semester: int, subject: str) -> str:
    base_path = os.path.join(BASE_DIR, f"sem{semester}", subject.upper(), "PYQ")
    contents = []

    try:
        if not os.path.isdir(base_path):
            print(f"❌ PYQ folder not found: {base_path}")
            return ""

        for file in sorted(os.listdir(base_path)):
            if file.endswith(".txt"):
                file_path = os.path.join(base_path, file)

                with open(file_path, "r", encoding="utf-8") as f:
                    contents.append(f.read())

    except Exception as e:
        print("Error loading PYQ files:", e)
        return ""

    return "\n\n".join(contents)

# -----------------------------------
# Analyze PYQ (🔥 IMPORTANT)
# -----------------------------------
def analyze_pyq(pyq_text: str) -> str:
    if not pyq_text.strip():
        return ""

    prompt = ChatPromptTemplate.from_template("""
You are analyzing previous year question papers.

Extract:

1. Frequently asked topics
2. Repeated questions (if any)
3. Common question types (define, explain, long answer)
4. Important exam patterns

PYQ:
{pyq}

Return concise structured analysis.
""")

    chain = prompt | llm
    response = chain.invoke({"pyq": pyq_text})
    
    if isinstance(response.content,str):
        return response.content
    return str(response.content)

# -----------------------------------
# TreeIndex Cache
# -----------------------------------
_tree_cache = {}

# -----------------------------------
# Build TreeIndex
# -----------------------------------
def get_tree_index(semester: int, subject: str):
    cache_key = f"{semester}_{subject.lower()}"

    if cache_key in _tree_cache:
        return _tree_cache[cache_key]

    base_path = os.path.join(BASE_DIR, f"sem{semester}", subject.upper())
    notes_path = os.path.join(base_path, "NOTES", "notes.txt")

    documents = []

    try:
        if os.path.exists(notes_path):
            with open(notes_path, "r", encoding="utf-8") as f:
                documents.append(Document(text=f.read()))
        else:
            print(f"❌ notes.txt not found at {notes_path}")
            return None

    except Exception as e:
        print("Error loading notes:", e)
        return None

    parser = SimpleNodeParser()
    nodes = parser.get_nodes_from_documents(documents)
    index = TreeIndex(nodes)

    _tree_cache[cache_key] = index
    return index

# -----------------------------------
# Query TreeIndex
# -----------------------------------
def query_tree_index(index, subject: str) -> str:
    query_engine = index.as_query_engine()

    response = query_engine.query(
        f"List important topics, definitions, and key concepts for {subject}. "
        f"Focus on exam-relevant content."
    )

    return str(response)

# -----------------------------------
# Normalize Structure
# -----------------------------------
def normalize_structure(questions):
    required = {2: 5, 3: 4, 4: 2, 5: 2}
    final = []

    by_marks = {2: [], 3: [], 4: [], 5: []}

    for q in questions:
        m = q.get("marks")
        if m in by_marks:
            by_marks[m].append(q)

    for marks, count in required.items():
        selected = by_marks[marks][:count]

        # fallback if missing
        while len(selected) < count:
            topic = questions[0].get("topic", "Database Normalization")

            selected.append({
                "question": f"Explain {topic} with example.",
                "marks": marks,
                "topic": topic,
                "ideal_answer": f"Detailed explanation of {topic} with examples."
            })

        final.extend(selected)

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

    # -------- Notes (TreeIndex) --------
    try:
        index = get_tree_index(semester, subject)

        if index:
            rag_context = query_tree_index(index, subject)
        else:
            rag_context = ""

    except Exception as e:
        print("TreeIndex error:", e)
        rag_context = ""

    # -------- PYQ --------
    pyq_raw = load_pyq(semester, subject)
    pyq_analysis = analyze_pyq(pyq_raw)

    parser = JsonOutputParser()

    prompt = ChatPromptTemplate.from_template("""
You are an expert university examiner.

Use:
1) PYQ analysis (patterns, repeated topics)
2) Notes context

====================
PYQ Analysis:
{pyq_analysis}

Notes:
{context}
====================

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
- Follow PYQ style
- Cover important syllabus topics
- No markdown
- No extra text
""")

    chain = prompt | llm | parser

    try:
        questions = chain.invoke({
            "pyq_analysis": pyq_analysis,
            "context": rag_context,
            "subject": subject
        })

        questions = normalize_structure(questions)

    except Exception as e:
        print("Generation error:", e)
        questions = []

    return {
        "exam_questions": questions,
        "messages": [{
            "role": "system",
            "content": "40-mark exam generated using PYQ analysis"
        }]
    }