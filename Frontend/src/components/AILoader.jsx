import { motion } from "framer-motion"

const steps = [
  "🧠 Analyzing previous year questions...",
  "📚 Retrieving study notes...",
  "📝 Generating exam questions...",
]

export default function AILoader() {
  return (
    <div className="flex flex-col items-center justify-center mt-10">

      <motion.div
        className="text-2xl font-semibold mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        AI is generating your exam
      </motion.div>

      {steps.map((step, index) => (
        <motion.div
          key={index}
          className="text-gray-600 text-lg mb-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 1.2 }}
        >
          {step}
        </motion.div>
      ))}

      <motion.div
        className="mt-6 text-blue-500 text-xl"
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      >
        Please wait...
      </motion.div>

    </div>
  )
}