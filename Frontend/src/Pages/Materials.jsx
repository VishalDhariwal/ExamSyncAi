import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  Upload,
  BookOpen,
  FileText,
  Trash2,
  Zap,
  Search,
  X,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { uploadDocument, getDocuments, deleteDocument } from "../api/api"

export default function Materials() {
  const navigate = useNavigate()

  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("ALL")

  // Upload state
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadSubject, setUploadSubject] = useState("")
  const [uploadDocType, setUploadDocType] = useState("NOTES")
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)

  // Fetch documents
  const loadDocuments = async () => {
    try {
      setLoading(true)
      const res = await getDocuments()
      setDocuments(res.data || [])
    } catch (err) {
      console.error("Failed to fetch documents:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  // File Upload Handler
  const handleUpload = async (e) => {
    e.preventDefault()

    if (!uploadFile) {
      setUploadStatus({ type: "error", message: "Please select a PDF document to upload." })
      return
    }

    if (!uploadSubject.trim()) {
      setUploadStatus({
        type: "error",
        message: "Please enter a subject name (e.g. DBMS, Physics, AI).",
      })
      return
    }

    try {
      setUploading(true)
      setUploadStatus(null)

      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("subject", uploadSubject.trim())
      formData.append("doc_type", uploadDocType)

      await uploadDocument(formData)

      setUploadStatus({
        type: "success",
        message: `Successfully uploaded "${uploadFile.name}"! Indexed and ready for mock exams.`,
      })

      // Reset form
      setUploadFile(null)
      setUploadSubject("")
      const fileInput = document.getElementById("doc-file-input")
      if (fileInput) fileInput.value = ""

      // Refresh documents
      await loadDocuments()
    } catch (err) {
      console.error("Document upload failed:", err)
      const detail = err.response?.data?.detail || err.message
      setUploadStatus({
        type: "error",
        message: `Upload failed: ${detail}`,
      })
    } finally {
      setUploading(false)
    }
  }

  // Delete Handler
  const handleDelete = async (docId, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) {
      return
    }

    try {
      await deleteDocument(docId)
      setDocuments(documents.filter((d) => d.id !== docId))
    } catch (err) {
      console.error("Failed to delete document:", err)
      alert("Failed to delete document. Please try again.")
    }
  }

  // Helper formatting
  const formatFileSize = (bytes) => {
    if (!bytes) return "0 KB"
    const kb = bytes / 1024
    if (kb < 1024) return `${Math.round(kb)} KB`
    return `${(kb / 1024).toFixed(1)} MB`
  }

  // Filtered documents
  const allSubjects = Array.from(new Set(documents.map((d) => d.subject)))
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.subject.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSubject =
      selectedSubjectFilter === "ALL" ||
      doc.subject.toUpperCase() === selectedSubjectFilter.toUpperCase()
    return matchesSearch && matchesSubject
  })

  return (
    <div className="w-full space-y-8">
      {/* Upload Zone */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              Upload Study Materials & Notes
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Upload PDFs of lecture notes, syllabi, or past exam question papers.
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Upload className="w-5 h-5 text-blue-600" />
          </div>
        </div>

        {uploadStatus && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold mb-6 flex items-center justify-between ${
              uploadStatus.type === "success"
                ? "bg-blue-50 border border-blue-200 text-blue-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            <div className="flex items-center gap-2">
              {uploadStatus.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              )}
              <span>{uploadStatus.message}</span>
            </div>
            <button
              onClick={() => setUploadStatus(null)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Subject Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Target Subject / Class Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={uploadSubject}
                onChange={(e) => setUploadSubject(e.target.value)}
                placeholder="e.g. DBMS, Operating Systems, Linear Algebra..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Document Type Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Document Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUploadDocType("NOTES")}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition ${
                    uploadDocType === "NOTES"
                      ? "border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Lecture Notes</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUploadDocType("PYQ")}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition ${
                    uploadDocType === "PYQ"
                      ? "border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Past Questions (PYQ)</span>
                </button>
              </div>
            </div>
          </div>

          {/* PDF File Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Select PDF File <span className="text-red-500">*</span>
            </label>
            <input
              id="doc-file-input"
              type="file"
              accept=".pdf"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={uploading}
            className={`w-full py-3.5 rounded-xl font-bold text-sm transition shadow-lg flex items-center justify-center gap-2 ${
              uploading
                ? "bg-gray-400 text-white cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-[0.99]"
            }`}
          >
            {uploading ? (
              <>
                <span className="animate-spin">⏳</span> Processing & Indexing Document...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Upload & Parse Document</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Document Library Section */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              Indexed Study Materials ({documents.length})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Your uploaded notes and past exam papers available for question generation.
            </p>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-52">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3.5 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {allSubjects.length > 0 && (
              <select
                value={selectedSubjectFilter}
                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
              >
                <option value="ALL">All Subjects</option>
                {allSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-gray-400 py-12 text-center">Loading your document library...</p>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-700 font-semibold mb-1 text-sm">
              {documents.length === 0 ? "No documents uploaded yet" : "No matching documents found"}
            </p>
            <p className="text-xs text-gray-500">
              Upload your PDF notes above to populate your study library.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-gray-200 hover:border-blue-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                      {doc.doc_type === "PYQ" ? (
                        <>
                          <FileText className="w-3 h-3 text-blue-600" />
                          <span>Past Paper</span>
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-3 h-3 text-blue-600" />
                          <span>Lecture Notes</span>
                        </>
                      )}
                    </span>
                    <button
                      onClick={() => handleDelete(doc.id, doc.title)}
                      className="text-gray-400 hover:text-red-600 p-1 transition"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className="font-bold text-gray-900 text-sm mb-1 line-clamp-1" title={doc.title}>
                    {doc.title}
                  </h3>
                  <p className="text-xs font-semibold text-blue-600 mb-3">{doc.subject}</p>

                  <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-4">
                    <span>{doc.doc_type === "PYQ" ? "Exam Paper" : "Lecture Notes"}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-gray-400" />
                      <span>{formatFileSize(doc.file_size)}</span>
                    </span>
                  </div>
                </div>

                <button
                  onClick={() =>
                    navigate(`/practice?subject=${encodeURIComponent(doc.subject)}`)
                  }
                  className="w-full py-2.5 bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 border border-gray-200 hover:border-blue-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
                  <span>Practice &quot;{doc.subject}&quot;</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
