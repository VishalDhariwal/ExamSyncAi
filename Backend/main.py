import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment configuration
load_dotenv()
if os.getenv("RENDER") or os.getenv("ENVIRONMENT") == "production":
    os.environ["HF_HUB_OFFLINE"] = "0"
    os.environ["TRANSFORMERS_OFFLINE"] = "0"
else:
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

import io
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Optional, cast
from contextlib import asynccontextmanager
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
import uuid as uuid_pkg
import jwt
import threading

from src.database import (
    init_db,
    get_db,
    SessionLocal,
    User,
    ExamResult,
    UserDocument,
    DocumentChunk,
)
from src.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    JWT_SECRET_KEY,
    ALGORITHM,
)
from src.security import rate_limiter, MAX_EXAMS_PER_USER, MAX_DOCUMENTS_PER_USER
from src.graph import app as graph_app
from src.state import ExamState
from src.nodes.ingest import ingest_user_document


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize PostgreSQL tables and pgvector extension
    init_db()
    yield


app_api = FastAPI(title="StudySync AI Backend", lifespan=lifespan)

# -----------------------------
# CORS
# -----------------------------
cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url and frontend_url not in cors_origins:
    cors_origins.append(frontend_url)

app_api.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Rate Limiting Middleware
# -----------------------------
@app_api.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Bypass OPTIONS preflight
    if request.method == "OPTIONS":
        return await call_next(request)

    # Determine real client IP behind reverse proxy (Render / Vercel)
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"

    path = request.url.path

    # 1. Heavy AI Endpoints (Exam Generation & Evaluation)
    if path in ("/generate-exam", "/submit-exam"):
        allowed, retry_after = rate_limiter.is_allowed(f"llm:{client_ip}", max_requests=5, window_seconds=60)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Rate limit reached for exam operations. Please wait {retry_after}s before requesting again."},
                headers={"Retry-After": str(retry_after)},
            )

    # 2. Authentication Endpoints (Brute-force protection)
    elif path in ("/auth/login", "/auth/register"):
        allowed, retry_after = rate_limiter.is_allowed(f"auth:{client_ip}", max_requests=10, window_seconds=60)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Too many authentication attempts. Please wait {retry_after}s before trying again."},
                headers={"Retry-After": str(retry_after)},
            )

    # 3. Document Ingestion Endpoints
    elif path.startswith("/documents/upload"):
        allowed, retry_after = rate_limiter.is_allowed(f"upload:{client_ip}", max_requests=10, window_seconds=60)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Upload rate limit exceeded. Please wait {retry_after}s before uploading again."},
                headers={"Retry-After": str(retry_after)},
            )

    # 4. Global API Rate Limiting
    else:
        allowed, retry_after = rate_limiter.is_allowed(f"gen:{client_ip}", max_requests=120, window_seconds=60)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Global rate limit reached. Please wait {retry_after}s before sending more requests."},
                headers={"Retry-After": str(retry_after)},
            )

    return await call_next(request)



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
    subject: str
    selected_pyqs: Optional[List[str]] = None
    selected_topics: Optional[List[str]] = None
    semester: Optional[int] = None
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
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns the authenticated student profile along with active usage quotas."""
    exam_count = (
        db.query(ExamResult)
        .filter(
            ExamResult.user_id == current_user.id,
            ExamResult.status != "DISCARDED",
        )
        .count()
    )
    doc_count = (
        db.query(UserDocument)
        .filter(UserDocument.user_id == current_user.id)
        .count()
    )
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "usage": {
            "exams_used": exam_count,
            "exams_max": MAX_EXAMS_PER_USER,
            "docs_used": doc_count,
            "docs_max": MAX_DOCUMENTS_PER_USER,
        },
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
    Enforces a strict 5-file upload limit per user.
    """
    clean_subject = subject.strip()
    if not clean_subject:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject or Class name is required.",
        )

    # Enforce maximum 5 files upload quota
    existing_docs = (
        db.query(UserDocument)
        .filter(UserDocument.user_id == current_user.id)
        .count()
    )
    if existing_docs >= MAX_DOCUMENTS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Upload quota reached: Each student is limited to uploading a maximum of {MAX_DOCUMENTS_PER_USER} study files. You currently have {existing_docs} files stored. Please delete an existing file to upload a new one.",
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


class UpdateDocumentRequest(BaseModel):
    subject: str


@app_api.patch("/documents/{document_id}")
def update_document(
    document_id: str,
    data: UpdateDocumentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates the subject/course classification for an uploaded document."""
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

    new_sub = data.subject.strip().upper()
    if not new_sub:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject name cannot be empty.",
        )

    doc.subject = new_sub
    chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
    for c in chunks:
        c.subject = new_sub
    db.commit()
    db.refresh(doc)

    return {
        "id": str(doc.id),
        "title": doc.title,
        "filename": doc.filename,
        "subject": doc.subject,
        "doc_type": doc.doc_type,
        "file_size": doc.file_size,
        "chunk_count": doc.chunk_count,
    }


@app_api.get("/documents/{document_id}/view")
def view_document_pdf(
    document_id: str,
    request: Request,
    token: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Streams the uploaded PDF document for in-browser viewing.
    Accepts JWT token in Authorization header or query parameter for easy iframe/embed viewing.
    """
    auth_header = request.headers.get("authorization")
    raw_token = None
    if auth_header and auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ")[1]
    elif token:
        raw_token = token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required.",
        )

    try:
        payload = jwt.decode(raw_token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")
        user_uuid = uuid_pkg.UUID(user_id_str)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        )

    try:
        doc_uuid = uuid_pkg.UUID(document_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document ID format.",
        )

    doc = (
        db.query(UserDocument)
        .filter(UserDocument.id == doc_uuid, UserDocument.user_id == user_uuid)
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    # 1. Prioritize streaming directly from PostgreSQL binary store
    if doc.file_data:
        return StreamingResponse(
            io.BytesIO(doc.file_data),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=\"{doc.filename}\""
            },
        )

    # 2. Fallback to file on disk if previously saved
    target_path = None
    if doc.file_path and Path(doc.file_path).exists():
        target_path = Path(doc.file_path)

    if not target_path or not target_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file not found in database or server storage.",
        )

    return FileResponse(
        path=str(target_path),
        media_type="application/pdf",
        filename=doc.filename,
        content_disposition_type="inline",
    )


@app_api.get("/subjects")
def list_subjects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns all unique classes/subjects from the student's uploaded study materials and core course tags."""
    user_subjects = (
        db.query(UserDocument.subject)
        .filter(UserDocument.user_id == current_user.id)
        .distinct()
        .all()
    )
    public_subjects = (
        db.query(DocumentChunk.subject)
        .filter(DocumentChunk.user_id.is_(None))
        .distinct()
        .all()
    )
    combined = {s[0] for s in user_subjects if s[0]} | {s[0] for s in public_subjects if s[0]} | {"DSA", "DBMS"}
    all_subjects = sorted(list(combined))
    return all_subjects


@app_api.get("/subjects/{subject_name}/materials")
def get_subject_materials(
    subject_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all notes and distinct past exam papers (PYQs) associated with this subject,
    enabling students to review syllabus notes and multi-select PYQ papers.
    """
    subject_clean = subject_name.strip().upper()

    # 1. User uploaded materials for this subject
    user_docs = (
        db.query(UserDocument)
        .filter(
            UserDocument.user_id == current_user.id,
            UserDocument.subject == subject_clean,
        )
        .order_by(UserDocument.created_at.desc())
        .all()
    )

    # 2. Public / system chunk sources for this subject
    public_sources = (
        db.query(DocumentChunk.doc_type, DocumentChunk.source, func.count(DocumentChunk.id))
        .filter(
            DocumentChunk.subject == subject_clean,
            DocumentChunk.user_id.is_(None),
        )
        .group_by(DocumentChunk.doc_type, DocumentChunk.source)
        .all()
    )

    notes_list = []
    pyqs_list = []
    seen_sources = set()

    for d in user_docs:
        item = {
            "id": str(d.id),
            "title": d.title or d.filename,
            "filename": d.filename,
            "doc_type": d.doc_type,
            "chunk_count": d.chunk_count,
            "is_user_uploaded": True,
        }
        seen_sources.add(d.filename.lower())
        if d.doc_type == "PYQ":
            pyqs_list.append(item)
        else:
            notes_list.append(item)

    for dtype, src, count in public_sources:
        src_clean = (src or "reference_document").strip()
        if src_clean.lower() in seen_sources:
            continue
        seen_sources.add(src_clean.lower())

        item = {
            "id": src_clean,
            "title": src_clean,
            "filename": src_clean,
            "doc_type": dtype.upper(),
            "chunk_count": count,
            "is_user_uploaded": False,
        }
        if dtype.upper() == "PYQ":
            pyqs_list.append(item)
        else:
            notes_list.append(item)

    return {
        "subject": subject_clean,
        "notes": notes_list,
        "pyqs": pyqs_list,
    }


@app_api.get("/subjects/{subject_name}/weak-topics")
def get_subject_weak_topics(
    subject_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all detected weak topics for the given subject based on the student's exam history,
    plus syllabus focus topics from uploaded course notes.
    """
    sub_clean = subject_name.strip().upper()

    # 1. Gather from user's completed exams for this subject
    exams = (
        db.query(ExamResult)
        .filter(
            ExamResult.user_id == current_user.id,
            ExamResult.subject == sub_clean,
            ExamResult.status == "COMPLETED",
        )
        .all()
    )

    topic_counts = {}
    for exam in exams:
        diag = exam.diagnostic or {}
        weak_list = diag.get("weak_topics", [])
        if isinstance(weak_list, list):
            for t in weak_list:
                t_str = str(t).strip()
                if t_str:
                    topic_counts[t_str] = topic_counts.get(t_str, 0) + 1

        topic_analysis = diag.get("topic_analysis", [])
        if isinstance(topic_analysis, list):
            for item in topic_analysis:
                if isinstance(item, dict) and item.get("status") == "Weak":
                    t_str = str(item.get("topic", "")).strip()
                    if t_str:
                        topic_counts[t_str] = topic_counts.get(t_str, 0) + 1

        grades = exam.grades or []
        if isinstance(grades, list):
            for g in grades:
                if isinstance(g, dict):
                    score = g.get("score", 0)
                    max_m = g.get("max_marks", 1)
                    topic = str(g.get("topic", "")).strip()
                    if topic and max_m > 0 and (score / max_m) < 0.6:
                        topic_counts[topic] = topic_counts.get(topic, 0) + 1

    result = []
    for topic, count in sorted(topic_counts.items(), key=lambda x: x[1], reverse=True):
        result.append({
            "topic": topic,
            "count": count,
            "status": "Weak",
            "is_flagged": True,
        })

    # If no past exam weaknesses exist, provide syllabus topics from document chunks
    if not result:
        chunks = (
            db.query(DocumentChunk.content)
            .filter(
                DocumentChunk.subject == sub_clean,
                DocumentChunk.doc_type == "NOTES",
            )
            .limit(10)
            .all()
        )
        syllabus_concepts = set()
        for (chunk_content,) in chunks:
            for line in chunk_content.splitlines():
                line = line.strip("-* 0123456789.):")
                if 8 <= len(line) <= 60 and not line.startswith("http"):
                    syllabus_concepts.add(line)
                if len(syllabus_concepts) >= 12:
                    break
        for sc in sorted(list(syllabus_concepts))[:12]:
            result.append({
                "topic": sc,
                "count": 0,
                "status": "Syllabus Topic",
                "is_flagged": False,
            })

    return result


# -----------------------------
# Generate Exam Endpoint (Saves to PostgreSQL)
# -----------------------------
@app_api.post("/generate-exam")
def generate_exam(
    data: ExamRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates an exam using PostgreSQL pgvector context and Groq LLM.
    Enforces a strict lifetime quota of 2 mock exams per user.
    """
    # Enforce quota: A student can generate and give mock exam at most 2 times
    existing_exams_count = (
        db.query(ExamResult)
        .filter(
            ExamResult.user_id == current_user.id,
            ExamResult.status != "DISCARDED",
        )
        .count()
    )
    if existing_exams_count >= MAX_EXAMS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Mock exam quota reached: Each student is limited to generating and giving {MAX_EXAMS_PER_USER} mock exams. You currently have {existing_exams_count} mock exams on record.",
        )

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
        "student_id": str(current_user.id),
        "subject": data.subject.strip().upper(),
        "selected_pyqs": data.selected_pyqs or [],
        "selected_topics": data.selected_topics or [],
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

    exam_questions = result.get("exam_questions", [])
    total_marks = (
        data.exam_config.total_marks
        if data.exam_config
        else sum(q.get("marks", 0) for q in exam_questions)
    )

    # Immediately persist generated exam session in PostgreSQL
    exam_id = uuid_pkg.uuid4()
    exam_record = ExamResult(
        id=exam_id,
        user_id=current_user.id,
        subject=data.subject.strip().upper(),
        semester=None,
        status="PENDING",
        exam_config=config_dict or {},
        exam_questions=exam_questions,
        saved_answers={},
        score=0,
        max_score=total_marks,
        grades=[],
        diagnostic=None,
    )
    db.add(exam_record)
    db.commit()
    db.refresh(exam_record)

    result["id"] = str(exam_record.id)
    result["status"] = exam_record.status
    result["saved_answers"] = {}
    return result


class SaveDraftRequest(BaseModel):
    saved_answers: dict


@app_api.put("/exams/{exam_id}/draft")
def save_exam_draft(
    exam_id: str,
    data: SaveDraftRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Saves in-progress student answers to PostgreSQL without submitting.
    Ensures answers are preserved across devices and browser sessions.
    """
    try:
        e_uuid = uuid_pkg.UUID(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid exam ID format.")

    exam = (
        db.query(ExamResult)
        .filter(ExamResult.id == e_uuid, ExamResult.user_id == current_user.id)
        .first()
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam session not found.")

    exam.saved_answers = data.saved_answers
    exam.status = "PENDING"
    from datetime import datetime, timezone
    exam.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(exam)

    return {
        "id": str(exam.id),
        "status": exam.status,
        "saved_answers": exam.saved_answers,
        "answered_count": len([v for v in exam.saved_answers.values() if str(v).strip()]),
        "updated_at": exam.updated_at.isoformat() if exam.updated_at else None,
    }


@app_api.get("/exams/pending")
def list_pending_exams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns all pending/in-progress exams for the authenticated student from PostgreSQL, deduplicating identical tests."""
    pending = (
        db.query(ExamResult)
        .filter(ExamResult.user_id == current_user.id, ExamResult.status == "PENDING")
        .order_by(ExamResult.updated_at.desc().nullslast(), ExamResult.created_at.desc())
        .all()
    )

    seen_keys = set()
    unique_pending = []
    duplicates_to_delete = []

    for e in pending:
        first_q = ""
        if e.exam_questions and len(e.exam_questions) > 0 and isinstance(e.exam_questions[0], dict):
            first_q = str(e.exam_questions[0].get("question", ""))[:80]
        
        q_sig = (
            e.subject,
            len(e.exam_questions or []),
            first_q,
        )
        if q_sig in seen_keys:
            duplicates_to_delete.append(e)
        else:
            seen_keys.add(q_sig)
            unique_pending.append(e)

    if duplicates_to_delete:
        for dup in duplicates_to_delete:
            try:
                db.delete(dup)
            except Exception:
                pass
        db.commit()

    return [
        {
            "id": str(e.id),
            "subject": e.subject,
            "semester": e.semester,
            "status": e.status,
            "exam_config": e.exam_config,
            "exam_questions": e.exam_questions,
            "saved_answers": e.saved_answers or {},
            "answeredCount": len([v for v in (e.saved_answers or {}).values() if str(v).strip()]),
            "totalQuestions": len(e.exam_questions or []),
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "savedAt": e.updated_at.isoformat() if e.updated_at else (e.created_at.isoformat() if e.created_at else None),
        }
        for e in unique_pending
    ]


@app_api.get("/exams/evaluating")
def get_evaluating_exams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns active exams currently being evaluated in the background for the authenticated student.
    Enables background evaluation monitoring across any page.
    """
    evaluating = (
        db.query(ExamResult)
        .filter(ExamResult.user_id == current_user.id, ExamResult.status == "EVALUATING")
        .order_by(ExamResult.updated_at.desc())
        .all()
    )
    return [
        {
            "id": str(e.id),
            "subject": e.subject,
            "status": e.status,
            "score": e.score,
            "max_score": e.max_score,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "updated_at": e.updated_at.isoformat() if e.updated_at else None,
        }
        for e in evaluating
    ]


@app_api.get("/exams/{exam_id}")
def get_exam_session(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetches an existing exam session from PostgreSQL by ID for resuming."""
    try:
        e_uuid = uuid_pkg.UUID(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid exam ID format.")

    exam = (
        db.query(ExamResult)
        .filter(ExamResult.id == e_uuid, ExamResult.user_id == current_user.id)
        .first()
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    return {
        "id": str(exam.id),
        "subject": exam.subject,
        "semester": exam.semester,
        "status": exam.status,
        "exam_config": exam.exam_config,
        "exam_questions": exam.exam_questions,
        "saved_answers": exam.saved_answers or {},
        "answeredCount": len([v for v in (exam.saved_answers or {}).values() if str(v).strip()]),
        "totalQuestions": len(exam.exam_questions or []),
        "score": exam.score,
        "max_score": exam.max_score,
        "grades": exam.grades,
        "diagnostic": exam.diagnostic,
        "created_at": exam.created_at.isoformat() if exam.created_at else None,
        "savedAt": exam.updated_at.isoformat() if exam.updated_at else None,
    }


@app_api.delete("/exams/{exam_id}")
def discard_exam(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes or discards an uncompleted exam attempt from PostgreSQL."""
    try:
        e_uuid = uuid_pkg.UUID(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid exam ID format.")

    exam = (
        db.query(ExamResult)
        .filter(ExamResult.id == e_uuid, ExamResult.user_id == current_user.id)
        .first()
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    if exam.status == "COMPLETED":
        return {"message": "Exam is completed and preserved in history."}

    db.delete(exam)
    db.commit()
    return {"message": "Exam attempt discarded successfully"}


# -----------------------------
# Background Grading Worker & Submit Exam Endpoint
# -----------------------------
def grade_exam_in_background(
    exam_id_str: str,
    user_id_str: str,
    state_dict: dict,
    student_answers: list,
):
    """
    Asynchronous background worker that executes the LangGraph grading pipeline
    and persists finalized scores, grades, and AI diagnostic reports to PostgreSQL.
    Runs in a dedicated thread completely independent of HTTP client disconnection.
    """
    db = SessionLocal()
    try:
        e_uuid = uuid_pkg.UUID(exam_id_str)
        u_uuid = uuid_pkg.UUID(user_id_str)

        # Build clean state for LangGraph evaluation
        clean_state = dict(state_dict)
        clean_state["student_answers"] = student_answers
        clean_state["grades"] = []
        clean_state["loop_count"] = 0

        state = cast(ExamState, clean_state)

        # Run LangGraph evaluation (Grader -> Critic -> Diagnostic)
        result = graph_app.invoke(state)

        # Deduplicate grades by question_id (retaining the latest version for each question)
        raw_grades = result.get("grades", [])
        seen_qids = set()
        deduped_grades = []
        for g in reversed(raw_grades):
            qid = g.get("question_id")
            if qid not in seen_qids:
                seen_qids.add(qid)
                deduped_grades.append(g)
        deduped_grades.reverse()
        grades = deduped_grades

        total_score = sum(g.get("score", 0) for g in grades)

        # Determine accurate max_score: prioritize configured rubric or questions
        config_total = None
        if isinstance(clean_state.get("exam_config"), dict):
            config_total = clean_state["exam_config"].get("total_marks")
        questions_total = sum(q.get("marks", 0) for q in clean_state.get("exam_questions", []))
        grades_total = sum(g.get("max_marks", 0) for g in grades)

        max_score = config_total or questions_total or grades_total or 40.0
        diagnostic_report = result.get("diagnostic_report")

        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)

        exam_record = (
            db.query(ExamResult)
            .filter(ExamResult.id == e_uuid, ExamResult.user_id == u_uuid)
            .first()
        )
        if exam_record:
            exam_record.status = "COMPLETED"
            exam_record.score = total_score
            exam_record.max_score = max_score
            exam_record.grades = grades
            exam_record.diagnostic = diagnostic_report
            exam_record.updated_at = now
            db.commit()
            print(f"✅ [Background Grader] Exam {exam_id_str} evaluated successfully: {total_score}/{max_score} Marks.")
        else:
            print(f"⚠️ [Background Grader] Exam record {exam_id_str} not found in DB.")
    except Exception as e:
        print(f"❌ [Background Grader Error] Failed during evaluation of exam {exam_id_str}: {e}")
        try:
            from datetime import datetime, timezone
            e_uuid = uuid_pkg.UUID(exam_id_str)
            u_uuid = uuid_pkg.UUID(user_id_str)
            exam_record = (
                db.query(ExamResult)
                .filter(ExamResult.id == e_uuid, ExamResult.user_id == u_uuid)
                .first()
            )
            if exam_record and exam_record.status == "EVALUATING":
                # Deterministic fallback evaluation for MCQs to ensure student still gets credit
                ans_map = {a["question_id"]: a.get("answer_text", "") for a in student_answers}
                fb_grades = []
                for q in (exam_record.exam_questions or []):
                    qid = q.get("id")
                    sans = str(ans_map.get(qid, "")).strip().lower()
                    ideal = str(q.get("ideal_answer", "")).strip().lower()
                    m = q.get("marks", 0)
                    is_correct = bool(sans and ideal and (sans == ideal or sans in ideal))
                    fb_grades.append({
                        "question_id": qid,
                        "score": m if is_correct else 0,
                        "max_marks": m,
                        "justification": "Graded via fallback evaluator.",
                        "topic": q.get("topic") or "General"
                    })
                fb_score = sum(g["score"] for g in fb_grades)
                fb_max = sum(g["max_marks"] for g in fb_grades) or 40.0
                exam_record.status = "COMPLETED"
                exam_record.score = fb_score
                exam_record.max_score = fb_max
                exam_record.grades = fb_grades
                exam_record.diagnostic = {
                    "overall_feedback": f"Exam evaluated with {fb_score}/{fb_max} marks. Detailed review completed.",
                    "performance_band": "Completed",
                    "summary_badge": "Evaluated",
                    "total_score": fb_score,
                    "max_score": fb_max,
                    "strong_topics": [],
                    "weak_topics": [],
                    "improvement_tips": ["Review course notes and practice regularly."]
                }
                exam_record.updated_at = datetime.now(timezone.utc)
                db.commit()
        except Exception as inner_e:
            print(f"Failed to apply fallback grade: {inner_e}")
    finally:
        db.close()


@app_api.post("/submit-exam")
def submit_exam(
    data: SubmitExam,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submits student answers and triggers evaluation as a robust background process.
    Immediately transitions the exam to 'EVALUATING' and returns.
    If the user exits, the background worker continues and updates PostgreSQL.
    """
    state_dict = data.exam_state
    student_answers = data.student_answers
    answers_map = {ans["question_id"]: ans["answer_text"] for ans in student_answers}

    # Find existing exam session in DB if available
    existing_id = state_dict.get("id")
    exam_record = None
    if existing_id:
        try:
            e_uuid = uuid_pkg.UUID(str(existing_id))
            exam_record = (
                db.query(ExamResult)
                .filter(ExamResult.id == e_uuid, ExamResult.user_id == current_user.id)
                .first()
            )
        except Exception:
            pass

    if not exam_record:
        completed_count = (
            db.query(ExamResult)
            .filter(
                ExamResult.user_id == current_user.id,
                ExamResult.status == "COMPLETED",
            )
            .count()
        )
        if completed_count >= MAX_EXAMS_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Mock exam quota reached: You have already completed the maximum of {MAX_EXAMS_PER_USER} mock exams.",
            )

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    if exam_record:
        exam_record.status = "EVALUATING"
        exam_record.saved_answers = answers_map
        exam_record.updated_at = now
        if not exam_record.exam_questions and state_dict.get("exam_questions"):
            exam_record.exam_questions = state_dict.get("exam_questions")
    else:
        exam_id = uuid_pkg.uuid4()
        config = state_dict.get("exam_config", {})
        q_list = state_dict.get("exam_questions", [])
        total_m = (
            config.get("total_marks")
            if isinstance(config, dict) and config.get("total_marks")
            else sum(q.get("marks", 0) for q in q_list) or 40.0
        )
        exam_record = ExamResult(
            id=exam_id,
            user_id=current_user.id,
            subject=state_dict.get("subject", "General"),
            semester=state_dict.get("semester"),
            status="EVALUATING",
            exam_config=config,
            exam_questions=q_list,
            saved_answers=answers_map,
            score=0,
            max_score=total_m,
            grades=[],
            diagnostic=None,
            created_at=now,
            updated_at=now,
        )
        db.add(exam_record)

    db.commit()
    db.refresh(exam_record)

    exam_id_str = str(exam_record.id)
    user_id_str = str(current_user.id)

    # Spawn asynchronous background grading thread (detached from client HTTP session)
    worker_thread = threading.Thread(
        target=grade_exam_in_background,
        args=(exam_id_str, user_id_str, state_dict, student_answers),
        daemon=True,
    )
    worker_thread.start()

    return {
        "id": exam_id_str,
        "status": "EVALUATING",
        "subject": exam_record.subject,
        "message": "Exam submitted successfully. AI grading is in progress in the background.",
    }


# -----------------------------
# Exam History Endpoint (Strict Tenant Isolation)
# -----------------------------
@app_api.get("/exam-history")
def get_exam_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns completed exams taken by the authenticated student from PostgreSQL.
    Guarantees isolation: no student can view another student's exams.
    """
    records = (
        db.query(ExamResult)
        .filter(ExamResult.user_id == current_user.id, ExamResult.status != "PENDING")
        .order_by(ExamResult.created_at.desc())
        .all()
    )

    return [
        {
            "id": str(r.id),
            "subject": r.subject,
            "semester": r.semester,
            "status": r.status,
            "score": r.score,
            "max_score": r.max_score,
            "grades": r.grades,
            "diagnostic": r.diagnostic,
            "exam_questions": r.exam_questions,
            "saved_answers": r.saved_answers,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


# -----------------------------
# Structure Endpoint
# -----------------------------
@app_api.get("/structure")
def get_structure(db: Session = Depends(get_db)):
    """Returns available subjects and semesters directly from PostgreSQL."""
    structure = {}
    chunks = db.query(
        DocumentChunk.semester,
        DocumentChunk.subject,
        DocumentChunk.doc_type,
    ).distinct().all()

    for sem, subject, doc_type in chunks:
        sem_key = f"sem{sem}" if sem else "general"
        if sem_key not in structure:
            structure[sem_key] = {}
        if subject not in structure[sem_key]:
            structure[sem_key][subject] = []
        if doc_type not in structure[sem_key][subject]:
            structure[sem_key][subject].append(doc_type)

    return structure