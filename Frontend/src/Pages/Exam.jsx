import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  Send,
  FileText,
  Bookmark,
  Loader2,
  Trash2,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react"
import QuestionCard from "../components/QuestionCard"
import { submitExam } from "../api/api"
import {
  savePendingExam,
  removePendingExam,
  clearLocalPendingExam,
  trackEvaluatingExam,
  requestBrowserNotificationPermission,
} from "../utils/examStorage"

export default function Exam() {
  const navigate = useNavigate()
  const email = localStorage.getItem("user") || ""

  // Initialize exam with a stable unique ID
  const [exam, setExam] = useState(() => {
    const raw = localStorage.getItem("exam")
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      if (!parsed.id) {
        parsed.id = `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        localStorage.setItem("exam", JSON.stringify(parsed))
      }
      return parsed
    } catch (e) {
      console.error("Failed to parse active exam:", e)
      return null
    }
  })

  // Load any previously saved answers for this pending attempt
  const [answers, setAnswers] = useState(exam?.saved_answers || exam?.answers || {})
  const [submitting, setSubmitting] = useState(false)
  const [saveToast, setSaveToast] = useState(false)

  // Ensure initial pending status is saved to pending list immediately
  useEffect(() => {
    if (exam) {
      savePendingExam(exam, answers)
    }
  }, [exam])

  // Auto-save on page refresh/close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (exam) {
        savePendingExam(exam, answers)
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [exam, answers])

  const setAnswer = (id, value) => {
    setAnswers((prev) => {
      const updated = { ...prev, [id]: value }
      // Auto-save progress
      if (exam) {
        savePendingExam(exam, updated)
      }
      return updated
    })
  }

  // Handle Save & Exit (Mark as Pending)
  const handleSaveAndExit = async () => {
    if (exam) {
      await savePendingExam(exam, answers)
    }
    setSaveToast(true)
    setTimeout(() => {
      navigate("/dashboard")
    }, 500)
  }

  // Discard Attempt
  const handleDiscard = async () => {
    if (
      window.confirm(
        "Are you sure you want to discard this exam attempt? All entered answers will be cleared."
      )
    ) {
      if (exam) await removePendingExam(exam.id)
      localStorage.removeItem("exam")
      navigate("/practice")
    }
  }

  // Final Submit Handler
  const submit = async () => {
    if (submitting) return
    setSubmitting(true)

    try {
      const student_answers = (exam.exam_questions || []).map((q) => ({
        question_id: q.id,
        answer_text: answers[q.id] || "",
      }))

      // Request browser notification permission so we can alert student when evaluation finishes
      requestBrowserNotificationPermission()

      const res = await submitExam({
        exam_state: exam,
        student_answers,
        user_email: email,
      })

      const completedExamId = res.data?.id || exam?.id

      // Clean up local pending draft and active test session
      if (exam?.id) {
        clearLocalPendingExam(exam.id)
      }
      localStorage.removeItem("exam")

      // Track background evaluation so user gets notified on any page
      if (completedExamId) {
        trackEvaluatingExam(completedExamId, exam.subject || "Exam")
      }

      localStorage.setItem("result", JSON.stringify(res.data))
      navigate(completedExamId ? `/results?id=${completedExamId}` : "/results")
    } catch (err) {
      console.error("Exam submission failed:", err)
      alert("Failed to submit exam: " + (err.response?.data?.detail || err.message))
      setSubmitting(false)
    }
  }

  if (!exam || !exam.exam_questions || exam.exam_questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <h2 className="text-xl font-bold mb-2 text-gray-800">No active exam found</h2>
          <p className="text-xs text-gray-500 mb-6">
            Please configure and launch a mock exam from the Practice page.
          </p>
          <button
            onClick={() => navigate("/practice")}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition shadow-md"
          >
            Go to Practice Setup
          </button>
        </div>
      </div>
    )
  }

  const totalQuestions = exam.exam_questions.length
  const answeredCount = Object.keys(answers).filter(
    (k) => answers[k] !== undefined && answers[k] !== null && String(answers[k]).trim() !== ""
  ).length
  const totalMarks =
    exam.exam_config?.total_marks ||
    exam.exam_questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Sticky Exam Top Bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-200 px-8 py-3.5 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Primary Exit to Home Button */}
            <button
              onClick={handleSaveAndExit}
              className="p-2 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-xl transition flex items-center gap-1.5 text-xs font-bold border border-gray-200"
              title="Exit test"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Exit</span>
            </button>

            <div>
              <h1 className="text-lg font-bold text-gray-900">{exam.subject}</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Total: {totalMarks} Marks • Answered {answeredCount} of {totalQuestions} questions • Auto-Saved
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Discard Button */}
            <button
              onClick={handleDiscard}
              className="text-xs font-semibold text-gray-400 hover:text-red-600 px-2.5 py-2 rounded-xl transition hover:bg-red-50"
              title="Discard attempt completely"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Save & Exit Button */}
            <button
              onClick={handleSaveAndExit}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
            >
              <Bookmark className="w-3.5 h-3.5 text-gray-600" />
              <span>Save & Exit</span>
            </button>

            {/* Submit Final Exam Button */}
            <button
              onClick={submit}
              disabled={submitting}
              className={`font-bold text-xs px-5 py-2.5 rounded-xl text-white transition shadow-md flex items-center gap-2 ${
                submitting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20 active:scale-95"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Grading with AI...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Exam ({answeredCount}/{totalQuestions})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Floating Save Notification Toast */}
      {saveToast && (
        <div className="fixed top-20 right-8 z-50 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span>Progress saved as Pending! Returning to Dashboard...</span>
        </div>
      )}

      {/* Questions Content */}
      <div className="max-w-5xl mx-auto px-6 pt-8 space-y-6">
        {exam.exam_questions.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            answer={answers[q.id]}
            setAnswer={setAnswer}
          />
        ))}

        {/* Bottom Sticky Action Banner */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Want to continue later?</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              You can exit now without submitting. Your test is marked as Pending and you can answer the rest later.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAndExit}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
            >
              <Bookmark className="w-3.5 h-3.5 text-gray-600" />
              <span>Save as Pending & Exit</span>
            </button>

            <button
              onClick={submit}
              disabled={submitting}
              className={`font-bold text-xs px-6 py-2.5 rounded-xl text-white transition shadow-md flex items-center gap-2 ${
                submitting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20 active:scale-95"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Evaluating Answers...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Final Exam</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}