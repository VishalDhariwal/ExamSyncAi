"""
Lightweight embedding engine using FastEmbed (ONNX Runtime).
Replaces heavyweight PyTorch (~400MB+ RAM) with CPU-optimized ONNX runtime (<120MB RAM).
Produces identical 384-dimensional embeddings compatible with sentence-transformers/all-MiniLM-L6-v2.
"""
from typing import List, Optional
from fastembed import TextEmbedding


class FastEmbedWrapper:
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._model: Optional[TextEmbedding] = None

    @property
    def model(self) -> TextEmbedding:
        if self._model is None:
            self._model = TextEmbedding(model_name=self.model_name)
        return self._model

    def embed_query(self, text: str) -> List[float]:
        """Generate embedding vector for a single query string."""
        return list(self.model.embed([text]))[0].tolist()

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate embedding vectors for a list of document strings."""
        if not texts:
            return []
        return [vec.tolist() for vec in self.model.embed(texts)]


embeddings = FastEmbedWrapper()
