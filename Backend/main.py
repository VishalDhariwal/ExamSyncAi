import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment configuration
load_dotenv()
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Optional, cast
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
import uuid as uuid_pkg

from src.database import (
    init_db,
    get_db,
    User,
    ExamResult,
    UserDocument,
    DocumentChunk,
)
from src.auth import hash_password, verify_password, create_access_token, get_current_user
from src.graph import app as graph_app
from src.state import ExamState
from src.nodes.ingest import ingest_user_document


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


class QuestionTierConfig(BaseModel):
    type: str  # "mcq" | "short" | "medium" | "long"
    marks: int
    count: int


class ExamConfig(BaseModel):
    total_marks: int
    breakdown: List[QuestionTierConfig]


class ExamRequest(BaseModel):
    student_id: Optional[str] = None
    semester: Optional[int] = None
    subject: str
    exam_config: Optional[ExamConfig] = None


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
# Document Management & Ingestion Endpoints
# -----------------------------
@app_api.post("/documents/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    subject: str = Form(...),
    doc_type: str = Form("NOTES"),
    semester: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Uploads and safely parses a study document (PDF or TXT/MD),
    chunks it, computes vector embeddings, and links it to the user.
    """
    clean_subject = subject.strip()
    if not clean_subject:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject or Class name is required.",
        )

    file_bytes = await file.read()
    try:
        doc = ingest_user_document(
            user_id=current_user.id,
            file_bytes=file_bytes,
            filename=file.filename or "uploaded_document.pdf",
            subject=clean_subject,
            doc_type=doc_type,
            semester=semester,
            db=db,
        )
        return {
            "id": str(doc.id),
            "title": doc.title,
            "filename": doc.filename,
            "subject": doc.subject,
            "doc_type": doc.doc_type,
            "file_size": doc.file_size,
            "chunk_count": doc.chunk_count,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document processing error: {e}",
        )


@app_api.get("/documents")
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists all study materials uploaded by the authenticated student."""
    docs = (
        db.query(UserDocument)
        .filter(UserDocument.user_id == current_user.id)
        .order_by(UserDocument.created_at.desc())
        .all()
    )
    return [
        {
            "id": str(d.id),
            "title": d.title,
            "filename": d.filename,
            "subject": d.subject,
            "doc_type": d.doc_type,
            "file_size": d.file_size,
            "chunk_count": d.chunk_count,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]


@app_api.delete("/documents/{document_id}")
def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes an uploaded document and its vector chunks."""
    try:
        doc_uuid = uuid_pkg.UUID(document_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document ID format.",
        )

    doc = (
        db.query(UserDocument)
        .filter(UserDocument.id == doc_uuid, UserDocument.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete()
    db.delete(doc)
    db.commit()
    return {"message": "Document deleted successfully"}


@app_api.get("/subjects")
def list_subjects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns all unique classes/subjects available to the student."""
    user_subjects = (
        db.query(UserDocument.subject)
        .filter(UserDocument.user_id == current_user.id)
        .distinct()
        .all()
    )
    chunk_subjects = (
        db.query(DocumentChunk.subject)
        .filter(DocumentChunk.user_id.is_(None))
        .distinct()
        .all()
    )
    all_subjects = sorted(list({s[0] for s in user_subjects + chunk_subjects if s[0]}))
    return all_subjects


# -----------------------------
# Generate Exam Endpoint
# -----------------------------
@app_api.post("/generate-exam")
def generate_exam(data: ExamRequest):
    """
    Generates an exam using PostgreSQL pgvector context and Groq LLM.
    Supports user-customized rubrics (total marks, MCQs, short/long breakdowns)
    with strict mathematical total validation.
    """
    config_dict = None
    if data.exam_config:
        if data.exam_config.total_marks <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Total marks must be greater than 0.",
            )

        computed_total = sum(t.marks * t.count for t in data.exam_config.breakdown)
        if computed_total != data.exam_config.total_marks:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rubric validation failed: Sum of question marks ({computed_total}) does not equal total marks ({data.exam_config.total_marks}).",
            )
        config_dict = data.exam_config.model_dump()

    state_dict = {
        "student_id": data.student_id or "guest",
        "semester": data.semester,
        "subject": data.subject.strip().upper(),
        "exam_config": config_dict,
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
        semester=result.get("semester", state.get("semester")),
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