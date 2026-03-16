from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
import os


def create_retriever():
    # Load markdown file
    loader = TextLoader("data/dbms.md", encoding="utf-8")
    documents = loader.load()

    # Split into chunks
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100
    )
    docs = splitter.split_documents(documents)

    # Create embeddings
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )

    # Create vector DB (persistent optional)
    vectorstore = Chroma.from_documents(
        docs,
        embeddings,
        persist_directory="chroma_db"
    )

    return vectorstore.as_retriever(search_kwargs={"k": 4})
