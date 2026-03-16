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

    db.collection("exam_results").add(doc)

    print("Exam saved to Firestore")
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

# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# from typing import List, Optional, cast
# from dotenv import load_dotenv
# from src.graph import app
# from src.state import ExamState  # TypedDict version
# from src.firebase_config import db
# from firebase_admin import firestore
# from google.cloud.firestore import SERVER_TIMESTAMP

# load_dotenv()

# app_api = FastAPI(title="StudySync AI API")

# # ---------------------------------------
# # CORS (Allow React Frontend)
# # ---------------------------------------
# app_api.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         "http://localhost:5173",
#         "http://127.0.0.1:5173",
#     ],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # ---------------------------------------
# # Request Models
# # ---------------------------------------
# class GenerateExamRequest(BaseModel):
#     student_id: str
#     semester: int
#     subject: str


# class StudentAnswer(BaseModel):
#     question_id: int
#     answer_text: str


# class SubmitExamRequest(BaseModel):
#     exam_state: dict
#     student_answers: List[StudentAnswer]
#     user_email: Optional[str] = None

# # ---------------------------------------
# # Create Initial Exam State
# # ---------------------------------------
# def create_initial_state(student_id: str, semester: int, subject: str) -> ExamState:
#     state_dict = {
#         "student_id": student_id,
#         "semester": semester,
#         "subject": subject,
#         "messages": [],
#         "image_bytes": None,
#         "raw_transcription": None,
#         "exam_questions": [],
#         "student_answers": [],
#         "current_rubric": None,
#         "grades": [],
#         "critic_notes": None,
#         "diagnostic_report": None,
#         "loop_count": 0,
#     }
#     return cast(ExamState, state_dict)

# # ---------------------------------------
# # Save Results to Firestore
# # ---------------------------------------
# def save_exam_to_firestore(user_email: str, exam_state: dict):
#     if not exam_state.get("grades"):
#         return

#     doc = {
#         "user": user_email,
#         "subject": exam_state.get("subject"),
#         "semester": exam_state.get("semester"),
#         "score": sum(g["score"] for g in exam_state.get("grades", [])),
#         "max_score": sum(g["max_marks"] for g in exam_state.get("grades", [])),
#         "grades": exam_state.get("grades"),
#         "diagnostic": exam_state.get("diagnostic_report"),
#          "timestamp": SERVER_TIMESTAMP,
#     }

#     db.collection("exam_results").add(doc)

# # ---------------------------------------
# # Health Check
# # ---------------------------------------
# @app_api.get("/")
# def root():
#     return {"message": "StudySync AI Backend Running 🚀"}

# # ---------------------------------------
# # Generate Mock Exam
# # ---------------------------------------
# @app_api.post("/generate-exam")
# def generate_exam(req: GenerateExamRequest):
#     state = create_initial_state(req.student_id, req.semester, req.subject)
#     result = app.invoke(state)
#     return result

# # ---------------------------------------
# # Submit Full Exam for Evaluation
# # ---------------------------------------
# @app_api.post("/submit-exam")
# def submit_exam(req: SubmitExamRequest):
#     # Cast incoming dict to ExamState
#     state = cast(ExamState, req.exam_state)

#     # Update student answers
#     state["student_answers"] = [
#         {"question_id": a.question_id, "answer_text": a.answer_text}
#         for a in req.student_answers
#     ]

#     state["image_bytes"] = None

#     # Invoke the app
#     result = app.invoke(state)

#     # Save results if email provided
#     if req.user_email:
#         save_exam_to_firestore(req.user_email, result)

#     return result