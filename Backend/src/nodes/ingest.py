import os
import io
import uuid
from pathlib import Path
from typing import Optional
from sqlalchemy.orm import Session
from langchain_community.document_loaders import PyPDFDirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings

from src.database import SessionLocal, DocumentChunk, UserDocument, init_db
from src.security import MAX_PDF_SIZE_BYTES

embeddings = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2",
    model_kwargs={"local_files_only": True},
)


def ingest_semester(semester_val: int, base_path="Data"):
    """
    Reads semester course documents (Notes & PYQs), chunks them,
    computes embeddings, and stores them in PostgreSQL document_chunks (pgvector).
    """
    init_db()

    base_path = Path(base_path).resolve()
    semester_path = base_path / f"sem{semester_val}"

    if not semester_path.exists():
        raise ValueError(f"Semester path not found: {semester_path}")

    all_docs = []

    for subject_path in semester_path.iterdir():
        if not subject_path.is_dir():
            continue

        subject = subject_path.name.upper()

        for content_type_path in subject_path.iterdir():
            if not content_type_path.is_dir():
                continue

            content_type = content_type_path.name.upper()

            # 1. TEXT FILES
            for file in content_type_path.glob("*.txt"):
                loader = TextLoader(str(file), encoding="utf-8")
                docs = loader.load()

                for doc in docs:
                    doc.metadata.update({
                        "semester": semester_val,
                        "subject": subject,
                        "type": content_type,
                        "source": file.name,
                    })

                all_docs.extend(docs)

            # 2. PDF FILES (Hardened with Magic Byte Validation & Size Limits)
            for pdf_file in content_type_path.glob("*.pdf"):
                try:
                    if pdf_file.stat().st_size > 15 * 1024 * 1024:
                        print(f"⚠️ Skipping {pdf_file.name}: exceeds 15MB size limit.")
                        continue

                    # Validate PDF Magic Bytes (%PDF-)
                    with open(pdf_file, "rb") as f:
                        header = f.read(5)
                        if not header.startswith(b"%PDF-"):
                            print(f"⚠️ Skipping {pdf_file.name}: Invalid PDF magic bytes.")
                            continue

                    from langchain_community.document_loaders import PyPDFLoader
                    pdf_loader = PyPDFLoader(str(pdf_file))
                    pdf_docs = pdf_loader.load()

                    for doc in pdf_docs:
                        doc.metadata.update({
                            "semester": semester_val,
                            "subject": subject,
                            "type": content_type,
                            "source": pdf_file.name,
                        })

                    all_docs.extend(pdf_docs)
                except Exception as e:
                    print(f"Error loading {pdf_file.name}: {e}")

    if not all_docs:
        print(f"No documents found for semester {semester_val}")
        return

    # Split documents into chunks
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100,
    )
    splits = splitter.split_documents(all_docs)

    # Compute embeddings in batch
    texts = [doc.page_content for doc in splits]
    raw_embeddings = embeddings.embed_documents(texts)

    # Save to PostgreSQL
    db = SessionLocal()
    try:
        # Clear previous chunks for this semester to avoid duplicates
        db.query(DocumentChunk).filter(DocumentChunk.semester == semester_val).delete()

        chunks_to_add = []
        for doc, emb in zip(splits, raw_embeddings):
            chunk = DocumentChunk(
                semester=doc.metadata.get("semester", semester_val),
                subject=doc.metadata.get("subject", "GENERAL").upper(),
                doc_type=doc.metadata.get("type", "NOTES").upper(),
                source=doc.metadata.get("source", ""),
                content=doc.page_content,
                embedding=emb,
            )
            chunks_to_add.append(chunk)

        db.bulk_save_objects(chunks_to_add)
        db.commit()
        print(f"✅ Ingested {len(chunks_to_add)} chunks for semester {semester_val} into PostgreSQL!")
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def ingest_user_document(
    user_id: uuid.UUID,
    file_bytes: bytes,
    filename: str,
    subject: str,
    doc_type: str = "NOTES",
    semester: Optional[int] = None,
    db: Optional[Session] = None,
) -> UserDocument:
    """
    Safely parses an uploaded study document (PDF or TXT/MD), chunks it,
    computes dense vector embeddings, and persists the document and chunks
    in PostgreSQL pgvector linked to the authenticated user.
    """
    if not file_bytes:
        raise ValueError("Uploaded file is empty.")

    clean_filename = filename.strip()
    ext = clean_filename.rsplit(".", 1)[-1].lower() if "." in clean_filename else ""

    # Size validations
    if ext == "pdf":
        if len(file_bytes) > MAX_PDF_SIZE_BYTES:
            raise ValueError(
                f"PDF exceeds maximum allowed size of {MAX_PDF_SIZE_BYTES // (1024 * 1024)} MB."
            )
        # Validate PDF Magic Bytes (%PDF-)
        if not file_bytes.startswith(b"%PDF-"):
            raise ValueError("Invalid PDF file signature.")

        # Extract text safely using pypdf
        import pypdf
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            text_parts = []
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text_parts.append(extracted)
            raw_text = "\n\n".join(text_parts).strip()
        except Exception as e:
            raise ValueError(f"Failed to extract readable text from PDF: {e}")

    elif ext in ("txt", "md", "text"):
        if len(file_bytes) > 10 * 1024 * 1024:
            raise ValueError("Text file exceeds maximum allowed size of 10 MB.")
        try:
            raw_text = file_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            raw_text = file_bytes.decode("latin-1", errors="ignore").strip()
    else:
        raise ValueError("Unsupported file type. Please upload a PDF or TXT/MD document.")

    if not raw_text or len(raw_text.strip()) < 20:
        raise ValueError(
            "Could not extract sufficient text from this document. Please ensure the document has readable text."
        )

    # Split into chunks
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100,
    )
    chunks_text = splitter.split_text(raw_text)

    if not chunks_text:
        raise ValueError("Document could not be chunked into meaningful text segments.")

    # Compute embeddings
    raw_embeddings = embeddings.embed_documents(chunks_text)

    # Persist in DB
    local_session = False
    if db is None:
        db = SessionLocal()
        local_session = True

    try:
        clean_subject = subject.strip().upper()
        clean_doc_type = doc_type.strip().upper()
        if clean_doc_type not in ("NOTES", "PYQ"):
            clean_doc_type = "NOTES"

        user_doc_id = uuid.uuid4()

        user_doc = UserDocument(
            id=user_doc_id,
            user_id=user_id,
            title=clean_filename,
            filename=clean_filename,
            subject=clean_subject,
            doc_type=clean_doc_type,
            file_size=len(file_bytes),
            chunk_count=len(chunks_text),
            file_path=None,
            file_data=file_bytes,
        )
        db.add(user_doc)
        db.flush()

        chunks_to_add = []
        for text_chunk, emb in zip(chunks_text, raw_embeddings):
            chunk = DocumentChunk(
                user_id=user_id,
                document_id=user_doc.id,
                semester=semester,
                subject=clean_subject,
                doc_type=clean_doc_type,
                source=clean_filename,
                content=text_chunk,
                embedding=emb,
            )
            chunks_to_add.append(chunk)

        db.bulk_save_objects(chunks_to_add)
        db.commit()
        db.refresh(user_doc)
        return user_doc

    except Exception as e:
        db.rollback()
        raise e
    finally:
        if local_session:
            db.close()