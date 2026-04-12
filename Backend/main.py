from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from typing import cast
from fastapi.middleware.cors import CORSMiddleware

from src.graph import app as graph_app
from src.state import ExamState

from src.firebase_config import db
from firebase_admin import firestore
from google.cloud.firestore import SERVER_TIMESTAMP

app_api = FastAPI()


# -----------------------------
# CORS
# -----------------------------
app_api.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Request Models
# -----------------------------
class ExamRequest(BaseModel):
    student_id: str
    semester: int
    subject: str


class SubmitExam(BaseModel):
    student_answers: List[dict]
    exam_state: dict
    user_email: str


# -----------------------------
# Firestore Save Function
# -----------------------------
def save_exam_to_firestore(user_email: str, exam_state: dict):

    grades = exam_state.get("grades", [])

    exam_id = f"{user_email}_{exam_state.get('subject')}_{exam_state.get('semester')}"

    doc = {
        "user": user_email,
        "subject": exam_state.get("subject"),
        "semester": exam_state.get("semester"),
        "score": sum(g.get("score", 0) for g in grades),
        "max_score": sum(g.get("max_marks", 0) for g in grades),
        "grades": grades,
        "diagnostic": exam_state.get("diagnostic_report"),
        "timestamp": SERVER_TIMESTAMP,
    }

    db.collection("exam_results").document(exam_id).set(doc)

    print("Exam saved (no duplicates)")
# -----------------------------
# Generate Exam Endpoint
# -----------------------------
@app_api.post("/generate-exam")
def generate_exam(data: ExamRequest):

    state_dict = {
        "student_id": data.student_id,
        "semester": data.semester,
        "subject": data.subject,
        "messages": [],
        "image_bytes": None,
        "raw_transcription": None,
        "exam_questions": [],
        "student_answers": [],
        "current_rubric": None,
        "grades": [],
        "critic_notes": None,
        "diagnostic_report": None,
        "loop_count": 0,
    }

    state = cast(ExamState, state_dict)

    result = graph_app.invoke(state)

    return result


# -----------------------------
# Submit Exam Endpoint
# -----------------------------
@app_api.post("/submit-exam")
def submit_exam(data: SubmitExam):

    state = cast(ExamState, data.exam_state)

    state["student_answers"] = data.student_answers

    result = graph_app.invoke(state)

    # SAVE TO FIRESTORE
    save_exam_to_firestore(data.user_email, result)

    return result