export default function ScoreCard({ grades }) {

  const total = grades.reduce((a,b)=>a+b.score,0)
  const max = grades.reduce((a,b)=>a+b.max_marks,0)

  return (
    <div className="bg-white shadow rounded-xl p-6">

      <h2 className="text-xl font-bold mb-4">
        Total Score: {total} / {max}
      </h2>

      {grades.map(g=>(
        <div key={g.question_id} className="mb-3">

          <p className="font-semibold">
            Q{g.question_id}: {g.score}/{g.max_marks}
          </p>

          <p className="text-sm text-gray-600">
            {g.feedback || g.justification}
          </p>

        </div>
      ))}

    </div>
  )
}