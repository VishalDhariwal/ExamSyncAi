import { useLocation, useNavigate } from "react-router-dom"

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const getDisplayName = () => {
    try {
      const explicit = localStorage.getItem("userName")
      if (explicit && explicit.trim()) return explicit.trim()
      const stored = JSON.parse(localStorage.getItem("userData") || "{}")
      if (stored.full_name && stored.full_name.trim()) return stored.full_name.trim()
      const email = localStorage.getItem("user") || ""
      if (email.includes("@")) return email.split("@")[0]
    } catch (_) {}
    return "Student"
  }

  const email = localStorage.getItem("user") || ""
  const displayName = getDisplayName()

  const getPageTitle = () => {
    switch (location.pathname) {
      case "/dashboard":
        return "Home"
      case "/practice":
        return "Practice Exam"
      case "/materials":
        return "Study Materials"
      case "/reports":
      case "/history":
        return "Reports"
      case "/results":
        return "Evaluation Results"
      default:
        return "StudySync AI"
    }
  }

  const title = getPageTitle()

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    localStorage.removeItem("userData")
    localStorage.removeItem("userName")
    localStorage.removeItem("isNewUser")
    localStorage.removeItem("exam")
    localStorage.removeItem("result")
    navigate("/")
  }

  const initial = displayName.charAt(0).toUpperCase()

  return (
    <header className="bg-white border-b border-gray-200/80 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10 shadow-xs">
      <div>
        <h1 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* User Account Pill */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full" title={email}>
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center">
            {initial}
          </div>
          <span className="text-xs font-semibold text-gray-700 max-w-[180px] truncate">
            {displayName}
          </span>
        </div>

        {/* Quick Logout Button */}
        <button
          onClick={handleLogout}
          className="text-xs font-semibold text-gray-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition duration-150"
          title="Sign out"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}