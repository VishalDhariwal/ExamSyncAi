# src/nodes/vision_node.py

from src.state import ExamState
from typing import Dict, Any
from PIL import Image
import io

def vision_node(state: ExamState) -> Dict[str, Any]:
     
    image_bytes = state.get("image_bytes")

    if image_bytes is None:
        return {}

    try:
        Image.open(io.BytesIO(image_bytes))  # validate image
        extracted_text = "Handwritten answer extracted (OCR placeholder)."
    except Exception:
        extracted_text = "Could not read image."

    return {"student_answers": [{"answer_text": extracted_text}]}
