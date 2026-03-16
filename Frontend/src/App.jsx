import { BrowserRouter, Routes, Route } from "react-router-dom"
import Login from "./Pages/Login"
import Dashboard from "./Pages/Dashboard"
import Exam from "./Pages/Exam"
import Results from "./Pages/Results"
import History from "./Pages/History"

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/exam" element={<Exam />} />
        <Route path="/results" element={<Results />} />
        <Route path="/history" element={<History />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App