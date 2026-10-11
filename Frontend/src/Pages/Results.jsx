import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  CheckCircle2,
  Zap,
  BarChart3,
  AlertTriangle,
  Lightbulb,
  FileText,
  Activity,
  Loader2,
  Award,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react"
import ScoreCard from "../components/ScoreCard"
import { getExamSessionApi } from "../api/api"

export default function Results() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const examIdParam = searchParams.get("id")

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(Boolean(examIdParam))

  useEffect(() => {
    const loadResult = async () => {
      if (examIdParam) {
        try {
          setLoading(true)
          const res = await getExamSessionApi(examIdParam)
          if (res.data) {
            setData(res.data)
            return
          }
        } catch (err) {
          console.error("Failed to load exam session from DB:", err)
        } finally {
          setLoading(false)
        }
      }

      // Fallback to recent local result
      const raw = localStorage.getItem("result")
      if (raw) {
        try {
          setData(JSON.parse(raw))
        } catch (e) {
          console.error("Failed to parse local result:", e)
        }
      }
    }

    loadResult()
  }, [examIdParam])

  if (loading) {
    return (
      <div className="w-full text-center py-24">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-xs text-gray-500 font-medium">
          Retrieving evaluation report from PostgreSQL database...
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="w-full max-w-lg mx-auto text-center py-20 bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
        <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">No Evaluation Result Found</h2>
        <p className="text-xs text-gray-500 mb-6">
          Submit an exam first to see your evaluation and AI diagnostic report.
        </p>
        <button
          onClick={() => navigate("/practice")}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition shadow-md"
        >
          Go to Practice
        </button>
      </div>
    )
  }

  const grades = data.grades || []
  const report = data.diagnostic_report || data.diagnostic || {}
  const questions = data.exam_questions || []
  const answers = data.saved_answers || data.student_answers || {}

  const weakTopics = report.weak_topics || []
  const strongTopics = report.strong_topics || []
  const conceptualGaps = report.key_conceptual_gaps || []
  const improvementTips = report.improvement_tips || []

  const handlePracticeWeak = () => {
    navigate("/practice")
  }

  return (
    <div className="w-full space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-2 border border-blue-100">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Exam Evaluated Successfully</span>
            {report.summary_badge && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-blue-900 font-extrabold">{report.summary_badge}</span>
              </>
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Your Exam Score & AI Diagnostic Report
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Deterministic grading for MCQs and LangGraph rubric assessment for subjective answers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate("/practice")}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-md flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>Take Another Test</span>
          </button>
          <button
            onClick={() => navigate("/reports")}
            className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5 text-gray-500" />
            <span>View in Reports</span>
          </button>
        </div>
      </div>

      {/* Score Card Component with Model Answer Accordions */}
      <ScoreCard grades={grades} questions={questions} answers={answers} />

      {/* AI Diagnostic Report */}
      {report && (
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-8">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Comprehensive AI Diagnostic Evaluation
                </h3>
                <p className="text-xs text-gray-500">
                  Identified strengths, conceptual gaps, and targeted remediation roadmap.
                </p>
              </div>
            </div>

            {report.performance_band && (
              <span className="px-3.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
                Tier: {report.performance_band}
              </span>
            )}
          </div>

          {/* 1. Overall Examiner Holistic Feedback */}
          {report.overall_feedback && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                Overall Examiner Assessment
              </h4>
              <p className="text-sm text-gray-800 leading-relaxed bg-gray-50 p-5 rounded-2xl border border-gray-100">
                {report.overall_feedback}
              </p>
            </div>
          )}

          {/* 2. Strengths & Focus Areas Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strong Topics */}
            <div className="p-5 rounded-2xl bg-emerald-50/40 border border-emerald-100/80 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Demonstrated Strengths</span>
              </h4>
              {strongTopics.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {strongTopics.map((topic, i) => (
                    <span
                      key={i}
                      className="bg-white text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-xs font-semibold shadow-2xs"
                    >
                      ✓ {topic}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">
                  Keep practicing to establish high-confidence mastery areas.
                </p>
              )}
            </div>

            {/* Weak Topics */}
            <div className="p-5 rounded-2xl bg-red-50/40 border border-red-100/80 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Priority Focus Areas</span>
              </h4>
              {weakTopics.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {weakTopics.map((topic, i) => (
                    <span
                      key={i}
                      className="bg-white text-red-700 border border-red-200 px-3 py-1 rounded-full text-xs font-semibold shadow-2xs"
                    >
                      ! {topic}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-emerald-700 font-semibold">
                  No critical topic weaknesses detected in this exam!
                </p>
              )}
            </div>
          </div>

          {/* 4. Key Conceptual Gaps */}
          {conceptualGaps.length > 0 && (
            <div className="p-5 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Identified Conceptual Gaps From Rubric</span>
              </h4>
              <ul className="space-y-1.5">
                {conceptualGaps.map((gap, i) => (
                  <li key={i} className="text-xs text-amber-950 font-medium flex items-start gap-2">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 5. Actionable Improvement Guidance */}
          {improvementTips.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2.5 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-blue-600" />
                <span>Actionable Remediation Guidance</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {improvementTips.map((tip, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 text-xs text-gray-800 font-medium bg-blue-50/40 p-3.5 rounded-2xl border border-blue-100/60"
                  >
                    <TrendingUp className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. Action Loop: Practice Weak Topics */}
          {weakTopics.length > 0 && (
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl">
              <div>
                <h5 className="text-xs font-bold text-blue-900">
                  Ready to turn your weak areas into strengths?
                </h5>
                <p className="text-[11px] text-blue-700">
                  Generate a targeted mock exam focusing on: {weakTopics.slice(0, 2).join(", ")}.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePracticeWeak}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-sm flex items-center gap-1.5 flex-shrink-0"
              >
                <span>Practice Weak Topics</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}