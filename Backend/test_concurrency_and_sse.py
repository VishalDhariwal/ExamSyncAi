import uuid
import unittest
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient

from main import app_api, GRADER_POOL, format_exam_response
from src.database import init_db, SessionLocal, ExamResult, User
from src.auth import create_access_token, hash_password


class TestConcurrencyAndSSE(unittest.TestCase):

    def test_grader_pool_bounded_concurrency(self):
        self.assertIsInstance(GRADER_POOL, ThreadPoolExecutor)
        self.assertEqual(GRADER_POOL._max_workers, 3)

    def test_stuck_exam_recovery(self):
        with SessionLocal() as db:
            test_email = f"recovery_test_{uuid.uuid4().hex[:8]}@example.com"
            user = User(email=test_email, password_hash=hash_password("testpass123"))
            db.add(user)
            db.commit()
            db.refresh(user)
            user_id = user.id

            stuck_exam_id = uuid.uuid4()
            questions = [
                {"id": "q1", "marks": 5, "ideal_answer": "Option A", "topic": "OS"},
                {"id": "q2", "marks": 5, "ideal_answer": "Option B", "topic": "Networks"},
            ]
            saved_answers = {
                "q1": "Option A",
                "q2": "Option C",  # Wrong answer
            }
            exam = ExamResult(
                id=stuck_exam_id,
                user_id=user_id,
                subject="Operating Systems",
                status="EVALUATING",
                exam_config={"total_marks": 10},
                exam_questions=questions,
                saved_answers=saved_answers,
                score=0,
                max_score=10,
                grades=[],
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(exam)
            db.commit()

        # Run init_db() which executes Step 5 stuck-exam recovery
        init_db()

        with SessionLocal() as db:
            recovered = db.query(ExamResult).filter(ExamResult.id == stuck_exam_id).first()
            self.assertIsNotNone(recovered)
            self.assertEqual(recovered.status, "COMPLETED")
            self.assertEqual(recovered.score, 5.0)  # 1 correct out of 2
            self.assertEqual(recovered.max_score, 10.0)
            self.assertEqual(len(recovered.grades), 2)
            self.assertIsNotNone(recovered.diagnostic)
            self.assertEqual(recovered.diagnostic.get("summary_badge"), "Recovered")

            # Cleanup
            db.delete(recovered)
            user_to_del = db.query(User).filter(User.id == user_id).first()
            if user_to_del:
                db.delete(user_to_del)
            db.commit()

    def test_sse_endpoint_headers(self):
        client = TestClient(app_api)

        with SessionLocal() as db:
            test_email = f"sse_test_{uuid.uuid4().hex[:8]}@example.com"
            user = User(email=test_email, password_hash=hash_password("testpass123"))
            db.add(user)
            db.commit()
            db.refresh(user)
            user_id = user.id

            token = create_access_token(data={"sub": str(user_id)})

            completed_id = uuid.uuid4()
            exam = ExamResult(
                id=completed_id,
                user_id=user_id,
                subject="Test Stream",
                status="COMPLETED",
                exam_config={"total_marks": 20},
                exam_questions=[],
                saved_answers={},
                score=15,
                max_score=20,
                grades=[],
                diagnostic={"summary_badge": "Evaluated"},
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(exam)
            db.commit()

        try:
            with client.stream(
                "GET",
                f"/exams/{completed_id}/stream?token={token}",
            ) as response:
                self.assertEqual(response.status_code, 200)
                self.assertIn("text/event-stream", response.headers["content-type"])
                self.assertEqual(response.headers["cache-control"], "no-cache")

                first_line = next(response.iter_lines())
                self.assertIn("event: completed", first_line)
        finally:
            with SessionLocal() as db:
                exam_to_del = db.query(ExamResult).filter(ExamResult.id == completed_id).first()
                if exam_to_del:
                    db.delete(exam_to_del)
                user_to_del = db.query(User).filter(User.id == user_id).first()
                if user_to_del:
                    db.delete(user_to_del)
                db.commit()


if __name__ == "__main__":
    unittest.main()
