import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Login from "./Pages/Login"
import Home from "./Pages/Home"
import Practice from "./Pages/Practice"
import Materials from "./Pages/Materials"
import Reports from "./Pages/Reports"
import Results from "./Pages/Results"
import Exam from "./Pages/Exam"
import AppLayout from "./components/AppLayout"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Authentication Route */}
        <Route path="/" element={<Login />} />

        {/* Main Application Shell with Persistent Sidebar & Header */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Home />} />
          <Route path="/practice" element={<Practice />} />

          <Route path="/reports" element={<Reports />} />
          <Route path="/materials" element={<Materials />} />
          {/* Legacy route alias */}
          <Route path="/history" element={<Navigate to="/reports" replace />} />
          <Route path="/results" element={<Results />} />
        </Route>

        {/* Full-screen Distraction-Free Exam Environment */}
        <Route path="/exam" element={<Exam />} />

        {/* Fallback to Home */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App