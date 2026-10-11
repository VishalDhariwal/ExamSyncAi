import { useState, useEffect } from "react"
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
} from "lucide-react"
import { getExamHistory } from "../api/api"
import {
  getPendingExams,
  resumePendingExam,
  removePendingExam,
} from "../utils/examStorage"

export default function Reports() {
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [pendingExams, setPendingExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedExamId, setExpandedExamId] = useState(null)
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("ALL")

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
    fetchHistory()
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

  // Collect weak topics
  const allWeakTopics = Array.from(
    new Set(
      exams
        .flatMap((e) => e.diagnostic?.weak_topics || [])
        .filter(Boolean)
    )
  )

  const subjects = Array.from(new Set(exams.map((e) => e.subject).filter(Boolean)))

  const filteredExams = exams.filter((e) => {
    if (selectedSubjectFilter === "ALL") return true
    return e.subject.toUpperCase() === selectedSubjectFilter.toUpperCase()
  })

  const toggleExpand = (id) => {
    setExpandedExamId(expandedExamId === id ? null : id)
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
          <button
            onClick={() => navigate("/practice")}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-md flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>Start Practice Test</span>
          </button>
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

        {/* Global Weak Topics Pills */}
        {allWeakTopics.length > 0 && (
          <div className="pt-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Frequent Areas for Improvement:
            </p>
            <div className="flex flex-wrap gap-2">
              {allWeakTopics.map((topic, idx) => (
                <span
                  key={idx}
                  className="bg-red-50 text-red-700 border border-red-100 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3 h-3 text-red-600" />
                  <span>{topic}</span>
                </span>
              ))}
            </div>
          </div>
        )}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        <div className="space-y-4">
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
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-gray-900">{exam.subject}</h4>
                        {exam.semester && (
                          <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                            Sem {exam.semester}
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

                      {exam.diagnostic.weak_topics?.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-[11px] font-bold text-red-600">Weak Topics:</span>
                          {exam.diagnostic.weak_topics.map((t, idx) => (
                            <span
                              key={idx}
                              className="bg-red-50 text-red-600 border border-red-100 text-[11px] px-2.5 py-0.5 rounded-md font-medium"
                            >
                              {t}
                            </span>
                          ))}
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
                        onClick={() => navigate(`/results?id=${exam.id}`)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                      >
                        <span>Open Full AI Diagnostic</span>
                        <Zap className="w-3 h-3 fill-blue-600" />
                      </button>
                    </div>

                    <div className="space-y-3">
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
    </div>
  )
}
