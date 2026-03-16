import { motion } from "framer-motion"

export default function QuestionCard({ question, answer, setAnswer }) {

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-white shadow rounded-xl p-6 mb-4"
    >

      <h3 className="font-bold">
        Q{question.id} ({question.marks} marks)
      </h3>

      <p className="mt-2">{question.question}</p>

      <textarea
        value={answer}
        onChange={(e)=>setAnswer(question.id, e.target.value)}
        className="w-full mt-4 border p-3 rounded"
        rows="4"
        placeholder="Write your answer..."
      />

    </motion.div>
  )
}