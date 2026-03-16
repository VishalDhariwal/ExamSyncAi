import { useState } from "react"
import QuestionCard from "../components/QuestionCard"
import { submitExam } from "../api/api"
import { useNavigate } from "react-router-dom"

export default function Exam(){

  const navigate = useNavigate()

  const exam = JSON.parse(localStorage.getItem("exam"))

  const email = localStorage.getItem("user")   // ✅ ADD THIS

  const [answers,setAnswers] = useState({})

  const setAnswer = (id,value)=>{
    setAnswers({...answers,[id]:value})
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

  return(

    <div className="p-10">

      <h1 className="text-3xl font-bold mb-6">
        Mock Exam
      </h1>

      {exam.exam_questions.map(q=>(
        <QuestionCard
          key={q.id}
          question={q}
          answer={answers[q.id]}
          setAnswer={setAnswer}
        />
      ))}

      <button
        onClick={submit}
        className="bg-green-500 p-4 rounded text-white mt-6"
      >
        Submit Exam
      </button>

    </div>
  )
}