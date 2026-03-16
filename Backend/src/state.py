from typing import Annotated, List, Optional, Union
from typing_extensions import TypedDict
import operator
from pydantic import BaseModel, Field

# 1. Structured Data for your Dashboard
class DiagnosticMetric(BaseModel):
    topic: str
    score: int
    feedback: str
    status: str # "Strong" | "Weak" | "Improving"

# 2. The Shared State Schema
class ExamState(TypedDict):
    # --- Identifiers ---
    student_id: str
    semester: int
    subject: str
    
    # --- Communication (The Memory) ---
    # operator.add ensures we append to history rather than overwriting
    messages: Annotated[List[dict], operator.add] 
    
    # --- Input Management ---
    image_bytes: Optional[bytes]  # Photo of handwriting
    raw_transcription: Optional[str] # Text extracted from image
    
    # --- The "Logic" Data ---
    # List[dict] allows us to track multiple questions/answers
    exam_questions: List[dict]    
    student_answers: List[dict]   
    
    # --- Evaluation Logic ---
    current_rubric: Optional[str]
    # We use Annotated[List, operator.add] so we don't lose previous grade versions
    grades: Annotated[List[dict], operator.add] 
    critic_notes: Optional[str]   # Feedback for the next iteration
    
    # --- Final Product Output ---
    # Pydantic model ensures your Frontend gets clean JSON every time
    diagnostic_report: Optional[dict] 
    
    # --- Loop Guard ---
    # operator.add lets you just return {"loop_count": 1} to increment it
    loop_count: Annotated[int, operator.add]