import { motion } from "framer-motion"

export default function QuestionCard({ question, answer = "", setAnswer }) {
  const isMcq =
    question.question_type === "mcq" ||
    (Array.isArray(question.options) && question.options.length > 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white shadow-md border border-gray-100 rounded-2xl p-6 mb-6 transition"
    >
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-lg text-gray-900">
            Question {question.id}
          </span>
          {question.topic && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full font-medium">
              {question.topic}
            </span>
          )}
        </div>

        <span
          className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
            isMcq
              ? "bg-purple-100 text-purple-700 border border-purple-200"
              : "bg-blue-100 text-blue-700 border border-blue-200"
          }`}
        >
          {question.marks} {question.marks === 1 ? "Mark" : "Marks"} • {isMcq ? "MCQ" : "Subjective"}
        </span>
      </div>

      <p className="text-gray-800 text-base font-medium mb-4 leading-relaxed">
        {question.question}
      </p>

      {/* MCQ Radio Option Selector */}
      {isMcq ? (
        <div className="space-y-2.5 mt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Select the correct option:
          </p>
          {question.options.map((option, idx) => {
            const isSelected = answer === option || (answer && option.startsWith(answer))
            return (
              <label
                key={idx}
                onClick={() => setAnswer(question.id, option)}
                className={`flex items-center gap-3.5 p-3.5 rounded-xl border cursor-pointer transition ${
                  isSelected
                    ? "border-blue-600 bg-blue-50/70 text-blue-900 font-semibold shadow-sm ring-1 ring-blue-500"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 text-gray-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs transition ${
                    isSelected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <span className="text-sm">{option}</span>
              </label>
            )
          })}
        </div>
      ) : (
        /* Subjective Answer Textarea */
        <div className="mt-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Your Answer:
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(question.id, e.target.value)}
            className="w-full border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 p-3.5 rounded-xl text-sm leading-relaxed text-gray-800 focus:outline-none transition resize-y"
            rows="5"
            placeholder="Type your structured explanation, technical terms, and definitions here..."
          />
        </div>
      )}
    </motion.div>
  )
}