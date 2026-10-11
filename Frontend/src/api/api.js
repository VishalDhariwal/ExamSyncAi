import axios from "axios"

const API = axios.create({
  baseURL: "http://127.0.0.1:8000"
})

// Attach JWT access token to every outgoing request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// --- Authentication ---
export const registerUser = (data) => API.post("/auth/register", data)
export const loginUser = (data) => API.post("/auth/login", data)
export const getMe = () => API.get("/auth/me")

// --- Exam Workflows ---
export const generateExam = (data) => API.post("/generate-exam", data)
export const submitExam = (data) => API.post("/submit-exam", data)
export const getExamHistory = () => API.get("/exam-history")

// --- Course Structure ---
export const getStructure = () => API.get("/structure")

export default API