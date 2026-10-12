import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  Zap,
  BookOpen,
  FileText,
  Target,
  TrendingUp,
  Award,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Calendar,
  Play,
  Clock,
  Trash2,
} from "lucide-react"
import { getExamHistory, getDocuments, getSubjects, getMe } from "../api/api"
import {
  getPendingExams,
  resumePendingExam,
  removePendingExam,
  getTrueMaxScore,
  getTrueScore,
} from "../utils/examStorage"

export default function Home() {
  const navigate = useNavigate()

  const getInitialName = () => {
    try {
      const explicit = localStorage.getItem("userName")
      if (explicit && explicit.trim()) return explicit.trim()
      const stored = JSON.parse(localStorage.getItem("userData") || "{}")
      if (stored.full_name && stored.full_name.trim()) return stored.full_name.trim()
      const email = localStorage.getItem("user") || ""
      if (email.includes("@")) return email.split("@")[0]
    } catch (_) {}
    return "Student"
  }

  const [studentName, setStudentName] = useState(getInitialName())
  const [isFirstSignup] = useState(() => localStorage.getItem("isNewUser") === "true")

  const [loading, setLoading] = useState(true)
  const [exams, setExams] = useState([])
  const [documents, setDocuments] = useState([])
  const [subjects, setSubjects] = useState([])
  const [pendingExams, setPendingExams] = useState([])

  const refreshPending = async () => {
    const list = await getPendingExams()
    setPendingExams(list || [])
  }

  useEffect(() => {
    // Consume the first-time signup flag so subsequent logins/visits show "Welcome back"
    if (localStorage.getItem("isNewUser") === "true") {
      localStorage.removeItem("isNewUser")
    }

    refreshPending()
    const fetchData = async () => {
      try {
        setLoading(true)
        const [examsRes, docsRes, subsRes, meRes] = await Promise.allSettled([
          getExamHistory(),
          getDocuments(),
          getSubjects(),
          getMe(),
        ])

        if (examsRes.status === "fulfilled") setExams(examsRes.value.data || [])
        const docs = docsRes.status === "fulfilled" ? docsRes.value.data || [] : []
        setDocuments(docs)
        if (subsRes.status === "fulfilled") {
          const userDocSubs = new Set(docs.map((d) => (d.subject || "").toUpperCase()))
          const cleanedSubs = (subsRes.value.data || []).filter(
            (s) =>
              s &&
              (userDocSubs.has(s.toUpperCase()) ||
                (s.toUpperCase() !== "DSA" && s.toUpperCase() !== "DBMS"))
          )
          setSubjects(cleanedSubs)
        }
        if (meRes.status === "fulfilled" && meRes.value.data) {
          const profile = meRes.value.data
          if (profile.full_name && profile.full_name.trim()) {
            setStudentName(profile.full_name.trim())
            localStorage.setItem("userName", profile.full_name.trim())
          }
        }
      } catch (err) {
        console.error("Failed to load dashboard metrics:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Calculate statistics
  const totalExams = exams.length
  const totalDocs = documents.length

  const avgScorePercent =
    totalExams > 0
      ? Math.round(
          exams.reduce((sum, e) => {
            const max = getTrueMaxScore(e)
            const score = getTrueScore(e)
            return sum + (score / max) * 100
          }, 0) / totalExams
        )
      : null

  // Subject proficiency calculation
  const subjectProficiency = subjects.map((sub) => {
    const subExams = exams.filter(
      (e) => e.subject && e.subject.toUpperCase() === sub.toUpperCase()
    )
    if (subExams.length === 0) {
      return { subject: sub, attempts: 0, avg: 0, status: "Not Tested" }
    }
    const avg = Math.round(
      subExams.reduce((sum, e) => sum + (getTrueScore(e) / getTrueMaxScore(e)) * 100, 0) /
        subExams.length
    )
    const status = avg >= 75 ? "High Proficiency" : avg >= 50 ? "Proficient" : "Needs Review"
    return { subject: sub, attempts: subExams.length, avg, status }
  })

  // Weak topics extracted from diagnostics
  const allWeakTopics = exams
    .flatMap((e) => e.diagnostic?.weak_topics || [])
    .filter(Boolean)

  const weakTopicCounts = allWeakTopics.reduce((acc, t) => {
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})

  const topWeakTopics = Object.entries(weakTopicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  const firstName = studentName ? studentName.trim().split(" ")[0] : "Student"

  return (
    <div className="w-full space-y-8">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-8 text-white shadow-xl shadow-blue-500/10">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {isFirstSignup ? "Welcome, " : "Welcome back, "}
            <span className="capitalize">{firstName}</span>!
          </h1>
          <p className="mt-2 text-sm text-blue-100 leading-relaxed">
            Ready to test your knowledge? Upload study documents, configure custom exam patterns,
            and get instant diagnostic AI feedback.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/practice")}
              className="bg-white text-blue-700 hover:bg-blue-50 font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-md active:scale-95 flex items-center gap-2"
            >
              <Zap className="w-3.5 h-3.5 fill-blue-700" />
              <span>Start Practice Exam</span>
            </button>
            <button
              onClick={() => navigate("/materials")}
              className="bg-blue-800/60 hover:bg-blue-800/80 text-white font-semibold px-4 py-2.5 rounded-xl text-xs border border-white/20 transition backdrop-blur-sm flex items-center gap-2"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Upload Notes</span>
            </button>
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* Pending Exams Section */}
      {pendingExams.length > 0 && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 tracking-tight">
                  In-Progress Mock Exams ({pendingExams.length})
                </h2>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingExams.map((p) => {
              const answered = p.answeredCount || 0
              const total = p.totalQuestions || p.exam_questions?.length || 0
              const pct = total > 0 ? Math.round((answered / total) * 100) : 0

              return (
                <div
                  key={p.id}
                  className="bg-gray-50/70 hover:bg-gray-50 rounded-2xl p-5 border border-gray-200/70 shadow-xs flex flex-col justify-between gap-4 transition hover:border-blue-200"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-150 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                        <span>In Progress</span>
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium">
                        {p.savedAt ? new Date(p.savedAt).toLocaleDateString() : "Saved"}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-gray-900 truncate">{p.subject}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {answered} of {total} answered ({pct}%)
                      </p>
                    </div>

                    <div className="w-full bg-gray-200/80 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-200/60">
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
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 px-3.5 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Resume Test</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Exams Taken</p>
            <p className="text-2xl font-black text-gray-900">{totalExams}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Average Score</p>
            <p className="text-2xl font-black text-gray-900">
              {avgScorePercent !== null ? `${avgScorePercent}%` : "—"}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Study Files</p>
            <p className="text-2xl font-black text-gray-900">{totalDocs}</p>
          </div>
        </div>
      </div>

      {/* Student Analytics & Performance Intelligence (Replaces previous 3 action cards) */}
      <div className="bg-white rounded-3xl p-7 border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                Learning Analytics & Subject Mastery
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Real-time diagnostic metrics aggregated from your submitted exam evaluations.
            </p>
          </div>

          <button
            onClick={() => navigate("/practice")}
            className="self-start sm:self-auto text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
          >
            <span>Configure Next Test</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subject Mastery Progress Bars */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Subject Proficiency Overview
            </h3>

            {subjectProficiency.length === 0 ? (
              <div className="p-6 bg-gray-50 rounded-2xl text-center border border-dashed border-gray-200">
                <BookOpen className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-gray-600">No study subjects uploaded</p>
                <button
                  onClick={() => navigate("/materials")}
                  className="mt-2 text-xs text-blue-600 font-bold hover:underline"
                >
                  Upload your notes &rarr;
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                {subjectProficiency.map((item) => (
                  <div
                    key={item.subject}
                    className="p-4 rounded-2xl bg-gray-50/70 border border-gray-100 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">{item.subject}</span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          ({item.attempts} {item.attempts === 1 ? "attempt" : "attempts"})
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          item.attempts === 0
                            ? "bg-gray-100 text-gray-500 border border-gray-200"
                            : item.avg >= 75
                            ? "bg-blue-100 text-blue-800"
                            : item.avg >= 50
                            ? "bg-blue-50 text-blue-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {item.attempts > 0 ? `${item.avg}% • ${item.status}` : "Unattempted"}
                      </span>
                    </div>

                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      {item.attempts > 0 && item.avg > 0 ? (
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${item.avg}%` }}
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Diagnostic Focus & AI Insights */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Diagnostic Insights & Weak Areas
            </h3>

            {topWeakTopics.length === 0 ? (
              <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 text-center flex flex-col items-center justify-center h-[calc(100%-2rem)]">
                <CheckCircle2 className="w-8 h-8 text-blue-600 mb-2" />
                <p className="text-xs font-bold text-gray-800">No Weak Topics Flagged</p>
                <p className="text-[11px] text-gray-500 mt-1 max-w-xs leading-relaxed">
                  {totalExams === 0
                    ? "Complete your first practice test to generate AI diagnostic insights."
                    : "Outstanding work! Your answers are scoring high across evaluated concepts."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="text-xs font-bold">Priority Focus Areas from Recent Exams</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {topWeakTopics.map(([topic, count]) => (
                      <span
                        key={topic}
                        className="bg-white/90 text-amber-800 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-amber-200/60 shadow-2xs"
                      >
                        {topic} <span className="text-amber-500 font-bold ml-1">×{count}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                      AI Recommendation
                    </span>
                    <p className="text-xs text-gray-800 font-medium mt-0.5">
                      Generate a targeted short quiz to master these concepts.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/practice")}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5"
                  >
                    <span>Practice Now</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Exams */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-gray-900">Recent Exam Attempts</h2>
            </div>
            <button
              onClick={() => navigate("/reports")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View All ({exams.length})</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-gray-400 py-6 text-center">Loading exam records...</p>
          ) : exams.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-600">No exams taken yet</p>
              <button
                onClick={() => navigate("/practice")}
                className="mt-3 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-lg transition"
              >
                Take Your First Exam
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {exams.slice(0, 3).map((exam) => (
                <div
                  key={exam.id}
                  onClick={() => navigate("/reports")}
                  className="p-3.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{exam.subject}</h4>
                    <p className="text-[11px] text-gray-400">
                      {exam.created_at ? new Date(exam.created_at).toLocaleDateString() : "Recent"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                      {getTrueScore(exam)} / {getTrueMaxScore(exam)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ready Subjects & Library Summary */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-gray-900">Available Subjects</h2>
            </div>
            <button
              onClick={() => navigate("/materials")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>Manage ({documents.length} docs)</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-gray-400 py-6 text-center">Loading subjects...</p>
          ) : subjects.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-600">No subjects indexed</p>
              <button
                onClick={() => navigate("/materials")}
                className="mt-3 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-lg transition"
              >
                Upload First Material
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subjects.map((sub) => (
                <button
                  key={sub}
                  onClick={() => navigate(`/practice?subject=${encodeURIComponent(sub)}`)}
                  className="px-3.5 py-2 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-xs font-medium text-gray-700 hover:text-blue-700 transition flex items-center gap-2"
                >
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                  <span>{sub}</span>
                  <span className="text-[10px] text-blue-600 font-bold ml-1 flex items-center gap-0.5">
                    <Zap className="w-2.5 h-2.5 fill-blue-600" />
                    <span>Practice</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
