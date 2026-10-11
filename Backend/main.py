from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Optional, cast
from contextlib import asynccontextmanager
import os
from pathlib import Path
from sqlalchemy.orm import Session

from src.database import init_db, get_db, User, ExamResult
from src.auth import hash_password, verify_password, create_access_token, get_current_user
from src.graph import app as graph_app
from src.state import ExamState


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize PostgreSQL tables and pgvector extension
    init_db()
    yield


app_api = FastAPI(title="ExamSync AI Backend", lifespan=lifespan)

# -----------------------------
# CORS
# -----------------------------
app_api.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Request & Response Models
# -----------------------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ExamRequest(BaseModel):
    student_id: Optional[str] = None
    semester: int
    subject: str


class SubmitExam(BaseModel):
    student_answers: List[dict]
    exam_state: dict
    user_email: Optional[str] = None


# -----------------------------
# Authentication Endpoints (Bcrypt & JWT)
# -----------------------------
@app_api.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Registers a new student with salted bcrypt password hashing."""
    if len(data.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long",
        )

    clean_email = data.email.strip().lower()

    # Check if user already exists
    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    # Hash password with bcrypt
    hashed_pw = hash_password(data.password)

    new_user = User(
        email=clean_email,
        password_hash=hashed_pw,
        full_name=data.full_name,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Issue JWT Token
    access_token = create_access_token(
        data={"sub": str(new_user.id), "email": new_user.email}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(new_user.id),
            "email": new_user.email,
            "full_name": new_user.full_name,
        },
    }


@app_api.post("/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates student credentials and returns a secure JWT access token."""
    clean_email = data.email.strip().lower()

    user = db.query(User).filter(User.email == clean_email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
        },
    }


@app_api.get("/auth/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Returns the authenticated student profile."""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
    }


# -----------------------------
# Generate Exam Endpoint
# -----------------------------
@app_api.post("/generate-exam")
def generate_exam(data: ExamRequest):
    """Generates an exam using PostgreSQL pgvector context and Groq LLM."""
    state_dict = {
        "student_id": data.student_id or "guest",
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
# Submit Exam Endpoint (Strict DB Isolation)
# -----------------------------
@app_api.post("/submit-exam")
def submit_exam(
    data: SubmitExam,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Evaluates answers and stores the result in PostgreSQL.
    Strictly isolated: linked solely to current_user.id.
    """
    state = cast(ExamState, data.exam_state)
    state["student_answers"] = data.student_answers

    # Run LangGraph evaluation (Grader -> Critic -> Diagnostic)
    result = graph_app.invoke(state)

    grades = result.get("grades", [])
    total_score = sum(g.get("score", 0) for g in grades)
    max_score = sum(g.get("max_marks", 0) for g in grades)

    # Save to PostgreSQL under authenticated student's user_id
    exam_record = ExamResult(
        user_id=current_user.id,
        subject=result.get("subject", state.get("subject", "General")),
        semester=result.get("semester", state.get("semester", 1)),
        score=total_score,
        max_score=max_score,
        grades=grades,
        diagnostic=result.get("diagnostic_report"),
    )

    db.add(exam_record)
    db.commit()
    db.refresh(exam_record)

    return result


# -----------------------------
# Exam History Endpoint (Strict Tenant Isolation)
# -----------------------------
@app_api.get("/exam-history")
def get_exam_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns only the past exams taken by the authenticated student.
    Guarantees isolation: no student can view another student's exams.
    """
    records = (
        db.query(ExamResult)
        .filter(ExamResult.user_id == current_user.id)
        .order_by(ExamResult.created_at.desc())
        .all()
    )

    return [
        {
            "id": str(r.id),
            "subject": r.subject,
            "semester": r.semester,
            "score": r.score,
            "max_score": r.max_score,
            "grades": r.grades,
            "diagnostic": r.diagnostic,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


# -----------------------------
# Structure Endpoint
# -----------------------------
BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "Data"


@app_api.get("/structure")
def get_structure():
    structure = {}
    if not DATA_PATH.exists():
        return structure

    for sem in os.listdir(DATA_PATH):
        sem_path = os.path.join(DATA_PATH, sem)
        if not os.path.isdir(sem_path):
            continue

        structure[sem] = {}
        for subject in os.listdir(sem_path):
            subject_path = os.path.join(sem_path, subject)
            if not os.path.isdir(subject_path):
                continue

            structure[sem][subject] = os.listdir(subject_path)

    return structure