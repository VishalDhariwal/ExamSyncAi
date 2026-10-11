import { useNavigate } from "react-router-dom"
import {
  CheckCircle2,
  Zap,
  BarChart3,
  AlertTriangle,
  Lightbulb,
  FileText,
  Activity,
} from "lucide-react"
import ScoreCard from "../components/ScoreCard"

export default function Results() {
  const navigate = useNavigate()
  const raw = localStorage.getItem("result")
  const data = raw ? JSON.parse(raw) : null

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
  const report = data.diagnostic_report || {}

  return (
    <div className="w-full space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-2 border border-blue-100">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Exam Evaluated Successfully</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Your Exam Score & AI Diagnostic Report
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Deterministic grading for MCQs and LangGraph rubric assessment for subjective answers.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Score Card Component */}
      <ScoreCard grades={grades} />

      {/* AI Diagnostic Report */}
      {report && (
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
            <Activity className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">AI Diagnostic Evaluation</h3>
          </div>

          {report.overall_feedback && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Overall Examiner Feedback
              </h4>
              <p className="text-sm text-gray-800 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100">
                {report.overall_feedback}
              </p>
            </div>
          )}

          {report.weak_topics?.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-red-500 mb-2">
                Weak Topics / Focus Areas
              </h4>
              <div className="flex flex-wrap gap-2">
                {report.weak_topics.map((topic, i) => (
                  <span
                    key={i}
                    className="bg-red-50 text-red-700 border border-red-100 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3 h-3 text-red-600" />
                    <span>{topic}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {report.improvement_tips?.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">
                Actionable Improvement Tips
              </h4>
              <ul className="space-y-2">
                {report.improvement_tips.map((tip, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-xs text-gray-700 font-medium bg-blue-50/40 p-3 rounded-xl border border-blue-100/60"
                  >
                    <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}