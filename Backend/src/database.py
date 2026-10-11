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
    with engine.connect() as conn:
        from sqlalchemy import text

        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

        # Create all tables first
        Base.metadata.create_all(bind=engine)

        # Apply schema alterations for existing tables
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

        conn.commit()


def get_db() -> Generator[Session, None, None]:
    """Dependency for obtaining a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
