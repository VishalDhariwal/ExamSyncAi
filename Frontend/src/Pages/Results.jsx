import ScoreCard from "../components/ScoreCard"

export default function Results(){

  const data = JSON.parse(localStorage.getItem("result"))

  const grades = data.grades || []
  const report = data.diagnostic_report || {}

  return(

    <div className="p-10">

      <h1 className="text-3xl font-bold mb-6">
        Evaluation
      </h1>

      <ScoreCard grades={grades} />

      {report && (

        <div className="mt-8 bg-white p-6 shadow rounded-xl">

          <h2 className="font-bold mb-3">
            Overall Feedback
          </h2>

          <p>{report.overall_feedback}</p>

          <h3 className="mt-4 font-semibold">
            Weak Topics
          </h3>

          <p>{report.weak_topics?.join(", ")}</p>

          <h3 className="mt-4 font-semibold">
            Improvement Tips
          </h3>

          <ul className="list-disc ml-6">
            {report.improvement_tips?.map((t,i)=>(
              <li key={i}>{t}</li>
            ))}
          </ul>

        </div>

      )}

    </div>
  )
}