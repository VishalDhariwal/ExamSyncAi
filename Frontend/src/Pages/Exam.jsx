import { useState } from "react"
import QuestionCard from "../components/QuestionCard"
import { submitExam } from "../api/api"
import { useNavigate } from "react-router-dom"

export default function Exam(){

  const navigate = useNavigate()

  const exam = JSON.parse(localStorage.getItem("exam"))

  const email = localStorage.getItem("user")  

  const [answers,setAnswers] = useState({})
  const [clicked, setClicked] = useState(false);

  const setAnswer = (id,value)=>{
    setAnswers({...answers,[id]:value})
  }

  const handleClick = () => {
    setClicked(true);
    submit(); 
  }

  const submit = async () => {

    const student_answers = exam.exam_questions.map(q=>({
      question_id:q.id,
      answer_text:answers[q.id] || ""
    }))

    const res = await submitExam({
      exam_state: exam,
      student_answers,
      user_email: email
    })

    localStorage.setItem("result",JSON.stringify(res.data))

    navigate("/results")
  }

  if (!exam || !exam.exam_questions || exam.exam_questions.length === 0) {
    return (
      <div className="p-10 max-w-xl mx-auto text-center mt-20 bg-white rounded-2xl shadow p-8">
        <h2 className="text-2xl font-bold mb-2 text-gray-800">No active exam found</h2>
        <p className="text-sm text-gray-500 mb-6">Please launch a mock exam from your dashboard.</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-semibold transition"
        >
          Go to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900">
          Mock Exam: {exam.subject || "Adaptive Assessment"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Standard University Format: 40 Marks • Complete all questions and submit for instant AI evaluation.
        </p>
      </div>

      {exam.exam_questions.map(q=>(
        <QuestionCard
          key={q.id}
          question={q}
          answer={answers[q.id]}
          setAnswer={setAnswer}
        />
      ))}

      <button
        onClick={handleClick}
        className={`p-4 rounded text-white mt-6 ${
          clicked ? "bg-gray-500" : "bg-green-500"
        }`}
      >
        Submit Exam
      </button>

    </div>
  )
}