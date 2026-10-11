import { useState } from "react"
import { Award, CheckCircle2, MessageSquare, ChevronDown, ChevronUp, Sparkles, Tag, Check, X, AlertCircle } from "lucide-react"

export default function ScoreCard({ grades = [], questions = [], answers = {} }) {
  const [expandedAnswers, setExpandedAnswers] = useState({})

  const toggleIdealAnswer = (qid) => {
    setExpandedAnswers((prev) => ({
      ...prev,
      [qid]: !prev[qid],
    }))
  }

  // Remove duplicate questions
  const uniqueGrades = Object.values(
    grades.reduce((acc, g) => {
      acc[g.question_id] = g
      return acc
    }, {})
  )

  // Calculate totals from cleaned data
  const total = uniqueGrades.reduce((sum, g) => sum + g.score, 0)
  const max = uniqueGrades.reduce((sum, g) => sum + g.max_marks, 0)
  const percentage = max > 0 ? Math.round((total / max) * 100) : 0

  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Award className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Exam Performance
            </span>
            <h2 className="text-2xl font-black text-gray-900">
              Score: {total} / {max} Marks
            </h2>
          </div>
        </div>

        <div className="bg-blue-50 text-blue-700 px-5 py-2.5 rounded-2xl border border-blue-200/80 font-black text-lg self-start sm:self-auto">
          {percentage}% Grade
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Question-By-Question Evaluation & Rubric Breakdown
          </h3>
          <span className="text-[11px] text-gray-500 font-medium">
            {uniqueGrades.length} Questions Evaluated
          </span>
        </div>

        <div className="space-y-4 max-h-[560px] overflow-y-auto pr-2 custom-scrollbar">
          {uniqueGrades.map((g) => {
          const qObj = questions.find((q) => String(q.id) === String(g.question_id))
          const topicName = g.topic || qObj?.topic || "General"
          const isIdealExpanded = expandedAnswers[g.question_id]

          const answerText =
            typeof answers === "object" && !Array.isArray(answers)
              ? answers[g.question_id] || answers[String(g.question_id)]
              : Array.isArray(answers)
              ? answers.find((a) => String(a.question_id) === String(g.question_id))?.answer_text
              : null

          const isFullMarks = g.score === g.max_marks && g.max_marks > 0
          const isZeroMarks = g.score === 0

          const scoreBadgeStyle = isFullMarks
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : isZeroMarks
            ? "bg-red-50 text-red-700 border-red-200"
            : "bg-blue-50 text-blue-700 border-blue-200"

          return (
            <div
              key={g.question_id}
              className="p-5 rounded-2xl bg-gray-50/70 border border-gray-100 space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900">
                    Question {g.question_id}
                  </span>
                  {topicName && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white text-gray-600 border border-gray-200">
                      🏷️ {topicName}
                    </span>
                  )}
                  {qObj?.question_type && (
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                      {qObj.question_type}
                    </span>
                  )}
                </div>

                <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-md border ${scoreBadgeStyle}`}>
                  {g.score} / {g.max_marks} Marks
                </span>
              </div>

              {qObj?.question && (
                <div className="bg-white p-3.5 rounded-xl border border-gray-100 text-xs text-gray-800 font-medium">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                    Question Prompt
                  </span>
                  <p>{qObj.question}</p>
                </div>
              )}

              {answerText !== undefined && answerText !== null && (
                <div className="bg-white p-3.5 rounded-xl border border-gray-100 text-xs text-gray-700">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                    Your Submitted Answer
                  </span>
                  <p className="whitespace-pre-wrap">
                    {answerText || (
                      <span className="text-gray-400 italic">No answer submitted</span>
                    )}
                  </p>
                </div>
              )}

              {(g.feedback || g.justification) && (
                <div className="text-xs text-gray-600 leading-relaxed flex items-start gap-1.5 pt-1">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-900 mr-1">Examiner Assessment:</span>
                    <span>{g.feedback || g.justification}</span>
                  </div>
                </div>
              )}

              {/* Toggle Ideal Answer Comparison */}
              {qObj?.ideal_answer && (
                <div className="pt-1 border-t border-gray-200/60">
                  <button
                    type="button"
                    onClick={() => toggleIdealAnswer(g.question_id)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
                  >
                    <Sparkles className="w-3 h-3 text-blue-500" />
                    <span>{isIdealExpanded ? "Hide Model Answer" : "Reveal Benchmark / Ideal Answer"}</span>
                    {isIdealExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>

                  {isIdealExpanded && (
                    <div className="mt-2.5 p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 text-xs space-y-2 text-gray-800 animate-fadeIn">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block mb-1">
                          Benchmark Answer:
                        </span>
                        <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-blue-950">
                          {qObj.ideal_answer}
                        </p>
                      </div>

                      {(qObj.keywords || qObj.expected_keywords) && (
                        <div className="pt-1.5 border-t border-blue-100">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block mb-1">
                            Key Concepts / Rubric Keywords:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {(Array.isArray(qObj.keywords || qObj.expected_keywords)
                              ? qObj.keywords || qObj.expected_keywords
                              : String(qObj.keywords || qObj.expected_keywords).split(",")
                            ).map((kw, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-white border border-blue-200 rounded text-[10px] font-medium text-blue-800"
                              >
                                {String(kw).trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}