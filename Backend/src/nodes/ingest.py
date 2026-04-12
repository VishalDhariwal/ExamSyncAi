import os
from langchain_community.document_loaders import PyPDFDirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

from pathlib import Path

def ingest_semester(semester_val: int, base_path="Data"):

    base_path = Path(base_path).resolve()
    semester_path = base_path / f"sem{semester_val}"

    if not semester_path.exists():
        raise ValueError(f"Semester path not found: {semester_path}")

    all_docs = []

    for subject_path in semester_path.iterdir():

        if not subject_path.is_dir():
            continue

        subject = subject_path.name

        for content_type_path in subject_path.iterdir():

            if not content_type_path.is_dir():
                continue

            content_type = content_type_path.name

            # TEXT FILES
            for file in content_type_path.glob("*.txt"):
                loader = TextLoader(str(file), encoding="utf-8")
                docs = loader.load()

                for doc in docs:
                    doc.metadata.update({
                        "semester": semester_val,
                        "subject": subject,
                        "type": content_type,
                        "source": file.name
                    })

                all_docs.extend(docs)

            # PDF FILES
            pdf_loader = PyPDFDirectoryLoader(str(content_type_path))
            pdf_docs = pdf_loader.load()

            for doc in pdf_docs:
                doc.metadata.update({
                    "semester": semester_val,
                    "subject": subject,
                    "type": content_type,
                    "source": doc.metadata.get("source", "")
                })

            all_docs.extend(pdf_docs)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100
    )

    splits = splitter.split_documents(all_docs)

    persist_dir = Path("./chroma_db") / f"sem{semester_val}"

    Chroma.from_documents(
        documents=splits,
        embedding=embeddings,
        persist_directory=str(persist_dir)
    )

    print(f"✅ Ingested semester {semester_val}")