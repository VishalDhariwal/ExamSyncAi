import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import {
  BarChart3,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Calendar,
  Play,
  Clock,
  Trash2,
  X,
  Activity,
  Lightbulb,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Target,
  Search,
  Check,
  Loader2,
  BookOpen,
} from "lucide-react"
import ScoreCard from "../components/ScoreCard"
import {
  getExamHistory,
  getSubjects,
  getSubjectWeakTopics,
  generateExam,
} from "../api/api"
import {
  getPendingExams,
  resumePendingExam,
  removePendingExam,
  savePendingExam,
} from "../utils/examStorage"

export default function Reports() {
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [pendingExams, setPendingExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedExamId, setExpandedExamId] = useState(null)
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("ALL")
  const [activeDiagnosticExam, setActiveDiagnosticExam] = useState(null)

  // --- Practice Weak Topics Modal State ---
  const [isWeakModalOpen, setIsWeakModalOpen] = useState(false)
  const [modalSubject, setModalSubject] = useState("")
  const [modalSearchTerm, setModalSearchTerm] = useState("")
  const [selectedTopics, setSelectedTopics] = useState([])
  const [availableSubjects, setAvailableSubjects] = useState([])
  const [serverTopics, setServerTopics] = useState({})
  const [loadingServerTopics, setLoadingServerTopics] = useState(false)
  const [isGeneratingTest, setIsGeneratingTest] = useState(false)
  const [generationError, setGenerationError] = useState("")
  const [testPreset, setTestPreset] = useState("quick") // "quick" (20m) | "standard" (40m)

  // Escape key closes modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setActiveDiagnosticExam(null)
        setIsWeakModalOpen(false)
      }
    }
    if (activeDiagnosticExam || isWeakModalOpen) {
      window.addEventListener("keydown", handleKeyDown)
    }
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeDiagnosticExam, isWeakModalOpen])

  const refreshPending = async () => {
    const list = await getPendingExams()
    setPendingExams(list || [])
  }

  useEffect(() => {
    refreshPending()
    const fetchHistory = async () => {
      try {
        setLoading(true)
        const res = await getExamHistory()
        setExams(res.data || [])
      } catch (err) {
        console.error("Failed to load exam history:", err)
      } finally {
        setLoading(false)
      }
    }
    const fetchSubjectList = async () => {
      try {
        const res = await getSubjects()
        if (res.data && Array.isArray(res.data)) {
          setAvailableSubjects(res.data)
        }
      } catch (err) {
        console.warn("Failed to fetch subjects list:", err)
      }
    }
    fetchHistory()
    fetchSubjectList()
  }, [])

  // Aggregate stats
  const totalExams = exams.length
  const avgScore =
    totalExams > 0
      ? Math.round(
          exams.reduce((sum, e) => {
            const max = e.max_score || 40
            return sum + (e.score / max) * 100
          }, 0) / totalExams
        )
      : 0

  // Collect and aggregate weak topics with frequency and source subjects
  const weakTopicStats = exams.flatMap((e) =>
    (e.diagnostic?.weak_topics || []).map((t) => ({
      topic: t,
      subject: e.subject || "General",
    }))
  )

  const topicFrequency = weakTopicStats.reduce((acc, item) => {
    if (!acc[item.topic]) {
      acc[item.topic] = { topic: item.topic, count: 0, subjects: new Set() }
    }
    acc[item.topic].count += 1
    acc[item.topic].subjects.add(item.subject)
    return acc
  }, {})

  const sortedWeakTopics = Object.values(topicFrequency).sort((a, b) => b.count - a.count)
  const allWeakTopics = sortedWeakTopics.map((item) => item.topic)

  // Combined list of all available subjects (from API + exam history + standard courses)
  const allKnownSubjects = Array.from(
    new Set([
      ...availableSubjects,
      ...exams.map((e) => e.subject).filter(Boolean),
      "DBMS",
      "DSA",
    ])
  ).sort()

  const subjects = Array.from(new Set(exams.map((e) => e.subject).filter(Boolean)))

  const filteredExams = exams.filter((e) => {
    if (selectedSubjectFilter === "ALL") return true
    return e.subject.toUpperCase() === selectedSubjectFilter.toUpperCase()
  })

  const toggleExpand = (id) => {
    setExpandedExamId(expandedExamId === id ? null : id)
  }

  // --- Helper to fetch and cache server weak topics for a subject ---
  const loadServerTopicsForSubject = async (subj) => {
    if (!subj) return
    const cleanSubj = subj.trim().toUpperCase()
    if (serverTopics[cleanSubj]) return
    try {
      setLoadingServerTopics(true)
      const res = await getSubjectWeakTopics(cleanSubj)
      if (res.data && Array.isArray(res.data)) {
        setServerTopics((prev) => ({ ...prev, [cleanSubj]: res.data }))
      }
    } catch (err) {
      console.warn("Could not fetch server weak topics for", cleanSubj, err)
    } finally {
      setLoadingServerTopics(false)
    }
  }

  // --- Helper to get all weak topics for a subject (merges local exam diagnostics + server topics) ---
  const getWeakTopicsForSubject = (subj) => {
    if (!subj) return []
    const cleanSubj = subj.trim().toUpperCase()
    const map = {}

    // 1. Gather from user's exams in local state
    exams.forEach((e) => {
      if ((e.subject || "").toUpperCase() === cleanSubj) {
        const wList = e.diagnostic?.weak_topics || []
        wList.forEach((t) => {
          const str = String(t).trim()
          if (str) {
            if (!map[str]) map[str] = { topic: str, count: 0, isFlagged: true }
            map[str].count += 1
          }
        })

        const taList = e.diagnostic?.topic_analysis || []
        taList.forEach((ta) => {
          if (ta.status === "Weak" && ta.topic) {
            const str = String(ta.topic).trim()
            if (str) {
              if (!map[str]) map[str] = { topic: str, count: 0, isFlagged: true }
              map[str].count += 1
            }
          }
        })

        const grades = e.grades || []
        grades.forEach((g) => {
          if (g.topic && g.max_marks > 0 && g.score / g.max_marks < 0.6) {
            const str = String(g.topic).trim()
            if (str) {
              if (!map[str]) map[str] = { topic: str, count: 0, isFlagged: true }
              map[str].count += 1
            }
          }
        })
      }
    })

    // 2. Gather from server fetched topics
    if (serverTopics[cleanSubj] && Array.isArray(serverTopics[cleanSubj])) {
      serverTopics[cleanSubj].forEach((item) => {
        const str = String(item.topic).trim()
        if (str) {
          if (!map[str]) {
            map[str] = {
              topic: str,
              count: item.count || 0,
              isFlagged: item.is_flagged || false,
            }
          } else {
            map[str].count = Math.max(map[str].count, item.count || 0)
          }
        }
      })
    }

    return Object.values(map).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.topic.localeCompare(b.topic)
    })
  }

  // --- Modal Open & Subject Change Handlers ---
  const openWeakTopicsModal = (initialSubj = null) => {
    let targetSubj = initialSubj
    if (!targetSubj) {
      const withWeak = allKnownSubjects.find(
        (s) => getWeakTopicsForSubject(s).length > 0
      )
      targetSubj = withWeak || modalSubject || allKnownSubjects[0] || "DBMS"
    }
    setModalSubject(targetSubj)
    setSelectedTopics([])
    setModalSearchTerm("")
    setGenerationError("")
    setIsWeakModalOpen(true)
    loadServerTopicsForSubject(targetSubj)
  }

  const handleModalSubjectChange = (newSubj) => {
    setModalSubject(newSubj)
    setSelectedTopics([])
    setGenerationError("")
    loadServerTopicsForSubject(newSubj)
  }

  const toggleTopicSelection = (topicName) => {
    setSelectedTopics((prev) =>
      prev.includes(topicName)
        ? prev.filter((t) => t !== topicName)
        : [...prev, topicName]
    )
  }

  // Current topics list in modal
  const currentSubjectTopics = getWeakTopicsForSubject(modalSubject)
  const filteredModalTopics = currentSubjectTopics.filter((t) =>
    t.topic.toLowerCase().includes(modalSearchTerm.toLowerCase().trim())
  )

  const handleSelectAllFiltered = () => {
    const toAdd = filteredModalTopics.map((t) => t.topic)
    setSelectedTopics((prev) => Array.from(new Set([...prev, ...toAdd])))
  }

  const handleClearSelections = () => {
    setSelectedTopics([])
  }

  // --- Generate Targeted Test Handler ---
  const handleGenerateWeakTopicExam = async () => {
    if (selectedTopics.length === 0) {
      alert("Please select at least one weak topic to practice.")
      return
    }

    try {
      setIsGeneratingTest(true)
      setGenerationError("")

      const breakdownConfig =
        testPreset === "standard"
          ? {
              total_marks: 40,
              breakdown: [
                { type: "mcq", marks: 1, count: 5 },
                { type: "short", marks: 5, count: 5 },
                { type: "long", marks: 5, count: 2 },
              ],
            }
          : {
              total_marks: 20,
              breakdown: [
                { type: "mcq", marks: 1, count: 5 },
                { type: "short", marks: 5, count: 3 },
              ],
            }

      const payload = {
        subject: modalSubject.trim().toUpperCase(),
        selected_topics: selectedTopics,
        exam_config: breakdownConfig,
      }

      const res = await generateExam(payload)
      const newExam = {
        ...res.data,
        id:
          res.data.id ||
          `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        status: "PENDING",
        user_email: localStorage.getItem("user") || "",
        createdAt: new Date().toISOString(),
        saved_answers: {},
      }
      await savePendingExam(newExam, {})
      setIsWeakModalOpen(false)
      navigate("/exam")
    } catch (err) {
      console.error("Failed to generate targeted exam:", err)
      const detail =
        err.response?.data?.detail || err.message || "Failed to generate exam."
      setGenerationError(`Exam generation failed: ${detail}`)
    } finally {
      setIsGeneratingTest(false)
    }
  }

  return (
    <div className="w-full space-y-8">
      {/* Top Analytics Banner */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              Exam Performance & Diagnostic Reports
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Track your scores, topic strengths, and examiner feedback across all mock tests.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
            <button
              onClick={() => openWeakTopicsModal()}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Target className="w-3.5 h-3.5 text-white" />
              <span>Practice Weak Topics</span>
            </button>
            <button
              onClick={() => navigate("/practice")}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-md flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Start Practice Test</span>
            </button>
          </div>
        </div>

        {/* Aggregate KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-100">
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600">
              Completed Exams
            </span>
            <p className="text-2xl font-black text-blue-950 mt-1">{totalExams}</p>
          </div>

          <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-100">
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700">
              Pending / In Progress
            </span>
            <p className="text-2xl font-black text-blue-950 mt-1">{pendingExams.length}</p>
          </div>

          <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-100">
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600">
              Average Performance
            </span>
            <p className="text-2xl font-black text-blue-950 mt-1">
              {totalExams > 0 ? `${avgScore}%` : "—"}
            </p>
          </div>

          <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-100">
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600">
              Identified Focus Areas
            </span>
            <p className="text-2xl font-black text-blue-950 mt-1">{allWeakTopics.length}</p>
          </div>
        </div>
      </div>

      {/* Pending Exams Section */}
      {pendingExams.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
              <h3 className="text-sm font-bold text-gray-900">
                In-Progress Exam Attempts ({pendingExams.length})
              </h3>
            </div>
            <span className="text-xs font-semibold text-gray-500">
              Draft answers saved in PostgreSQL
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1.5 custom-scrollbar">
            {pendingExams.map((p) => (
              <div
                key={p.id}
                className="bg-gray-50/70 hover:bg-gray-50 rounded-2xl p-4 border border-gray-200/70 shadow-xs flex items-center justify-between gap-3 transition hover:border-blue-200"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">{p.subject}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-150 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>IN PROGRESS</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Answered {p.answeredCount || 0} of {p.totalQuestions || p.exam_questions?.length || 0} questions
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      await removePendingExam(p.id)
                      await refreshPending()
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition"
                    title="Discard attempt"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => resumePendingExam(p.id, navigate)}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Resume Test</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-900">
          Exam History Records ({filteredExams.length})
        </h3>

        {subjects.length > 0 && (
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="bg-white border border-gray-200 text-xs font-medium text-gray-700 px-3 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Subjects ({exams.length})</option>
            {subjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Records List */}
      {loading ? (
        <p className="text-xs text-gray-400 py-16 text-center">Loading past exam records from PostgreSQL...</p>
      ) : filteredExams.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <h4 className="text-base font-bold text-gray-800 mb-1">No exam records found</h4>
          <p className="text-xs text-gray-500 mb-6">
            Take a mock exam to view detailed score cards and diagnostic breakdowns here.
          </p>
          <button
            onClick={() => navigate("/practice")}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-md"
          >
            Launch Your First Exam
          </button>
        </div>
      ) : (
        <div className="space-y-4 max-h-[720px] overflow-y-auto pr-2 custom-scrollbar">
          {filteredExams.map((exam) => {
            const isExpanded = expandedExamId === exam.id
            const maxScore = exam.max_score || 40
            const percentage = Math.round((exam.score / maxScore) * 100)

            const scoreBadgeColor =
              percentage >= 75
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : percentage >= 50
                ? "bg-blue-50/70 text-blue-600 border-blue-100"
                : "bg-red-50 text-red-700 border-red-200"

            return (
              <div
                key={exam.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition overflow-hidden"
              >
                {/* Header Card */}
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-gray-900">{exam.subject}</h4>
                        {exam.diagnostic?.summary_badge && (
                          <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md">
                            {exam.diagnostic.summary_badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span>
                          {exam.created_at
                            ? new Date(exam.created_at).toLocaleString()
                            : "Completed Exam"}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div
                        className={`px-4 py-2 rounded-xl border font-black text-base ${scoreBadgeColor}`}
                      >
                        {exam.score} / {maxScore}{" "}
                        <span className="text-xs font-semibold ml-1">({percentage}%)</span>
                      </div>

                      <button
                        onClick={() => setActiveDiagnosticExam(exam)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100/80 border border-blue-200 transition"
                        title="Open full popup diagnostic report"
                      >
                        <Zap className="w-3.5 h-3.5 fill-blue-600 text-blue-600" />
                        <span>Diagnostic Report</span>
                      </button>

                      <button
                        onClick={() => toggleExpand(exam.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-gray-200 hover:bg-gray-50 text-gray-700 transition"
                      >
                        <span>{isExpanded ? "Hide Details" : "View Breakdown"}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* AI Diagnostic Summary */}
                  {exam.diagnostic && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2.5">
                      {exam.diagnostic.overall_feedback && (
                        <p className="text-xs text-gray-700 font-medium leading-relaxed">
                          <span className="font-bold text-gray-900">Feedback: </span>
                          {exam.diagnostic.overall_feedback}
                        </p>
                      )}

                      {exam.diagnostic.strong_topics?.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-[11px] font-bold text-emerald-700">Mastered:</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {exam.diagnostic.strong_topics.slice(0, 3).map((t, idx) => (
                              <span
                                key={idx}
                                className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] px-2.5 py-0.5 rounded-md font-medium"
                              >
                                ✓ {t}
                              </span>
                            ))}
                            {exam.diagnostic.strong_topics.length > 3 && (
                              <button
                                onClick={() => setActiveDiagnosticExam(exam)}
                                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                              >
                                +{exam.diagnostic.strong_topics.length - 3} more &rarr;
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {exam.diagnostic.weak_topics?.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-[11px] font-bold text-amber-700">Areas for Improvement:</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {exam.diagnostic.weak_topics.slice(0, 3).map((t, idx) => (
                              <span
                                key={idx}
                                className="bg-amber-50 text-amber-800 border border-amber-200/70 text-[11px] px-2.5 py-0.5 rounded-lg font-medium"
                              >
                                {t}
                              </span>
                            ))}
                            {exam.diagnostic.weak_topics.length > 3 && (
                              <button
                                onClick={() => setActiveDiagnosticExam(exam)}
                                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                              >
                                +{exam.diagnostic.weak_topics.length - 3} more in report &rarr;
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Expandable Question Breakdown Accordion */}
                {isExpanded && exam.grades && (
                  <div className="bg-gray-50/80 p-6 border-t border-gray-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                        Detailed Question Breakdown & Grader Feedback
                      </h5>
                      <button
                        onClick={() => setActiveDiagnosticExam(exam)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                      >
                        <span>Open Full AI Diagnostic</span>
                        <Zap className="w-3 h-3 fill-blue-600" />
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1.5 custom-scrollbar">
                      {exam.grades.map((g, idx) => {
                        const matchingQ = (exam.exam_questions || []).find(
                          (q) => String(q.id) === String(g.question_id)
                        )
                        const studentAns =
                          exam.saved_answers?.[g.question_id] ||
                          exam.saved_answers?.[String(g.question_id)]

                        return (
                          <div
                            key={idx}
                            className="bg-white rounded-xl p-5 border border-gray-200/80 shadow-2xs space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-900">
                                Question {g.question_id || idx + 1}
                              </span>
                              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                                {g.score} / {g.max_marks} Marks
                              </span>
                            </div>

                            {matchingQ?.question && (
                              <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 text-xs text-gray-800 font-medium">
                                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                                  Question Prompt
                                </span>
                                <p>{matchingQ.question}</p>
                              </div>
                            )}

                            <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 text-xs text-gray-700">
                              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                                Your Submitted Answer
                              </span>
                              <p className="whitespace-pre-wrap">
                                {studentAns || (
                                  <span className="text-gray-400 italic">No answer submitted</span>
                                )}
                              </p>
                            </div>

                            {g.feedback && (
                              <div className="text-xs text-gray-700 leading-relaxed pt-1">
                                <span className="font-semibold text-gray-900 mr-1">
                                  Examiner Assessment:
                                </span>
                                <span>{g.feedback}</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Large AI Diagnostic Report Popup Modal (Portaled to document.body) */}
      {activeDiagnosticExam &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget) setActiveDiagnosticExam(null)
            }}
          >
            <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100">
              {/* Modal Top Header */}
              <div className="px-6 sm:px-8 py-4 sm:py-5 bg-white border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-gray-900 text-lg">
                        {activeDiagnosticExam.subject}
                      </h3>
                      {activeDiagnosticExam.diagnostic?.summary_badge && (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                          {activeDiagnosticExam.diagnostic.summary_badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Score: {activeDiagnosticExam.score} / {activeDiagnosticExam.max_score || 40} Marks (
                      {Math.round(
                        (activeDiagnosticExam.score / (activeDiagnosticExam.max_score || 40)) * 100
                      )}
                      %) • Evaluated {activeDiagnosticExam.created_at ? new Date(activeDiagnosticExam.created_at).toLocaleDateString() : "Exam"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveDiagnosticExam(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="overflow-y-auto px-6 sm:px-8 py-6 space-y-6 flex-1 custom-scrollbar">
                {/* 1. Overall Examiner Assessment */}
                {activeDiagnosticExam.diagnostic?.overall_feedback && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Overall Examiner Assessment
                    </h4>
                    <p className="text-sm text-gray-800 leading-relaxed bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-100">
                      {activeDiagnosticExam.diagnostic.overall_feedback}
                    </p>
                  </div>
                )}

                {/* 2. Strengths & Focus Areas Side-by-Side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100/80 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Demonstrated Strengths</span>
                    </h4>
                    {activeDiagnosticExam.diagnostic?.strong_topics?.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {activeDiagnosticExam.diagnostic.strong_topics.map((t, i) => (
                          <span
                            key={i}
                            className="bg-white text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          >
                            ✓ {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic">No mastered topics logged yet.</p>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-red-50/40 border border-red-100/80 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span>Priority Focus Areas</span>
                    </h4>
                    {activeDiagnosticExam.diagnostic?.weak_topics?.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {activeDiagnosticExam.diagnostic.weak_topics.map((t, i) => (
                          <span
                            key={i}
                            className="bg-white text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          >
                            ! {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-700 font-semibold">No critical topic weaknesses.</p>
                    )}
                  </div>
                </div>

                {/* 4. Identified Conceptual Gaps */}
                {activeDiagnosticExam.diagnostic?.key_conceptual_gaps?.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      <span>Identified Conceptual Gaps</span>
                    </h4>
                    <ul className="space-y-1">
                      {activeDiagnosticExam.diagnostic.key_conceptual_gaps.map((gap, i) => (
                        <li key={i} className="text-xs text-amber-950 font-medium flex items-start gap-1.5">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 5. Improvement Guidance */}
                {activeDiagnosticExam.diagnostic?.improvement_tips?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-blue-600" />
                      <span>Actionable Remediation Guidance</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeDiagnosticExam.diagnostic.improvement_tips.map((tip, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-xs text-gray-800 font-medium bg-blue-50/40 p-3 rounded-xl border border-blue-100/60"
                        >
                          <TrendingUp className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Question-By-Question ScoreCard Breakdown (with Ideal Answer reveal) */}
                {activeDiagnosticExam.grades?.length > 0 && (
                  <div className="pt-2">
                    <ScoreCard
                      grades={activeDiagnosticExam.grades}
                      questions={activeDiagnosticExam.exam_questions || []}
                      answers={activeDiagnosticExam.saved_answers || {}}
                    />
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 sm:px-8 py-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveDiagnosticExam(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition"
                >
                  Close Report
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const subj = activeDiagnosticExam.subject
                    setActiveDiagnosticExam(null)
                    openWeakTopicsModal(subj)
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>Practice Weak Topics</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Practice Weak Topics Popup Modal (Portaled to document.body) */}
      {isWeakModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isGeneratingTest) {
                setIsWeakModalOpen(false)
              }
            }}
          >
            <div className="bg-white w-full max-w-2xl h-[600px] max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100">
              {/* Modal Header */}
              <div className="px-6 sm:px-8 py-5 bg-white border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-gray-900 text-lg">
                      Practice Weak Topics
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => !isGeneratingTest && setIsWeakModalOpen(false)}
                  disabled={isGeneratingTest}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Controls Bar: Subject Dropdown & Topic Search Bar */}
              <div className="p-6 pb-4 bg-gray-50/70 border-b border-gray-100 space-y-3 flex-shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Subject Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                      Select Subject
                    </label>
                    <div className="relative">
                      <select
                        value={modalSubject}
                        onChange={(e) => handleModalSubjectChange(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition shadow-2xs pr-9"
                      >
                        {allKnownSubjects.map((sub) => {
                          const count = getWeakTopicsForSubject(sub).length
                          return (
                            <option key={sub} value={sub}>
                              {sub} {count > 0 ? `(${count} weak ${count === 1 ? "topic" : "topics"})` : "(No weak topics logged)"}
                            </option>
                          )
                        })}
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                      Filter Topics
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={modalSearchTerm}
                        onChange={(e) => setModalSearchTerm(e.target.value)}
                        placeholder={`Search topics in ${modalSubject}...`}
                        className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-8 py-2.5 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition shadow-2xs"
                      />
                      {modalSearchTerm && (
                        <button
                          onClick={() => setModalSearchTerm("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub-bar: Selection stats & Quick actions */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-semibold text-[11px]">
                      Showing {filteredModalTopics.length} of {currentSubjectTopics.length} topics
                    </span>
                    {selectedTopics.length > 0 && (
                      <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md text-[10px]">
                        {selectedTopics.length} selected
                      </span>
                    )}
                  </div>
                  {filteredModalTopics.length > 0 && (
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleSelectAllFiltered}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={handleClearSelections}
                        className="text-[11px] font-bold text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Topics Multi-Select Scrollable Area */}
              <div className="p-6 flex-1 min-h-0 overflow-y-auto space-y-2.5 custom-scrollbar">
                {loadingServerTopics && (
                  <div className="py-2 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                    <span>Syncing topic data...</span>
                  </div>
                )}

                {filteredModalTopics.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10 px-4 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 mx-auto flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-800">
                        {modalSearchTerm
                          ? `No topics found matching "${modalSearchTerm}"`
                          : `No weak topics logged for ${modalSubject} yet.`}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1 max-w-sm mx-auto">
                        {modalSearchTerm
                          ? "Try searching for a different keyword or select another subject."
                          : "Take a practice test for this subject first to discover conceptual gaps, or switch subjects in the dropdown."}
                      </p>
                    </div>
                    {modalSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setModalSearchTerm("")}
                        className="text-xs font-bold text-amber-600 hover:underline cursor-pointer"
                      >
                        Clear Search Filter
                      </button>
                    )}
                  </div>
                ) : (
                  filteredModalTopics.map((item) => {
                    const isSelected = selectedTopics.includes(item.topic)
                    return (
                      <div
                        key={item.topic}
                        onClick={() => toggleTopicSelection(item.topic)}
                        className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-amber-50/70 border-amber-300 shadow-2xs"
                            : "bg-white hover:bg-gray-50/80 border-gray-200/80"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center transition flex-shrink-0 ${
                              isSelected
                                ? "bg-amber-500 border-amber-500 text-white"
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate" title={item.topic}>
                              {item.topic}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {item.count > 0
                                ? `Flagged in ${item.count} test${item.count > 1 ? "s" : ""}`
                                : "Syllabus topic"}
                            </p>
                          </div>
                        </div>

                        {item.isFlagged && (
                          <span className="flex-shrink-0 text-[10px] font-bold bg-amber-100/80 text-amber-800 px-2.5 py-0.5 rounded-md">
                            Weak Area
                          </span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Error Notice */}
              {generationError && (
                <div className="px-6 py-2.5 bg-red-50 border-t border-red-100 text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
                  <span className="font-semibold">{generationError}</span>
                </div>
              )}

              {/* Modal Footer */}
              <div className="px-6 sm:px-8 py-4 bg-gray-50/90 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
                {/* Format Preset Buttons */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-500">Format:</span>
                  <button
                    type="button"
                    onClick={() => setTestPreset("quick")}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                      testPreset === "quick"
                        ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    Quick (20m)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestPreset("standard")}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                      testPreset === "standard"
                        ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    Standard (40m)
                  </button>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setIsWeakModalOpen(false)}
                    disabled={isGeneratingTest}
                    className="px-4 py-2.5 border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={selectedTopics.length === 0 || isGeneratingTest}
                    onClick={handleGenerateWeakTopicExam}
                    className={`font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer ${
                      selectedTopics.length === 0 || isGeneratingTest
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                        : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/25"
                    }`}
                  >
                    {isGeneratingTest ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating Test...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 fill-white" />
                        <span>
                          Generate Test {selectedTopics.length > 0 ? `(${selectedTopics.length})` : ""}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
