import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  CheckCircle2,
  Sparkles,
  ArrowRight,
  X,
  Zap,
  Award,
} from "lucide-react"
import {
  getEvaluatingExamsApi,
  getExamSessionApi,
  getEvaluatingExamsStreamUrl,
} from "../api/api"
import {
  stopTrackingEvaluatingExam,
  sendBrowserNotification,
  getTrueMaxScore,
  getTrueScore,
} from "../utils/examStorage"

export default function EvaluationNotifier() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const activeIdsRef = useRef(new Set())
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) return

    let isMounted = true
    let eventSource = null
    let pollInterval = null

    const handleExamCompleted = (exam) => {
      if (!exam || !exam.id) return
      stopTrackingEvaluatingExam(exam.id)

      const score = getTrueScore(exam)
      const max = getTrueMaxScore(exam)
      const pct = max > 0 ? Math.round((score / max) * 100) : 0

      // Desktop Web Notification
      sendBrowserNotification(`StudySync AI: ${exam.subject} Exam Evaluated!`, {
        body: `Your exam has been graded. Score: ${score}/${max} Marks (${pct}%). Click to view diagnostic report.`,
      })

      // In-App Toast Notification
      setNotifications((prev) => [
        ...prev.filter((n) => n.id !== exam.id),
        {
          id: exam.id,
          subject: exam.subject,
          score,
          max,
          percentage: pct,
          badge: exam.diagnostic?.summary_badge || "Evaluated",
          createdAt: Date.now(),
        },
      ])
    }

    const checkEvaluations = async () => {
      try {
        const res = await getEvaluatingExamsApi()
        if (!isMounted) return
        const currentEvaluating = res.data || []
        const currentIds = new Set(currentEvaluating.map((e) => e.id))

        if (!hasInitializedRef.current) {
          activeIdsRef.current = currentIds
          hasInitializedRef.current = true
          return
        }

        // Detect any exams that were evaluating previously but are no longer in evaluating status
        for (const prevId of activeIdsRef.current) {
          if (!currentIds.has(prevId)) {
            try {
              const completedRes = await getExamSessionApi(prevId)
              const exam = completedRes.data
              if (exam && exam.status === "COMPLETED") {
                handleExamCompleted(exam)
              }
            } catch (err) {
              console.warn("Could not fetch completed exam session:", err)
            }
          }
        }

        activeIdsRef.current = currentIds
      } catch (err) {
        // Silently skip if network error or unauthenticated
      }
    }

    const startPolling = () => {
      if (pollInterval) return
      checkEvaluations()
      pollInterval = setInterval(checkEvaluations, 4000)
    }

    // Connect Server-Sent Events (SSE) push stream for instant notification delivery
    const initSSE = () => {
      if (typeof EventSource === "undefined") {
        startPolling()
        return
      }

      try {
        const streamUrl = getEvaluatingExamsStreamUrl()
        eventSource = new EventSource(streamUrl)

        eventSource.addEventListener("snapshot", (e) => {
          try {
            const data = JSON.parse(e.data)
            activeIdsRef.current = new Set(data.evaluating_ids || [])
          } catch (err) {
            console.warn("Failed to parse SSE snapshot:", err)
          }
        })

        eventSource.addEventListener("completed", (e) => {
          if (!isMounted) return
          try {
            const completedExam = JSON.parse(e.data)
            handleExamCompleted(completedExam)
          } catch (err) {
            console.error("Failed to parse SSE completion:", err)
          }
        })

        eventSource.addEventListener("error", () => {
          // Fall back gracefully to polling on network or proxy interruption
          if (eventSource) {
            eventSource.close()
            eventSource = null
          }
          if (isMounted && !pollInterval) {
            startPolling()
          }
        })
      } catch (err) {
        startPolling()
      }
    }

    // Initialize SSE streaming push with polling backup
    initSSE()

    return () => {
      isMounted = false
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
    }
  }, [])

  const dismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const handleViewReport = (id) => {
    dismissNotification(id)
    navigate(`/results?id=${id}`)
  }

  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-md w-full px-4 sm:px-0 pointer-events-none">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-blue-200 p-5 transform transition-all animate-slideUp overflow-hidden relative"
        >
          {/* Top highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500"></div>

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-100">
                <Award className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Grading Complete
                  </span>
                  <span className="text-xs text-gray-400">Just now</span>
                </div>
                <h4 className="text-sm font-bold text-gray-900 mt-0.5">
                  {notif.subject}
                </h4>
              </div>
            </div>

            <button
              onClick={() => dismissNotification(notif.id)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
            <div className="text-xs">
              <span className="font-extrabold text-blue-700 text-sm">
                {notif.score} / {notif.max}
              </span>
              <span className="text-gray-500 font-medium ml-1">
                Marks ({notif.percentage}%)
              </span>
            </div>

            <button
              onClick={() => handleViewReport(notif.id)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              <span>View Report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
