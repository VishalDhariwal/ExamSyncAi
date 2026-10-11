import {
  getPendingExamsApi,
  saveDraftExamApi,
  getExamSessionApi,
  discardExamApi,
} from "../api/api"

export const PENDING_EXAMS_KEY = "examsync_pending_exams"

export function getCurrentUserEmail() {
  return localStorage.getItem("user") || ""
}

/**
 * Loads pending exams directly from PostgreSQL DB, falling back to local cache if offline.
 */
export async function getPendingExams() {
  try {
    const res = await getPendingExamsApi()
    if (res.data && Array.isArray(res.data)) {
      // Sync local cache with DB
      localStorage.setItem(PENDING_EXAMS_KEY, JSON.stringify(res.data))
      return res.data
    }
  } catch (err) {
    console.warn("Could not reach DB for pending exams, falling back to local cache:", err)
  }

  // Fallback to local cache
  try {
    const raw = localStorage.getItem(PENDING_EXAMS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch (e) {
    return []
  }
}

/**
 * Saves in-progress answers and pending status to PostgreSQL DB.
 */
export async function savePendingExam(exam, answers = {}) {
  if (!exam) return null
  const id = exam.id

  const totalQuestions = exam.exam_questions?.length || 0
  const answeredCount = Object.keys(answers).filter(
    (k) => answers[k] !== undefined && answers[k] !== null && String(answers[k]).trim() !== ""
  ).length

  const pendingRecord = {
    ...exam,
    id,
    saved_answers: answers,
    answeredCount,
    totalQuestions,
    status: "PENDING",
    savedAt: new Date().toISOString(),
  }

  // Fast local write
  try {
    const raw = localStorage.getItem(PENDING_EXAMS_KEY)
    const existing = raw ? JSON.parse(raw) : []
    const updated = Array.isArray(existing) ? existing.filter((e) => e.id !== id) : []
    updated.unshift(pendingRecord)
    localStorage.setItem(PENDING_EXAMS_KEY, JSON.stringify(updated))
    localStorage.setItem("exam", JSON.stringify(pendingRecord))
  } catch (e) {
    console.error("Local storage write error:", e)
  }

  // Sync to PostgreSQL DB
  if (id) {
    try {
      await saveDraftExamApi(id, answers)
    } catch (err) {
      console.error("Failed to sync draft answers to PostgreSQL:", err)
    }
  }

  return pendingRecord
}

/**
 * Discards/Deletes an unsubmitted exam attempt from PostgreSQL DB.
 */
export async function removePendingExam(examId) {
  if (!examId) return

  // Delete from PostgreSQL
  try {
    await discardExamApi(examId)
  } catch (err) {
    console.error("Failed to delete exam from PostgreSQL:", err)
  }

  // Update local cache
  clearLocalPendingExam(examId)
}

/**
 * Clears only the local pending storage after an exam is submitted to DB.
 * Does NOT delete the exam from PostgreSQL.
 */
export function clearLocalPendingExam(examId) {
  if (!examId) return

  try {
    const raw = localStorage.getItem(PENDING_EXAMS_KEY)
    if (raw) {
      const existing = JSON.parse(raw)
      if (Array.isArray(existing)) {
        const updated = existing.filter((e) => e.id !== examId && e.subject !== examId)
        localStorage.setItem(PENDING_EXAMS_KEY, JSON.stringify(updated))
      }
    }

    const currentExam = localStorage.getItem("exam")
    if (currentExam) {
      const parsed = JSON.parse(currentExam)
      if (parsed.id === examId) {
        localStorage.removeItem("exam")
      }
    }
  } catch (err) {
    console.error("Local cleanup error:", err)
  }
}

/**
 * Resumes an exam session by loading full questions and answers from PostgreSQL DB.
 */
export async function resumePendingExam(examId, navigate) {
  let examData = null

  // Fetch full exam session from PostgreSQL
  try {
    const res = await getExamSessionApi(examId)
    if (res.data) {
      examData = res.data
    }
  } catch (err) {
    console.warn("Could not fetch exam from DB, checking local cache:", err)
  }

  if (!examData) {
    const raw = localStorage.getItem(PENDING_EXAMS_KEY)
    if (raw) {
      const existing = JSON.parse(raw)
      examData = existing.find((e) => e.id === examId)
    }
  }

  if (examData) {
    localStorage.setItem("exam", JSON.stringify(examData))
    if (navigate) {
      navigate("/exam")
    }
  }
}
