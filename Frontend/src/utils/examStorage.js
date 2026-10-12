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
      // Deduplicate DB records by unique id and question signature
      const seen = new Set()
      const deduplicated = []
      for (const item of res.data) {
        const firstQ = item.exam_questions?.[0]?.question || ""
        const sig = `${item.subject}_${item.totalQuestions || 0}_${firstQ.slice(0, 60)}`
        if (!seen.has(item.id) && !seen.has(sig)) {
          seen.add(item.id)
          seen.add(sig)
          deduplicated.push(item)
        }
      }
      localStorage.setItem(PENDING_EXAMS_KEY, JSON.stringify(deduplicated))
      return deduplicated
    }
  } catch (err) {
    console.warn("Could not reach DB for pending exams, falling back to local cache:", err)
  }

  // Fallback to local cache
  try {
    const raw = localStorage.getItem(PENDING_EXAMS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    const seen = new Set()
    const deduplicated = []
    for (const item of list) {
      const firstQ = item.exam_questions?.[0]?.question || ""
      const sig = `${item.subject}_${item.totalQuestions || 0}_${firstQ.slice(0, 60)}`
      if (!seen.has(item.id) && !seen.has(sig)) {
        seen.add(item.id)
        seen.add(sig)
        deduplicated.push(item)
      }
    }
    return deduplicated
  } catch (e) {
    return []
  }
}

/**
 * Saves in-progress answers and pending status to PostgreSQL DB.
 */
export async function savePendingExam(exam, answers = {}) {
  if (!exam) return null
  const id = exam.id || exam.exam_id

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

  // Fast local write - remove any existing record with matching ID or identical test signature
  try {
    const raw = localStorage.getItem(PENDING_EXAMS_KEY)
    const existing = raw ? JSON.parse(raw) : []
    const firstQ = exam.exam_questions?.[0]?.question || ""
    const currentSig = `${exam.subject}_${totalQuestions}_${firstQ.slice(0, 60)}`

    const updated = Array.isArray(existing)
      ? existing.filter((e) => {
          if (!e) return false
          if (e.id && id && e.id === id) return false
          const eFirstQ = e.exam_questions?.[0]?.question || ""
          const eSig = `${e.subject}_${e.totalQuestions || e.exam_questions?.length || 0}_${eFirstQ.slice(0, 60)}`
          if (eSig === currentSig) return false
          return true
        })
      : []

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

/**
 * Accurately determines the total maximum marks of an exam, protecting
 * against any historical data corruption or duplicate question entries.
 */
export function getTrueMaxScore(exam) {
  if (!exam) return 40
  if (exam.exam_config?.total_marks) return Number(exam.exam_config.total_marks)
  if (exam.diagnostic?.max_score) return Number(exam.diagnostic.max_score)
  if (exam.exam_questions?.length) {
    const qSum = exam.exam_questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0)
    if (qSum > 0) return qSum
  }
  if (exam.grades?.length) {
    const seen = new Set()
    let sum = 0
    for (const g of exam.grades) {
      if (!seen.has(g.question_id)) {
        seen.add(g.question_id)
        sum += Number(g.max_marks) || 0
      }
    }
    if (sum > 0) return sum
  }
  return Number(exam.max_score) || 40
}

/**
 * Accurately determines the student's score, deduplicating if grades were duplicated.
 */
export function getTrueScore(exam) {
  if (!exam) return 0
  if (exam.grades?.length) {
    const seen = new Set()
    let sum = 0
    let hasDupes = false
    for (const g of exam.grades) {
      if (!seen.has(g.question_id)) {
        seen.add(g.question_id)
        sum += Number(g.score) || 0
      } else {
        hasDupes = true
      }
    }
    if (hasDupes) return sum
  }
  return exam.score !== undefined && exam.score !== null ? Number(exam.score) : 0
}

