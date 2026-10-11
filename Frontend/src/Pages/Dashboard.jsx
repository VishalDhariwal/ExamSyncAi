import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import Header from "../components/Header"
import {
  generateExam,
  uploadDocument,
  getDocuments,
  deleteDocument,
  getSubjects,
} from "../api/api"
import AILoader from "../components/AILoader"

export default function Dashboard() {
  const navigate = useNavigate()

  const [subject, setSubject] = useState("DBMS")
  const [subjects, setSubjects] = useState([])
  const [documents, setDocuments] = useState([])
  const [activeTab, setActiveTab] = useState("hub")
  const [loading, setLoading] = useState(false)

  // Upload form state
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadSubject, setUploadSubject] = useState("")
  const [uploadDocType, setUploadDocType] = useState("NOTES")
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)

  const email = localStorage.getItem("user")

  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/")
    }
  }, [navigate])

  // Load user documents and available subjects
  const refreshData = async () => {
    try {
      const [docsRes, subsRes] = await Promise.all([
        getDocuments(),
        getSubjects(),
      ])
      setDocuments(docsRes.data || [])
      const subList = subsRes.data || []
      setSubjects(subList)
      if (subList.length > 0 && !subject) {
        setSubject(subList[0])
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err)
    }
  }

  useEffect(() => {
    refreshData()
  }, [])

  // Handle Document Upload
  const handleUpload = async (e) => {
    e.preventDefault()
    if (!uploadFile) {
      setUploadStatus({ type: "error", message: "Please select a PDF or TXT file to upload." })
      return
    }

    const cleanSubject = (uploadSubject || subject || "").trim()
    if (!cleanSubject) {
      setUploadStatus({
        type: "error",
        message: "Please specify a Class or Subject name for this document.",
      })
      return
    }

    try {
      setUploading(true)
      setUploadStatus(null)

      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("subject", cleanSubject)
      formData.append("doc_type", uploadDocType)

      const res = await uploadDocument(formData)

      setUploadStatus({
        type: "success",
        message: `✅ Successfully parsed "${res.data.filename}" into ${res.data.chunk_count} vector chunks!`,
      })

      // Reset form & select uploaded subject
      setUploadFile(null)
      setUploadSubject("")
      setSubject(cleanSubject)

      // Reset file input element
      const fileInput = document.getElementById("file-upload-input")
      if (fileInput) fileInput.value = ""

      // Refresh list
      await refreshData()
    } catch (err) {
      console.error("Upload error:", err)
      const msg = err.response?.data?.detail || "Failed to upload and parse document."
      setUploadStatus({ type: "error", message: `⚠️ ${msg}` })
    } finally {
      setUploading(false)
    }
  }

  // Handle Document Delete
  const handleDelete = async (docId, title) => {
    if (!window.confirm(`Delete "${title}"? Its vector chunks will also be removed.`)) {
      return
    }
    try {
      await deleteDocument(docId)
      await refreshData()
    } catch (err) {
      console.error("Delete failed:", err)
      alert("Failed to delete document.")
    }
  }

  // Generate Exam
  const generate = async () => {
    const targetSubject = subject.trim()
    if (!targetSubject) {
      alert("Please enter or select a class or subject first.")
      return
    }

    try {
      setLoading(true)

      const res = await generateExam({
        student_id: email,
        subject: targetSubject,
      })

      localStorage.setItem("exam", JSON.stringify(res.data))
      navigate("/exam")
    } catch (err) {
      console.error("Generate exam failed:", err)
      alert("Failed to generate exam. Please ensure you have uploaded notes or questions for this subject.")
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B"
    const kb = bytes / 1024
    if (kb < 1024) return `${Math.round(kb)} KB`
    return `${(kb / 1024).toFixed(1)} MB`
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Dynamic Sidebar */}
        <Sidebar
          email={email}
          subject={subject}
          setSubject={setSubject}
          subjects={subjects}
          generate={generate}
          loading={loading}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* Main Workspace */}
        <div className="flex-1 p-8 overflow-y-auto">
          {loading && <AILoader />}

          {!loading && (
            <div className="max-w-5xl mx-auto space-y-8">
              {/* Top Banner */}
              <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-8 shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                  <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-semibold px-3 py-1 rounded-full border border-blue-400/20 mb-3">
                    Universal RAG Practice Engine
                  </span>
                  <h1 className="text-3xl font-extrabold tracking-tight mb-2">
                    Upload Any Document & Practice Any Class 🎓
                  </h1>
                  <p className="text-blue-200/90 max-w-2xl text-sm leading-relaxed">
                    Upload your lecture slides, notes, or previous year question papers in PDF or text format.
                    Our agentic RAG system embeds your materials into pgvector to generate syllabus-accurate university-grade mock exams.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-4 items-center">
                    <button
                      onClick={() => setActiveTab("hub")}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-lg shadow-blue-500/25 flex items-center gap-2"
                    >
                      <span>📤</span> Upload Study Material
                    </button>
                    <button
                      onClick={generate}
                      disabled={!subject.trim()}
                      className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-5 py-2.5 rounded-xl font-semibold text-sm transition backdrop-blur-sm flex items-center gap-2"
                    >
                      <span>⚡</span> Practice &quot;{subject || "Subject"}&quot;
                    </button>
                  </div>
                </div>

                {/* Subtle background decoration */}
                <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
              </div>

              {/* View 1: Upload Hub & Practice Launcher */}
              {activeTab === "hub" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Upload Form (7 cols) */}
                  <div className="lg:col-span-7 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">Upload New Study Material</h2>
                        <p className="text-xs text-gray-500">PDF, TXT, or MD documents up to 15 MB</p>
                      </div>
                      <span className="text-2xl">📑</span>
                    </div>

                    {uploadStatus && (
                      <div
                        className={`p-4 rounded-xl text-sm mb-5 ${
                          uploadStatus.type === "success"
                            ? "bg-green-50 text-green-800 border border-green-200"
                            : "bg-red-50 text-red-800 border border-red-200"
                        }`}
                      >
                        {uploadStatus.message}
                      </div>
                    )}

                    <form onSubmit={handleUpload} className="space-y-4">
                      {/* File Selector */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                          Choose File (PDF or Text)
                        </label>
                        <div className="border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-xl p-5 text-center transition bg-gray-50/50">
                          <input
                            id="file-upload-input"
                            type="file"
                            accept=".pdf,.txt,.md,.text"
                            onChange={(e) => setUploadFile(e.target.files[0] || null)}
                            className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                          />
                          {uploadFile && (
                            <p className="mt-2 text-xs text-blue-600 font-medium">
                              Selected: {uploadFile.name} ({formatFileSize(uploadFile.size)})
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Class or Subject Name */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                          Class / Subject / Course Name *
                        </label>
                        <input
                          type="text"
                          value={uploadSubject}
                          onChange={(e) => setUploadSubject(e.target.value)}
                          placeholder="e.g. Class 10 Biology, Operating Systems, World History..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          required
                        />
                        {subjects.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                            <span>Use existing:</span>
                            {subjects.map((sub) => (
                              <button
                                key={sub}
                                type="button"
                                onClick={() => setUploadSubject(sub)}
                                className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                              >
                                {sub}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Document Type */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                          Document Type
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setUploadDocType("NOTES")}
                            className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${
                              uploadDocType === "NOTES"
                                ? "border-blue-500 bg-blue-50/50 text-blue-900 font-medium"
                                : "border-gray-200 text-gray-600 hover:border-gray-300"
                            }`}
                          >
                            <span className="text-xl">📘</span>
                            <div>
                              <div className="text-xs font-bold">Lecture Notes</div>
                              <div className="text-[11px] text-gray-500">Syllabus & explanations</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setUploadDocType("PYQ")}
                            className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${
                              uploadDocType === "PYQ"
                                ? "border-purple-500 bg-purple-50/50 text-purple-900 font-medium"
                                : "border-gray-200 text-gray-600 hover:border-gray-300"
                            }`}
                          >
                            <span className="text-xl">📝</span>
                            <div>
                              <div className="text-xs font-bold">Past Questions (PYQ)</div>
                              <div className="text-[11px] text-gray-500">Exam paper patterns</div>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={uploading}
                        className={`w-full py-3 rounded-xl font-semibold text-sm transition shadow-lg flex items-center justify-center gap-2 ${
                          uploading
                            ? "bg-gray-400 text-white cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25 active:scale-[0.99]"
                        }`}
                      >
                        {uploading ? (
                          <>
                            <span className="animate-spin">⏳</span> Ingesting & Embedding into pgvector...
                          </>
                        ) : (
                          <>
                            <span>🚀</span> Upload & Parse Document
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Practice Exam Quick Launch Card (5 cols) */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">Exam Configurator</h2>
                          <p className="text-xs text-gray-500">AI-generated university standard mock</p>
                        </div>
                        <span className="text-2xl">🎯</span>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                            Target Subject / Class
                          </label>
                          <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Enter subject name..."
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          />
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2">
                          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Standard Exam Format: 40 Marks
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                            <div className="bg-white p-2 rounded border border-gray-100">
                              <span className="font-semibold text-blue-600">5 × 2 marks</span>: Definitions
                            </div>
                            <div className="bg-white p-2 rounded border border-gray-100">
                              <span className="font-semibold text-blue-600">4 × 3 marks</span>: Short answers
                            </div>
                            <div className="bg-white p-2 rounded border border-gray-100">
                              <span className="font-semibold text-blue-600">2 × 4 marks</span>: Explanations
                            </div>
                            <div className="bg-white p-2 rounded border border-gray-100">
                              <span className="font-semibold text-blue-600">2 × 5 marks</span>: Long answers
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={generate}
                          disabled={!subject.trim()}
                          className={`w-full py-3.5 rounded-xl font-bold text-sm transition shadow-lg flex items-center justify-center gap-2 ${
                            !subject.trim()
                              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                              : "bg-green-600 hover:bg-green-500 text-white shadow-green-600/20 active:scale-[0.99]"
                          }`}
                        >
                          <span>⚡</span> Launch Mock Exam
                        </button>
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                        Your Study Library
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-blue-50/60 rounded-xl p-3 border border-blue-100">
                          <div className="text-2xl font-extrabold text-blue-700">{documents.length}</div>
                          <div className="text-xs font-medium text-blue-600">Uploaded Documents</div>
                        </div>
                        <div className="bg-indigo-50/60 rounded-xl p-3 border border-indigo-100">
                          <div className="text-2xl font-extrabold text-indigo-700">{subjects.length}</div>
                          <div className="text-xs font-medium text-indigo-600">Active Subjects</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* View 2: Study Materials Library */}
              {activeTab === "documents" && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Your Study Documents</h2>
                      <p className="text-xs text-gray-500">
                        All materials vectorized into pgvector and ready for exam generation
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("hub")}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition"
                    >
                      + Upload New Document
                    </button>
                  </div>

                  {documents.length === 0 ? (
                    <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <span className="text-4xl block mb-2">📂</span>
                      <p className="text-gray-700 font-semibold mb-1">No documents uploaded yet</p>
                      <p className="text-xs text-gray-500 mb-4">
                        Upload your PDF notes or past exam questions to start practicing.
                      </p>
                      <button
                        onClick={() => setActiveTab("hub")}
                        className="bg-blue-600 text-white text-xs px-4 py-2 rounded-lg font-medium hover:bg-blue-500 transition"
                      >
                        Upload First Document
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="bg-white border border-gray-200 hover:border-blue-300 rounded-xl p-4 shadow-sm hover:shadow transition flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  doc.doc_type === "PYQ"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {doc.doc_type === "PYQ" ? "📝 Past Paper" : "📘 Lecture Notes"}
                              </span>
                              <button
                                onClick={() => handleDelete(doc.id, doc.title)}
                                className="text-gray-400 hover:text-red-600 text-xs p-1 transition"
                                title="Delete document"
                              >
                                ✕
                              </button>
                            </div>

                            <h3 className="font-bold text-gray-900 text-sm mb-1 truncate" title={doc.title}>
                              {doc.title}
                            </h3>
                            <p className="text-xs font-semibold text-blue-600 mb-3">{doc.subject}</p>

                            <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-4">
                              <span>📊 {doc.chunk_count} chunks</span>
                              <span>•</span>
                              <span>💾 {formatFileSize(doc.file_size)}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSubject(doc.subject)
                              generate()
                            }}
                            className="w-full py-2 bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 border border-gray-200 hover:border-blue-200 rounded-lg text-xs font-semibold transition"
                          >
                            Practice &quot;{doc.subject}&quot; ⚡
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}