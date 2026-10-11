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
    Text,
    DateTime,
    ForeignKey,
    Index,
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


# ----------------------------------------------------
# 2. Exam Results Table (Isolated Student Submissions)
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
    semester = Column(Integer, nullable=False, index=True)
    score = Column(Integer, nullable=False, default=0)
    max_score = Column(Integer, nullable=False, default=0)
    grades = Column(JSONB, nullable=False, default=list)
    diagnostic = Column(JSONB, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # Relationship back to User
    user = relationship("User", back_populates="exam_results")


# ----------------------------------------------------
# 3. Document Chunks Table (RAG & pgvector Store)
# ----------------------------------------------------
class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    semester = Column(Integer, nullable=False, index=True)
    subject = Column(String(100), nullable=False, index=True)
    doc_type = Column(String(50), nullable=False, index=True)  # 'NOTES' or 'PYQ'
    source = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(384), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_doc_chunks_sem_subj_type", "semester", "subject", "doc_type"),
    )


def init_db():
    """Initializes extension and creates all database tables."""
    with engine.connect() as conn:
        from sqlalchemy import text
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency for obtaining a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
