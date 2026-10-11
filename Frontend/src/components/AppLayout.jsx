import { useEffect } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import Navbar from "./Navbar"

export default function AppLayout() {
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/")
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full">
      {/* Full-width Top Navbar */}
      <Navbar />

      {/* Spacious Full-Width Page Container without excessive margins */}
      <main className="flex-1 px-8 py-6 w-full max-w-[1440px] mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
