export const PENDING_EXAMS_KEY = "examsync_pending_exams"

export function getCurrentUserEmail() {
  return localStorage.getItem("user") || ""
}

export function getPendingExams() {
  try {
    const raw = localStorage.getItem(PENDING_EXAMS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []

    const currentEmail = getCurrentUserEmail()
    // If user is logged in, filter to their pending exams, or return items matching their email
    if (currentEmail) {
      return list.filter((e) => !e.user_email || e.user_email === currentEmail)
    }
    return list
  } catch (e) {
    console.error("Failed to parse pending exams:", e)
    return []
  }
}

export function savePendingExam(exam, answers = {}) {
  if (!exam) return null
  const currentEmail = getCurrentUserEmail()
  const id = exam.id || `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const totalQuestions = exam.exam_questions?.length || 0
  const answeredCount = Object.keys(answers).filter(
    (k) => answers[k] !== undefined && answers[k] !== null && String(answers[k]).trim() !== ""
  ).length

  const pendingRecord = {
    ...exam,
    id,
    user_email: exam.user_email || currentEmail,
    saved_answers: answers,
    answeredCount,
    totalQuestions,
    status: "PENDING",
    savedAt: new Date().toISOString(),
  }

  try {
    const raw = localStorage.getItem(PENDING_EXAMS_KEY)
    const existing = raw ? JSON.parse(raw) : []
    const updated = Array.isArray(existing)
      ? existing.filter((e) => e.id !== id)
      : []

    updated.unshift(pendingRecord)

    localStorage.setItem(PENDING_EXAMS_KEY, JSON.stringify(updated))
    localStorage.setItem("exam", JSON.stringify(pendingRecord))
  } catch (err) {
    console.error("Failed to save pending exam:", err)
  }

  return pendingRecord
}

export function removePendingExam(examId) {
  if (!examId) return
  try {
    const raw = localStorage.getItem(PENDING_EXAMS_KEY)
    if (!raw) return
    const existing = JSON.parse(raw)
    if (Array.isArray(existing)) {
      const updated = existing.filter((e) => e.id !== examId && e.subject !== examId)
      localStorage.setItem(PENDING_EXAMS_KEY, JSON.stringify(updated))
    }

    const currentExam = localStorage.getItem("exam")
    if (currentExam) {
      const parsed = JSON.parse(currentExam)
      if (parsed.id === examId) {
        localStorage.removeItem("exam")
      }
    }
  } catch (err) {
    console.error("Failed to remove pending exam:", err)
  }
}

export function resumePendingExam(examId, navigate) {
  const pending = getPendingExams()
  const found = pending.find((e) => e.id === examId)
  if (found) {
    localStorage.setItem("exam", JSON.stringify(found))
    if (navigate) {
      navigate("/exam")
    }
  }
}
