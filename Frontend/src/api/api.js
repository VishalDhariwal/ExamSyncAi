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

// --- Exam Workflows (PostgreSQL Persisted) ---
export const generateExam = (data) => API.post("/generate-exam", data)
export const submitExam = (data) => API.post("/submit-exam", data)
export const getExamHistory = () => API.get("/exam-history")
export const getPendingExamsApi = () => API.get("/exams/pending")
export const saveDraftExamApi = (examId, savedAnswers) =>
  API.put(`/exams/${examId}/draft`, { saved_answers: savedAnswers })
export const getExamSessionApi = (examId) => API.get(`/exams/${examId}`)
export const discardExamApi = (examId) => API.delete(`/exams/${examId}`)

// --- Course Structure & Subjects ---
export const getStructure = () => API.get("/structure")
export const getSubjects = () => API.get("/subjects")
export const getSubjectMaterials = (subject) =>
  API.get(`/subjects/${encodeURIComponent(subject)}/materials`)
export const getSubjectWeakTopics = (subject) =>
  API.get(`/subjects/${encodeURIComponent(subject)}/weak-topics`)

// --- Document Management & Uploads ---
export const uploadDocument = (formData) =>
  API.post("/documents/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
export const getDocuments = () => API.get("/documents")
export const deleteDocument = (id) => API.delete(`/documents/${id}`)
export const updateDocument = (id, data) => API.patch(`/documents/${id}`, data)

export const getDocumentPdfUrl = (id) => {
  const token = localStorage.getItem("token")
  return `http://127.0.0.1:8000/documents/${id}/view?token=${encodeURIComponent(token || "")}`
}

export default API