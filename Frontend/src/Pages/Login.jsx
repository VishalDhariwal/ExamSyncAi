import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react"
import { loginUser, registerUser } from "../api/api"

export default function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [isSignup, setIsSignup] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleAuth = async (e) => {
    e?.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Please fill in all required fields.")
      return
    }

    if (isSignup && password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    try {
      setLoading(true)
      let res

      if (isSignup) {
        res = await registerUser({
          email: email.trim(),
          password,
          full_name: fullName.trim() || undefined,
        })
      } else {
        res = await loginUser({
          email: email.trim(),
          password,
        })
      }

      // Store JWT token and user identifier securely
      localStorage.setItem("token", res.data.access_token)
      localStorage.setItem("user", res.data.user.email)
      localStorage.setItem("userData", JSON.stringify(res.data.user))

      navigate("/dashboard")
    } catch (err) {
      console.error("Authentication failed:", err)
      const detail =
        err.response?.data?.detail || "Authentication failed. Please check your credentials."
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 rounded-3xl bg-white shadow-lg shadow-blue-500/10 border border-gray-100 mb-3.5 hover:scale-105 transition duration-200">
            <img
              src="/logo.png"
              alt="StudySync AI"
              className="w-16 h-16 object-contain"
            />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            StudySync <span className="text-blue-600">AI</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            Intelligent Academic Learning & Exam Platform
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-gray-100 p-7 sm:p-8">
          {/* Segmented Tab Switcher for Sign In / Sign Up */}
          <div className="grid grid-cols-2 p-1 bg-gray-100/80 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setIsSignup(false)
                setError("")
              }}
              className={`py-2 text-xs font-bold rounded-xl transition duration-150 select-none ${
                !isSignup
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignup(true)
                setError("")
              }}
              className={`py-2 text-xs font-bold rounded-xl transition duration-150 select-none ${
                isSignup
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Create Account
            </button>
          </div>

          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900">
              {isSignup ? "Create student account" : "Welcome back"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isSignup
                ? "Enter your details to register and start taking AI exams"
                : "Sign in with your student credentials to continue"}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignup && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white transition shadow-2xs"
                    placeholder="e.g. Alex Johnson"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white transition shadow-2xs"
                  placeholder="student@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white transition shadow-2xs"
                  placeholder={isSignup ? "At least 6 characters" : "Enter your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition duration-150 shadow-md shadow-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{isSignup ? "Create Student Account" : "Sign In to StudySync"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick toggle footer */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              {isSignup ? "Already have an account?" : "Need a student account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup)
                  setError("")
                }}
                className="font-bold text-blue-600 hover:text-blue-700 hover:underline ml-1"
              >
                {isSignup ? "Sign In" : "Sign Up"}
              </button>
            </p>
          </div>
        </div>

        {/* Feature Highlights Pills */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-gray-500 font-medium">
          <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-full border border-gray-200/80 shadow-2xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Syllabus RAG Retrieval
          </span>
          <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-full border border-gray-200/80 shadow-2xs">
            <CheckCircle2 className="w-3 h-3 text-blue-500" /> Multi-PYQ Alignment
          </span>
          <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-full border border-gray-200/80 shadow-2xs">
            <CheckCircle2 className="w-3 h-3 text-purple-500" /> Real-time Diagnostics
          </span>
        </div>
      </div>
    </div>
  )
}