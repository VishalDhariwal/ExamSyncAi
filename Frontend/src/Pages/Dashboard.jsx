import { useState } from "react"
import { useNavigate } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import Header from "../components/Header"
import { generateExam } from "../api/api"
import AILoader from "../components/AILoader"
import { useEffect } from "react"



export default function Dashboard(){

  const navigate = useNavigate()

  const [semester,setSemester] = useState(3)
  const [subject,setSubject] = useState("DBMS")
  const [loading,setLoading] = useState(false)

  const email = localStorage.getItem("user")
  useEffect(() => {
    const user = localStorage.getItem("user")

    if(!user){
      navigate("/")
    }

  }, [navigate])
  const generate = async () => {

    try {

      setLoading(true)

      const res = await generateExam({
        student_id: email,
        semester: Number(semester),
        subject
      })

      localStorage.setItem("exam", JSON.stringify(res.data))

      navigate("/exam")

    } catch(err) {

      console.error("Generate exam failed:", err)
      alert("Failed to generate exam. Please try again.")

    } finally {

      setLoading(false)

    }
  }

  return(

    <div className="h-screen flex flex-col">

      {/* Header */}
      <Header />

      <div className="flex flex-1">

        {/* Sidebar */}
        <Sidebar
          email={email}
          semester={semester}
          setSemester={setSemester}
          subject={subject}
          setSubject={setSubject}
          generate={generate}
        />

        {/* Main Content */}
        <div className="p-10 flex-1">

          <h1 className="text-3xl font-bold mb-4">
            Welcome to StudySync AI 🎓
          </h1>

          <p className="text-gray-600 mb-6">
            Generate AI mock exams based on previous year questions and notes.
          </p>

          {loading && <AILoader />}

        </div>

      </div>

    </div>
  )
}