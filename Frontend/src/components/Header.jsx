import { Link, useNavigate } from "react-router-dom"

export default function Header() {

  const navigate = useNavigate()
  const email = localStorage.getItem("user")

  const logout = () => {

    localStorage.removeItem("user")
    localStorage.removeItem("exam")
    localStorage.removeItem("result")

    navigate("/")
  }

  return (

    <div className="bg-gray-900 text-white px-8 py-4 flex justify-between items-center">

      <h1 className="text-xl font-bold">
        StudySync AI
      </h1>

      <div className="flex gap-6 items-center">

        <Link to="/dashboard" className="hover:text-blue-400">
          Home
        </Link>

        <Link to="/history" className="hover:text-blue-400">
          History
        </Link>
        
        <span className="text-gray-400 text-sm">
          {email}
        </span>

        <button
          onClick={logout}
          className="bg-red-500 px-4 py-2 rounded"
        >
          Logout
        </button>

      </div>

    </div>
  )
}