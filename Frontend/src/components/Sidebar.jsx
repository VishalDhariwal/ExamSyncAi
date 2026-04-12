import { motion } from "framer-motion"
import { getStructure } from "../api/api"
import { useEffect, useState } from "react"

export default function Sidebar({
  email,
  semester,
  setSemester,
  subject,
  setSubject,
  generate
}) {

  const [structure, setStructure] = useState({})

  // ================= LOAD STRUCTURE =================
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getStructure()
        setStructure(res.data || {})
      } catch (err) {
        console.error("Structure load failed:", err)
        setStructure({})
      }
    }

    load()
  }, [])

  // ================= DERIVED DATA =================
  const semesters = Object.keys(structure)
const subjects = structure?.[`sem${semester}`]
  ? Object.keys(structure[`sem${semester}`])
  : []

  return (
    <motion.div
      initial={{ x: -200 }}
      animate={{ x: 0 }}
      className="w-64 bg-gray-900 text-white p-6 h-screen overflow-y-auto"
    >

      <h2 className="text-xl font-bold mb-6">StudySync AI</h2>

      <p className="text-sm">Logged in as:</p>
      <p className="mb-6">{email}</p>

      {/* ================= SEMESTER ================= */}
      <label className="block mb-2">Semester</label>

      <select
        value={semester}
        onChange={(e) => {
          setSemester(Number(e.target.value)) // 🔥 FIX TYPE BUG (important)
          setSubject("")
        }}
        className="w-full mb-4 p-2 rounded text-black"
      >
        {semesters.length > 0 ? (
          semesters.map((sem) => (
            <option key={sem} value={sem.replace("sem", "")}>
              {sem}
            </option>
          ))
        ) : (
          [1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))
        )}
      </select>

      {/* ================= SUBJECT ================= */}
      <label className="block mb-2">Subject</label>

      <select
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="w-full mb-6 p-2 rounded text-black"
      >
        {subjects.length > 0 ? (
          subjects.map((sub) => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))
        ) : (
          <option value="">No subjects found</option>
        )}
      </select>

      {/* ================= BUTTON ================= */}
      <button
        onClick={generate}
        className="bg-blue-500 w-full p-3 rounded"
      >
        Generate Mock Exam
      </button>

    </motion.div>
  )
}