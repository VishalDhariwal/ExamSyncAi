import { motion } from "framer-motion"
import { Link, useLocation, useNavigate } from "react-router-dom"

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  const navItems = [
    {
      name: "Home",
      path: "/dashboard",
      icon: "🏠",
    },
    {
      name: "Practice",
      path: "/practice",
      icon: "⚡",
    },
    {
      name: "Study Materials",
      path: "/materials",
      icon: "📚",
    },
    {
      name: "Reports",
      path: "/reports",
      icon: "📊",
    },
  ]

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    localStorage.removeItem("userData")
    localStorage.removeItem("exam")
    localStorage.removeItem("result")
    navigate("/")
  }

  return (
    <motion.aside
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-52 bg-slate-900 text-slate-200 h-screen flex flex-col justify-between border-r border-slate-800 shadow-xl select-none flex-shrink-0"
    >
      <div>
        {/* Sleek Brand Mark */}
        <div className="px-4 py-4 border-b border-slate-800 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-blue-500/25">
            ⚡
          </div>
          <span className="font-bold text-white text-base tracking-tight">ExamSync</span>
        </div>

        {/* Clean Nav Links without Subheadings */}
        <nav className="p-2 space-y-1 mt-3">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path === "/reports" && location.pathname === "/history")

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition duration-150 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="flex-1 truncate">{item.name}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition duration-150"
        >
          <span>🚪</span> Log Out
        </button>
      </div>
    </motion.aside>
  )
}