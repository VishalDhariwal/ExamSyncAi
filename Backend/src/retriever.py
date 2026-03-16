from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")


def get_retriever(semester: int, k=4):
    vectorstore = Chroma(
        persist_directory=f"./chroma_db/sem{semester}",
        embedding_function=embeddings,
    )

    return vectorstore.as_retriever(search_kwargs={"k": k})
