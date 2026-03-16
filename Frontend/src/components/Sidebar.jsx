import { motion } from "framer-motion"

export default function Sidebar({ email, semester, setSemester, subject, setSubject, generate }) {

  return (
    <motion.div
      initial={{ x: -200 }}
      animate={{ x: 0 }}
      className="w-64 bg-gray-900 text-white p-6 h-screen"
    >

      <h2 className="text-xl font-bold mb-6">StudySync AI</h2>

      <p className="mb-4 text-sm">Logged in as:</p>
      <p className="mb-6">{email}</p>

      <label className="block mb-2">Semester</label>

      <select
        value={semester}
        onChange={(e)=>setSemester(e.target.value)}
        className="w-full mb-4 p-2 rounded text-black"
      >
        {[1,2,3,4,5,6,7,8].map(s=>(
          <option key={s}>{s}</option>
        ))}
      </select>

      <label className="block mb-2">Subject</label>

      <select
        value={subject}
        onChange={(e)=>setSubject(e.target.value)}
        className="w-full mb-6 p-2 rounded text-black"
      >
        <option>OS</option>
        <option>DBMS</option>
        <option>DSA</option>
        <option>AI/ML</option>
      </select>

      <button
        onClick={generate}
        className="bg-blue-500 w-full p-3 rounded"
      >
        Generate Mock Exam
      </button>

    </motion.div>
  )
}