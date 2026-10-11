import { Award, CheckCircle2, MessageSquare } from "lucide-react"

export default function ScoreCard({ grades = [] }) {
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

      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Question-By-Question Evaluation
        </h3>

        {uniqueGrades.map((g) => (
          <div
            key={g.question_id}
            className="p-4 rounded-2xl bg-gray-50/70 border border-gray-100 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900">
                Question {g.question_id}
              </span>
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                {g.score} / {g.max_marks} Marks
              </span>
            </div>

            {(g.feedback || g.justification) && (
              <p className="text-xs text-gray-600 leading-relaxed flex items-start gap-1.5 pt-1">
                <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                <span>{g.feedback || g.justification}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}