import os
import uuid
from datetime import datetime, timezone
from typing import Generator
from dotenv import load_dotenv

from sqlalchemy import (
    create_engine,
    Column,
    String,
    Integer,
    Float,
    Text,
    DateTime,
    ForeignKey,
    Index,
    LargeBinary,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session
from pgvector.sqlalchemy import Vector

load_dotenv()

# Database Connection URL (Defaults to local PostgreSQL)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://vishaldhariwal@localhost:5432/examsync_db",
)

# Standardize cloud PostgreSQL URL scheme for psycopg2 compatibility
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+psycopg2://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ----------------------------------------------------
# 1. Users Table (Secure Credentials & Profiles)
# ----------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    exam_results = relationship(
        "ExamResult", back_populates="user", cascade="all, delete-orphan"
    )
    documents = relationship(
        "UserDocument", back_populates="user", cascade="all, delete-orphan"
    )


# ----------------------------------------------------
# 2. User Documents Table (Uploaded Study Materials)
# ----------------------------------------------------
class UserDocument(Base):
    __tablename__ = "user_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    subject = Column(String(100), nullable=False, index=True)
    doc_type = Column(String(50), nullable=False, default="NOTES")  # 'NOTES' or 'PYQ'
    file_size = Column(Integer, nullable=False, default=0)
    chunk_count = Column(Integer, nullable=False, default=0)
    file_path = Column(String(512), nullable=True)
    file_data = Column(LargeBinary, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # Relationships
    user = relationship("User", back_populates="documents")
    chunks = relationship(
        "DocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan",
    )


# ----------------------------------------------------
# 3. Exam Results Table (Isolated Student Submissions)
# ----------------------------------------------------
class ExamResult(Base):
    __tablename__ = "exam_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subject = Column(String(100), nullable=False, index=True)
    semester = Column(Integer, nullable=True, index=True)
    status = Column(String(50), nullable=False, default="PENDING", index=True)  # 'PENDING', 'COMPLETED', 'DISCARDED'
    exam_config = Column(JSONB, nullable=False, default=dict)
    exam_questions = Column(JSONB, nullable=False, default=list)
    saved_answers = Column(JSONB, nullable=False, default=dict)
    score = Column(Float, nullable=False, default=0.0)
    max_score = Column(Float, nullable=False, default=0.0)
    grades = Column(JSONB, nullable=False, default=list)
    diagnostic = Column(JSONB, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship back to User
    user = relationship("User", back_populates="exam_results")


# ----------------------------------------------------
# 4. Document Chunks Table (RAG & pgvector Store)
# ----------------------------------------------------
class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_documents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    semester = Column(Integer, nullable=True, index=True)
    subject = Column(String(100), nullable=False, index=True)
    doc_type = Column(String(50), nullable=False, default="NOTES", index=True)  # 'NOTES' or 'PYQ'
    source = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(384), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    document = relationship("UserDocument", back_populates="chunks")

    __table_args__ = (
        Index("idx_doc_chunks_sem_subj_type", "semester", "subject", "doc_type"),
        Index("idx_doc_chunks_user_subject", "user_id", "subject", "doc_type"),
    )


def init_db():
    """Initializes extension, tables, and applies forward schema alterations."""
    from sqlalchemy import text

    # Step 1: Ensure vector extension exists and commit immediately
    with engine.begin() as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        except Exception as e:
            print(f"Vector extension note: {e}")

    # Step 2: Create all tables
    Base.metadata.create_all(bind=engine)

    # Step 3: Apply backward-compatible schema alterations
    with engine.begin() as conn:
        alterations = [
            "ALTER TABLE document_chunks ALTER COLUMN semester DROP NOT NULL;",
            "ALTER TABLE exam_results ALTER COLUMN semester DROP NOT NULL;",
            "ALTER TABLE exam_results ALTER COLUMN score TYPE DOUBLE PRECISION;",
            "ALTER TABLE exam_results ALTER COLUMN max_score TYPE DOUBLE PRECISION;",
            "ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;",
            "ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES user_documents(id) ON DELETE CASCADE;",
        ]
        for sql in alterations:
            try:
                conn.execute(text(sql))
            except Exception as e:
                print(f"Migration note for '{sql}': {e}")

    # Step 4: Repair any historical completed exam records with duplicated grades or inflated max_score
    try:
        with SessionLocal() as db:
            records = db.query(ExamResult).filter(ExamResult.status == "COMPLETED").all()
            repaired_count = 0
            for r in records:
                if not r.grades:
                    continue
                seen_qids = set()
                deduped = []
                has_duplicates = False
                for g in reversed(r.grades):
                    qid = g.get("question_id")
                    if qid in seen_qids:
                        has_duplicates = True
                    else:
                        seen_qids.add(qid)
                        deduped.append(g)
                deduped.reverse()

                cfg_marks = (
                    r.exam_config.get("total_marks")
                    if isinstance(r.exam_config, dict)
                    else None
                )
                q_marks = sum(q.get("marks", 0) for q in (r.exam_questions or []))
                true_max = cfg_marks or q_marks or sum(g.get("max_marks", 0) for g in deduped)

                if has_duplicates or (true_max and r.max_score > true_max):
                    r.grades = deduped
                    r.score = sum(g.get("score", 0) for g in deduped)
                    r.max_score = true_max
                    repaired_count += 1
            if repaired_count > 0:
                db.commit()
                print(f"Repaired {repaired_count} historical exam records with duplicate grades/inflated max_score.")
    except Exception as e:
        print(f"Historical exam records repair note: {e}")

    # Step 5: Stuck-exam recovery check (recovers exams interrupted by server restarts or crashes during background evaluation)
    try:
        with SessionLocal() as db:
            stuck_records = db.query(ExamResult).filter(ExamResult.status == "EVALUATING").all()
            if stuck_records:
                print(f"⚠️ [Startup Recovery] Found {len(stuck_records)} exam(s) in EVALUATING state from previous server session. Recovering...")
                recovered_count = 0
                for r in stuck_records:
                    ans_map = r.saved_answers or {}
                    q_list = r.exam_questions or []
                    fb_grades = []
                    for q in q_list:
                        qid = q.get("id")
                        sans = str(ans_map.get(str(qid), ans_map.get(qid, ""))).strip().lower()
                        ideal = str(q.get("ideal_answer", "")).strip().lower()
                        m = float(q.get("marks", 0))
                        is_correct = bool(sans and ideal and (sans == ideal or sans in ideal))
                        fb_grades.append({
                            "question_id": qid,
                            "score": m if is_correct else 0.0,
                            "max_marks": m,
                            "justification": "Graded via system startup recovery evaluator after server restart.",
                            "topic": q.get("topic") or "General",
                        })
                    fb_score = sum(g["score"] for g in fb_grades)
                    cfg_total = (
                        r.exam_config.get("total_marks")
                        if isinstance(r.exam_config, dict)
                        else None
                    )
                    q_total = sum(q.get("marks", 0) for q in q_list)
                    fb_max = cfg_total or q_total or sum(g["max_marks"] for g in fb_grades) or 40.0

                    r.status = "COMPLETED"
                    r.score = fb_score
                    r.max_score = fb_max
                    r.grades = fb_grades
                    r.diagnostic = {
                        "overall_feedback": f"Your exam was automatically recovered and finalized after a server reload. Score: {fb_score}/{fb_max} Marks.",
                        "performance_band": "Completed",
                        "summary_badge": "Recovered",
                        "total_score": fb_score,
                        "max_score": fb_max,
                        "strong_topics": [],
                        "weak_topics": [],
                        "improvement_tips": ["Review test concepts and continue practicing with mock exams."]
                    }
                    r.updated_at = datetime.now(timezone.utc)
                    recovered_count += 1
                if recovered_count > 0:
                    db.commit()
                    print(f"✅ [Startup Recovery] Successfully recovered and finalized {recovered_count} stuck exam(s).")
    except Exception as e:
        print(f"Stuck exam recovery note: {e}")



def get_db() -> Generator[Session, None, None]:
    """Dependency for obtaining a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
