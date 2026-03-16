import { useEffect, useState } from "react"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../firebase/firebase"
import Header from "../components/Header"

export default function History() {

  const [tests,setTests] = useState([])
  const email = localStorage.getItem("user")

  useEffect(()=>{

    const loadHistory = async ()=>{

      const q = query(
        collection(db,"exam_results"),
        where("user","==",email)
      )

      const snapshot = await getDocs(q)

      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      setTests(data)
    }

    loadHistory()

  },[])

  return (

    <div>

      <Header />

      <div className="p-10">

        <h1 className="text-3xl font-bold mb-6">
          Exam History
        </h1>

        {tests.length === 0 && (
          <p>No tests found</p>
        )}

        {tests.map(test => (

          <div
            key={test.id}
            className="bg-white shadow rounded-xl p-6 mb-4"
          >

            <h3 className="font-bold">
              {test.subject} — Semester {test.semester}
            </h3>

            <p className="mt-2">
              Score: {test.score} / {test.max_score}
            </p>

            {test.diagnostic && (
              <p className="text-sm text-gray-600 mt-2">
                {test.diagnostic.overall_feedback}
              </p>
            )}

          </div>

        ))}

      </div>

    </div>

  )
}