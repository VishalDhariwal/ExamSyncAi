import io
import re
import uuid
from typing import Dict, Any, Optional
from PIL import Image

# ----------------------------------------------------
# 1. Image Security Configurations (Issue 1 & 2)
# ----------------------------------------------------
# Mitigates decompression / pixel bombs (prevents OOM memory crashes)
Image.MAX_IMAGE_PIXELS = 10_000_000  # Cap at ~10 Megapixels

MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024    # 15 MB
MAX_IMAGE_DIMENSION = 2560               # Sweet spot for handwritten legibility


# ----------------------------------------------------
# 2. Magic Byte Signatures (Issue 3 & 5)
# ----------------------------------------------------
SIGNATURES = {
    "pdf": [b"%PDF-"],
    "jpeg": [b"\xFF\xD8\xFF"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "webp": [b"RIFF"],
}


def validate_file_signature(data: bytes, expected_type: str) -> bool:
    """
    Validates file magic bytes to prevent fake extensions and executable polyglots.
    """
    if not data:
        return False

    expected_type = expected_type.lower()

    if expected_type in ("image", "img"):
        for img_type in ("jpeg", "png", "webp"):
            for sig in SIGNATURES[img_type]:
                if data.startswith(sig):
                    return True
        return False

    if expected_type in SIGNATURES:
        for sig in SIGNATURES[expected_type]:
            if data.startswith(sig):
                return True

    return False


# ----------------------------------------------------
# 3. Image Sanitization & Re-Encoding (Issues 1, 2, 3)
# ----------------------------------------------------
def sanitize_image_bytes(raw_bytes: bytes) -> bytes:
    """
    Validates, downscales, and re-encodes image bytes into a clean JPEG buffer.
    Strips EXIF metadata, embedded malware, and polyglot payloads.
    """
    if not raw_bytes:
        raise ValueError("Image data is empty.")

    if len(raw_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise ValueError(
            f"Image exceeds maximum permitted file size of {MAX_IMAGE_SIZE_BYTES // (1024 * 1024)} MB."
        )

    # 1. Verify structure
    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            img.verify()
    except Exception as e:
        raise ValueError(f"Corrupt or malformed image data: {e}")

    # 2. Re-open, convert to RGB, and downscale
    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            img = img.convert("RGB")

            # Downscale proportionally if larger than maximum dimension
            if max(img.size) > MAX_IMAGE_DIMENSION:
                img.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.Resampling.LANCZOS)

            clean_buffer = io.BytesIO()
            img.save(clean_buffer, format="JPEG", quality=90, optimize=True)
            return clean_buffer.getvalue()
    except Exception as e:
        raise ValueError(f"Failed to sanitize and re-encode image: {e}")


# ----------------------------------------------------
# 4. Safe Filename Generation (Issue 4)
# ----------------------------------------------------
def safe_storage_key(original_filename_or_ext: str = "bin") -> str:
    """
    Generates a cryptographically random UUID filename.
    Discards user-supplied paths and retains only clean alphanumeric extensions.
    """
    # Extract only clean alphanumeric extension (e.g. "pdf", "jpg", "png")
    ext = original_filename_or_ext.split(".")[-1].lower()
    ext = re.sub(r"[^a-zA-Z0-9]", "", ext) or "bin"
    return f"{uuid.uuid4().hex}.{ext}"


# ----------------------------------------------------
# 5. Prompt Injection Defense (Issue 6)
# ----------------------------------------------------
def wrap_untrusted_input(text: str) -> str:
    """
    Wraps student response in strict XML boundaries for prompt isolation.
    """
    cleaned = (text or "").strip()
    return f"<student_untrusted_input>\n{cleaned}\n</student_untrusted_input>"


# ----------------------------------------------------
# 6. Intent & Telemetry Scanner (Issue 7 & 8)
# ----------------------------------------------------
SUSPICIOUS_PATTERNS = [
    # Prompt injection patterns
    r"ignore\s+(all\s+)?(previous|prior)\s+instructions",
    r"system\s+override",
    r"award\s+(me\s+)?(full|\d+)\s+marks",
    r"you\s+are\s+now\s+a",
    # Chatbot & homework/LeetCode solicitation
    r"write\s+(a\s+)?(python|cpp|c\+\+|java|javascript|sql)\s+(program|code|script|function)",
    r"solve\s+(this\s+)?(leetcode|problem|equation|assignment)",
    r"give\s+me\s+the\s+(solution|code)",
]


def scan_intent_telemetry(text: str) -> Dict[str, Any]:
    """
    Detects potential jailbreaks, prompt injections, or chatbot solicitations.
    Used for audit logging and telemetry without falsely rejecting valid CS terminology.
    """
    if not text:
        return {"is_suspicious": False, "matched_patterns": []}

    matches = []
    for pattern in SUSPICIOUS_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            matches.append(pattern)

    return {
        "is_suspicious": len(matches) > 0,
        "matched_patterns": matches,
    }


# ----------------------------------------------------
# 7. Output Sanitization & Score Clamping (Issue 8)
# ----------------------------------------------------
CODE_BLOCK_REGEX = re.compile(r"```[a-zA-Z0-9_\+\-]*\n[\s\S]*?```")


def sanitize_grader_output(
    parsed_json: Dict[str, Any],
    ideal_answer: str,
    max_marks: int,
) -> Dict[str, Any]:
    """
    1. Clamps score between 0 and max_marks.
    2. Strips generated code blocks from justification if ideal_answer is non-code,
       preventing student chatbot/homework solving abuse.
    """
    # 1. Enforce mathematical clamping with half-mark rounding support
    try:
        raw_score = float(parsed_json.get("score", 0))
    except (ValueError, TypeError):
        raw_score = 0.0
    clamped_score = max(0.0, min(raw_score, float(max_marks)))
    clamped_score = round(clamped_score * 2) / 2
    if isinstance(clamped_score, float) and clamped_score.is_integer():
        clamped_score = int(clamped_score)

    # 2. Output Code-Leak Sanitizer
    justification = str(parsed_json.get("justification", "")).strip()

    ideal_has_code = "```" in (ideal_answer or "")
    output_has_code = bool(CODE_BLOCK_REGEX.search(justification))

    if output_has_code and not ideal_has_code:
        # Strip code blocks to block free LeetCode / homework code generation
        justification = CODE_BLOCK_REGEX.sub(
            "[Code solution omitted: ExamSync AI evaluates student knowledge and does not provide automated code solutions.]",
            justification,
        )

    return {
        "score": clamped_score,
        "justification": justification,
    }


# ----------------------------------------------------
# 8. Rate Limiting & User Quota Controls
# ----------------------------------------------------
MAX_EXAMS_PER_USER = 2
MAX_DOCUMENTS_PER_USER = 5

import time
from collections import defaultdict
from threading import Lock


class InMemoryRateLimiter:
    """
    Thread-safe sliding-window in-memory rate limiter.
    Protects API endpoints against DDoS, brute force, and LLM spam without external Redis.
    """
    def __init__(self):
        self._records: Dict[str, list] = defaultdict(list)
        self._lock = Lock()

    def is_allowed(self, key: str, max_requests: int, window_seconds: int = 60) -> tuple:
        """
        Returns (is_allowed: bool, retry_after_seconds: int).
        """
        now = time.time()
        cutoff = now - window_seconds
        with self._lock:
            timestamps = [t for t in self._records[key] if t > cutoff]
            if len(timestamps) >= max_requests:
                earliest = timestamps[0]
                retry_after = max(1, int(window_seconds - (now - earliest)))
                self._records[key] = timestamps
                return False, retry_after
            timestamps.append(now)
            self._records[key] = timestamps
            return True, 0

    def reset(self, key: Optional[str] = None):
        """Resets tracking records (useful for unit testing)."""
        with self._lock:
            if key:
                self._records.pop(key, None)
            else:
                self._records.clear()


rate_limiter = InMemoryRateLimiter()

