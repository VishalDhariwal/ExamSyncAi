import { motion } from "framer-motion"
import { Link } from "react-router-dom"

export default function Sidebar({
  email,
  subject,
  setSubject,
  subjects = [],
  generate,
  loading = false,
  activeTab = "hub",
  setActiveTab = () => {},
  isMarksBalanced = true,
  targetTotal = 40,
}) {
  return (
    <motion.div
      initial={{ x: -200 }}
      animate={{ x: 0 }}
      className="w-72 bg-gray-900 text-white p-6 h-screen overflow-y-auto flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/30">
            ES
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">ExamSync AI</h2>
            <p className="text-xs text-gray-400">Adaptive Practice</p>
          </div>
        </div>

        <div className="bg-gray-800/80 rounded-xl p-3 mb-6 border border-gray-700/50">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">
            Student Account
          </p>
          <p className="text-sm font-medium text-gray-200 truncate">{email || "Student"}</p>
        </div>

        {/* ================= NAVIGATION TABS ================= */}
        <div className="space-y-1 mb-6">
          <button
            onClick={() => setActiveTab("hub")}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2.5 ${
              activeTab === "hub"
                ? "bg-blue-600 text-white font-semibold shadow"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <span>📄</span> Upload & Study Hub
          </button>

          <button
            onClick={() => setActiveTab("documents")}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2.5 ${
              activeTab === "documents"
                ? "bg-blue-600 text-white font-semibold shadow"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <span>📚</span> My Study Materials
          </button>

          <Link
            to="/history"
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2.5 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <span>📊</span> Exam History
          </Link>
        </div>

        {/* ================= PRACTICE SELECTOR ================= */}
        <div className="border-t border-gray-800 pt-5 mb-6">
          <label className="block text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">
            Target Subject / Class
          </label>

          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. DBMS, Physics, AI..."
            className="w-full mb-3 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {subjects.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-1.5">Quick Pick:</p>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {subjects.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubject(sub)}
                    className={`text-xs px-2.5 py-1 rounded-md transition ${
                      subject.toUpperCase() === sub.toUpperCase()
                        ? "bg-blue-600 text-white font-semibold"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (activeTab !== "hub") setActiveTab("hub")
              generate()
            }}
            disabled={loading || !subject.trim() || !isMarksBalanced}
            className={`w-full py-3 rounded-lg font-semibold text-sm transition shadow-lg flex items-center justify-center gap-2 ${
              loading || !subject.trim() || !isMarksBalanced
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-95"
            }`}
          >
            {loading ? (
              <span>Generating Exam...</span>
            ) : isMarksBalanced ? (
              <>
                <span>⚡</span> Launch Exam ({targetTotal}m)
              </>
            ) : (
              <>
                <span>🔒</span> Balance Rubric
              </>
            )}
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-400 text-center border-t border-gray-800/80 pt-4">
        ExamSync AI • RAG & pgvector
      </div>
    </motion.div>
  )
}