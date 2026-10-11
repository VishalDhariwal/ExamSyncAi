import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { loginUser, registerUser } from "../api/api"

export default function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [isSignup, setIsSignup] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleAuth = async (e) => {
    e?.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Please fill in all required fields.")
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
      const detail = err.response?.data?.detail || "Authentication failed. Please check credentials."
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-10 rounded-2xl shadow-2xl text-white w-96 border border-gray-700">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">
            ExamSync <span className="text-blue-500">AI</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Secure PostgreSQL & AI Evaluation
          </p>
        </div>

        <h2 className="text-xl font-semibold mb-4 text-center">
          {isSignup ? "Create Student Account" : "Sign In"}
        </h2>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-sm p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth}>
          {isSignup && (
            <input
              type="text"
              className="w-full p-3 rounded-lg mb-3 bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="Full Name (optional)"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )}

          <input
            type="email"
            className="w-full p-3 rounded-lg mb-3 bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-blue-500"
            placeholder="Student Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            className="w-full p-3 rounded-lg mb-6 bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-blue-500"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 w-full p-3 rounded-lg font-medium transition duration-200"
          >
            {loading ? "Processing..." : isSignup ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <p
          className="text-sm text-center mt-5 cursor-pointer text-gray-400 hover:text-white transition"
          onClick={() => {
            setIsSignup(!isSignup)
            setError("")
          }}
        >
          {isSignup
            ? "Already have an account? Sign in"
            : "Don't have an account? Sign up"}
        </p>
      </div>
    </div>
  )
}