import { Link, useLocation, useNavigate } from "react-router-dom"
import { Zap, Home, BookOpen, BarChart3, LogOut } from "lucide-react"

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const email = localStorage.getItem("user") || "Student"
  const initial = email.charAt(0).toUpperCase()

  const navItems = [
    {
      name: "Home",
      path: "/dashboard",
      icon: Home,
    },
    {
      name: "Practice",
      path: "/practice",
      icon: Zap,
    },
    {
      name: "Reports",
      path: "/reports",
      icon: BarChart3,
    },
    {
      name: "Study Materials",
      path: "/materials",
      icon: BookOpen,
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
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200/80 shadow-xs w-full">
      <div className="w-full px-8 h-16 flex items-center justify-between relative">
        {/* Far Left: Brand Mark */}
        <Link to="/dashboard" className="flex items-center gap-3 group flex-shrink-0 z-10">
          <div className="w-10 h-10 rounded-xl bg-white border border-gray-200/80 shadow-xs flex items-center justify-center p-1 group-hover:scale-105 transition">
            <img
              src="/logo.png"
              alt="StudySync AI"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-extrabold text-gray-900 text-lg tracking-tight">
            StudySync <span className="text-blue-600">AI</span>
          </span>
        </Link>

        {/* Dead Center: Only the 4 Navigation Tabs */}
        <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path === "/reports" && location.pathname === "/history")

            const Icon = item.icon

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition duration-150 ${
                  isActive
                    ? "bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/70"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-gray-500"}`} />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Far Right: User Pill + Sign Out */}
        <div className="flex items-center gap-3 flex-shrink-0 z-10">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full">
            <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center">
              {initial}
            </div>
            <span className="text-xs font-semibold text-gray-700 max-w-[170px] truncate">
              {email}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition duration-150"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </header>
  )
}
