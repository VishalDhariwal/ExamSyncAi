# src/nodes/vision_node.py

from typing import Dict, Any
from src.state import ExamState
from src.security import sanitize_image_bytes


def vision_node(state: ExamState) -> Dict[str, Any]:
    """
    Safely processes uploaded handwritten answer sheets.
    Sanitizes, downscales, and validates image bytes before OCR parsing.
    """
    image_bytes = state.get("image_bytes")

    if image_bytes is None:
        return {}

    try:
        # Security: Re-encodes, downscales (max 2560px), and checks MAX_IMAGE_PIXELS
        clean_bytes = sanitize_image_bytes(image_bytes)

        # Placeholder for OCR engine (e.g. Tesseract / Vision model)
        extracted_text = "Handwritten answer extracted from sanitized image."
    except ValueError as val_err:
        print(f"⚠️ Security rejection in vision_node: {val_err}")
        extracted_text = f"Invalid image upload: {val_err}"
    except Exception as e:
        print(f"Vision processing error: {e}")
        extracted_text = "Could not process image."

    return {"student_answers": [{"answer_text": extracted_text}]}
