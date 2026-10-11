import os
from pathlib import Path
from langchain_community.document_loaders import PyPDFDirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings

from src.database import SessionLocal, DocumentChunk, init_db

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")


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