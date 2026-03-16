import os
from langchain_community.document_loaders import PyPDFDirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings


embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")


def ingest_semester(semester_val: int, base_path="Data"):
    semester_path = os.path.join(base_path, f"sem{semester_val}")

    # 1. PDF files
    pdf_loader = PyPDFDirectoryLoader(semester_path)
    pdf_docs = pdf_loader.load()

    # 2. MD / TXT files
    md_docs = []
    for file in os.listdir(semester_path):
        if file.endswith(".md") or file.endswith(".txt"):
            loader = TextLoader(os.path.join(semester_path, file), encoding="utf-8")
            md_docs.extend(loader.load())

    all_docs = pdf_docs + md_docs

    # Add metadata
    for doc in all_docs:
        doc.metadata["semester"] = semester_val
        doc.metadata["source"] = os.path.basename(doc.metadata.get("source", ""))

    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
    splits = splitter.split_documents(all_docs)

    persist_dir = f"./chroma_db/sem{semester_val}"

    Chroma.from_documents(
        documents=splits,
        embedding=embeddings,
        persist_directory=persist_dir
    )

    print(f"✅ Semester {semester_val} ingested at {persist_dir}")
