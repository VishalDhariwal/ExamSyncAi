import { useEffect, useState } from "react"
import { getExamHistory } from "../api/api"
import Header from "../components/Header"
import { useNavigate } from "react-router-dom"

export default function History() {
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/")
      return
    }

    const loadHistory = async () => {
      try {
        setLoading(true)
        const res = await getExamHistory()
        setTests(res.data || [])
      } catch (err) {
        console.error("Failed to fetch exam history:", err)
        if (err.response?.status === 401) {
          localStorage.removeItem("token")
          navigate("/")
        }
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [navigate])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="p-10 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">
          Your Exam History 📊
        </h1>

        {loading && (
          <p className="text-gray-500">Loading your exam records from PostgreSQL...</p>
        )}

        {!loading && tests.length === 0 && (
          <div className="bg-white p-8 rounded-xl shadow text-center">
            <p className="text-gray-600">No exams submitted yet.</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="mt-4 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-medium transition"
            >
              Take Your First Exam
            </button>
          </div>
        )}

        {tests.map((test) => (
          <div
            key={test.id}
            className="bg-white shadow-md border border-gray-100 rounded-xl p-6 mb-4 hover:shadow-lg transition"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {test.subject} — Semester {test.semester}
                </h3>
                {test.created_at && (
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(test.created_at).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold text-lg">
                {test.score} / {test.max_score}
              </div>
            </div>

            {test.diagnostic && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700">
                  {test.diagnostic.overall_feedback}
                </p>

                {test.diagnostic.weak_topics && test.diagnostic.weak_topics.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-red-600 font-semibold">Focus Areas:</span>
                    {test.diagnostic.weak_topics.map((t, idx) => (
                      <span
                        key={idx}
                        className="bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded-full border border-red-100"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}