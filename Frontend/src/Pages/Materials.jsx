import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
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
  Eye,
  Edit2,
  ExternalLink,
  Download,
  Check,
  Tag,
  Plus,
  ChevronDown,
} from "lucide-react"
import {
  uploadDocument,
  getDocuments,
  deleteDocument,
  updateDocument,
  getDocumentPdfUrl,
  getSubjects,
} from "../api/api"

export default function Materials() {
  const navigate = useNavigate()

  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("ALL")

  // Available Subject Tags & Tag Selector State
  const [availableTags, setAvailableTags] = useState([])
  const [selectedTag, setSelectedTag] = useState("")
  const [isNewTagMode, setIsNewTagMode] = useState(false)
  const [newTagName, setNewTagName] = useState("")

  // Upload state & popup modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadDocType, setUploadDocType] = useState("NOTES")
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)

  // PDF Viewer Modal State
  const [activePdfDoc, setActivePdfDoc] = useState(null)

  // Edit Subject State
  const [editingDocId, setEditingDocId] = useState(null)
  const [editingSubjectText, setEditingSubjectText] = useState("")

  // Fetch documents and available subject tags
  const loadDocuments = async () => {
    try {
      setLoading(true)
      const [docsRes, subsRes] = await Promise.all([
        getDocuments(),
        getSubjects().catch(() => ({ data: [] })),
      ])
      const docs = docsRes.data || []
      setDocuments(docs)

      const fetchedSubs = subsRes.data || []
      const docSubs = docs.map((d) => d.subject).filter(Boolean)
      const combinedTags = Array.from(
        new Set([...fetchedSubs, ...docSubs])
      ).sort()

      setAvailableTags(combinedTags)
      if (combinedTags.length === 0) {
        setIsNewTagMode(true)
        setSelectedTag("")
      } else {
        setSelectedTag((prev) => (prev && combinedTags.includes(prev) ? prev : combinedTags[0]))
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  // Keep user's chosen tag when selecting a file
  const handleFileSelect = (file) => {
    setUploadFile(file)
  }

  // File Upload Handler
  const handleUpload = async (e) => {
    e.preventDefault()

    if (!uploadFile) {
      setUploadStatus({ type: "error", message: "Please select a PDF document to upload." })
      return
    }

    const finalSubject = (isNewTagMode ? newTagName : selectedTag).trim().toUpperCase()
    if (!finalSubject) {
      setUploadStatus({
        type: "error",
        message: isNewTagMode
          ? "Please enter a name for the new subject tag (e.g. Operating Systems, Computer Networks)."
          : "Please select or add a subject tag for this document.",
      })
      return
    }

    if (documents.length >= 5) {
      setUploadStatus({
        type: "error",
        message: "Upload quota reached: Each student can store a maximum of 5 files. Please delete an existing document first.",
      })
      return
    }

    try {
      setUploading(true)
      setUploadStatus(null)

      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("subject", finalSubject)
      formData.append("doc_type", uploadDocType)

      await uploadDocument(formData)

      setUploadStatus({
        type: "success",
        message: `Successfully uploaded "${uploadFile.name}" under tag "${finalSubject}" as ${
          uploadDocType === "NOTES" ? "Notes / Syllabus" : "Past Exam Questions (PYQ)"
        }! All notes & PYQs under "${finalSubject}" are now synced together.`,
      })

      // Reset form & persist selected tag
      setUploadFile(null)
      setIsNewTagMode(false)
      setNewTagName("")
      setSelectedTag(finalSubject)
      setIsUploadModalOpen(false)
      const fileInput = document.getElementById("doc-file-input")
      if (fileInput) fileInput.value = ""

      // Refresh documents and updated tags
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
      if (activePdfDoc?.id === docId) {
        setActivePdfDoc(null)
      }
    } catch (err) {
      console.error("Failed to delete document:", err)
      alert("Failed to delete document. Please try again.")
    }
  }

  // Save Renamed Subject Handler
  const handleSaveSubject = async (docId) => {
    if (!editingSubjectText.trim()) return

    try {
      await updateDocument(docId, { subject: editingSubjectText.trim().toUpperCase() })
      setEditingDocId(null)
      await loadDocuments()
    } catch (err) {
      console.error("Failed to update subject:", err)
      alert("Failed to update subject. " + (err.response?.data?.detail || err.message))
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
      {/* Success / Info Toast on Page */}
      {uploadStatus && !isUploadModalOpen && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-xs transition ${
            uploadStatus.type === "success"
              ? "bg-blue-50 border border-blue-200 text-blue-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          <div className="flex items-center gap-2.5">
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

      {/* Document Library Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              Study Materials Library ({documents.length})
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Upload and manage your course lecture notes, syllabi, and past exam question papers.
            </p>
          </div>

          {/* Action Row: Search, Filter, and Upload Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-48">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Subject Filter */}
            {allSubjects.length > 0 && (
              <select
                value={selectedSubjectFilter}
                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
              >
                <option value="ALL">All Subjects</option>
                {allSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            {/* File Storage Quota Badge */}
            <div className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 whitespace-nowrap ${
              documents.length >= 5 
                ? "bg-amber-50 text-amber-800 border-amber-200" 
                : "bg-gray-50 text-gray-700 border-gray-200"
            }`}>
              <HardDrive className={`w-3.5 h-3.5 ${documents.length >= 5 ? "text-amber-600" : "text-gray-500"}`} />
              <span>Storage Quota:</span>
              <span className="font-bold text-gray-900">{documents.length} / 5</span>
              {documents.length >= 5 && (
                <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  Full
                </span>
              )}
            </div>

            {/* Primary Upload Button that opens the popup modal */}
            <button
              onClick={() => {
                if (documents.length >= 5) {
                  alert("Upload limit reached: You can upload a maximum of 5 files. Please delete an existing file to upload a new one.")
                  return
                }
                setUploadStatus(null)
                setIsUploadModalOpen(true)
              }}
              disabled={documents.length >= 5}
              className={`font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 whitespace-nowrap active:scale-95 ${
                documents.length >= 5
                  ? "bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed shadow-none"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20"
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>{documents.length >= 5 ? "Storage Limit Reached" : "Upload Document"}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-gray-400 py-12 text-center">Loading your document library...</p>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-16 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-700 font-semibold mb-1 text-sm">
              {documents.length === 0 ? "No documents uploaded yet" : "No matching documents found"}
            </p>
            <p className="text-xs text-gray-500 mb-4">
              {documents.length === 0
                ? "Upload lecture notes or past papers to start generating custom mock exams."
                : "Try adjusting your search terms or subject filter."}
            </p>
            {documents.length === 0 && (
              <button
                onClick={() => {
                  setUploadStatus(null)
                  setIsUploadModalOpen(true)
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-xs inline-flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload First Document</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDocs.map((doc) => {
              const isEditing = editingDocId === doc.id

              return (
                <div
                  key={doc.id}
                  className="bg-white border border-gray-200 hover:border-blue-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    {/* Top Type Badge & Header Actions */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                        {doc.doc_type === "PYQ" ? (
                          <>
                            <FileText className="w-3 h-3 text-blue-600" />
                            <span>Past Paper</span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-3 h-3 text-blue-600" />
                            <span>Notes / Syllabus</span>
                          </>
                        )}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingDocId(doc.id)
                            setEditingSubjectText(doc.subject)
                          }}
                          className="text-gray-400 hover:text-blue-600 p-1 rounded-lg hover:bg-gray-100 transition"
                          title="Rename subject"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id, doc.title)}
                          className="text-gray-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition"
                          title="Delete document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Document Title */}
                    <h3 className="font-bold text-gray-900 text-sm mb-1 line-clamp-1" title={doc.title}>
                      {doc.title}
                    </h3>

                    {/* Subject Pill / Edit Mode */}
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 my-2">
                        <input
                          type="text"
                          list="available-tags-list"
                          value={editingSubjectText}
                          onChange={(e) => setEditingSubjectText(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs border border-blue-500 rounded-lg focus:outline-none font-bold uppercase text-blue-900"
                          placeholder="Select or enter tag"
                          autoFocus
                        />
                        <datalist id="available-tags-list">
                          {availableTags.map((t) => (
                            <option key={t} value={t} />
                          ))}
                        </datalist>
                        <button
                          onClick={() => handleSaveSubject(doc.id)}
                          className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
                          title="Save subject tag"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingDocId(null)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100 flex items-center gap-1.5">
                          <Tag className="w-3 h-3 text-blue-500" />
                          <span>{doc.subject}</span>
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-4">
                      <HardDrive className="w-3.5 h-3.5 text-gray-400" />
                      <span>{formatFileSize(doc.file_size)}</span>
                    </div>
                  </div>

                  {/* Dual Action Buttons: View PDF & Practice */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => setActivePdfDoc(doc)}
                      className="flex-1 py-2.5 bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 border border-gray-200 hover:border-blue-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
                      title="View PDF directly in browser"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>View PDF</span>
                    </button>

                    <button
                      onClick={() =>
                        navigate(`/practice?subject=${encodeURIComponent(doc.subject)}`)
                      }
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20 active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5 fill-white" />
                      <span>Practice</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upload Document Modal Popup (Portaled to document.body) */}
      {isUploadModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Upload className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">
                      Upload Study Document
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!uploading) {
                      setIsUploadModalOpen(false)
                      setUploadStatus(null)
                    }
                  }}
                  disabled={uploading}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body / Form */}
              <form onSubmit={handleUpload} className="p-6 space-y-5">
                {uploadStatus && (
                  <div
                    className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      uploadStatus.type === "success"
                        ? "bg-blue-50 border border-blue-200 text-blue-700"
                        : "bg-red-50 border border-red-200 text-red-700"
                    }`}
                  >
                    {uploadStatus.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    )}
                    <span>{uploadStatus.message}</span>
                  </div>
                )}

                {/* 1. Subject / Course Tag */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                      Subject / Course Tag <span className="text-red-500">*</span>
                    </label>
                    {isNewTagMode ? (
                      availableTags.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setIsNewTagMode(false)}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition"
                        >
                          &larr; Choose Existing Tag
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewTagMode(true)
                          setNewTagName("")
                        }}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add New Tag</span>
                      </button>
                    )}
                  </div>

                  {isNewTagMode ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="e.g. OPERATING SYSTEMS, COMPUTER NETWORKS"
                        autoFocus
                        className="w-full px-4 py-2.5 rounded-xl border border-blue-400 ring-2 ring-blue-100 text-sm font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="relative">
                        <select
                          value={selectedTag}
                          onChange={(e) => {
                            if (e.target.value === "__NEW__") {
                              setIsNewTagMode(true)
                              setNewTagName("")
                            } else {
                              setSelectedTag(e.target.value)
                            }
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition cursor-pointer appearance-none shadow-xs"
                        >
                          {availableTags.map((tag) => (
                            <option key={tag} value={tag}>
                              🏷️ {tag}
                            </option>
                          ))}
                          <option value="__NEW__" className="text-blue-600 font-bold">
                            + Add New Subject / Tag...
                          </option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Document Category */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Document Category
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setUploadDocType("NOTES")}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-semibold transition ${
                        uploadDocType === "NOTES"
                          ? "border-blue-600 bg-blue-50/80 text-blue-700 ring-1 ring-blue-500"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      <span>Notes / Syllabus</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadDocType("PYQ")}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-semibold transition ${
                        uploadDocType === "PYQ"
                          ? "border-blue-600 bg-blue-50/80 text-blue-700 ring-1 ring-blue-500"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>Past Questions (PYQ)</span>
                    </button>
                  </div>
                </div>

                {/* 3. PDF File Picker */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Select PDF File <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="doc-file-input"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  {uploadFile && (
                    <p className="text-[11px] text-blue-600 font-medium mt-1 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Selected: {uploadFile.name} ({formatFileSize(uploadFile.size)})</span>
                    </p>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadModalOpen(false)
                      setUploadStatus(null)
                    }}
                    disabled={uploading}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs transition shadow-md flex items-center gap-2 ${
                      uploading
                        ? "bg-gray-400 text-white cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-[0.98]"
                    }`}
                  >
                    {uploading ? (
                      <>
                        <span className="animate-spin">⏳</span> Indexing into PostgreSQL...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload & Parse</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* PDF Preview Modal (Portaled to document.body) */}
      {activePdfDoc &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3 truncate">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="truncate">
                    <h3 className="font-bold text-gray-900 text-sm truncate">
                      {activePdfDoc.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                        {activePdfDoc.subject}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatFileSize(activePdfDoc.file_size)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={getDocumentPdfUrl(activePdfDoc.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold"
                    title="Open in new browser tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="hidden sm:inline">New Tab</span>
                  </a>

                  <a
                    href={getDocumentPdfUrl(activePdfDoc.id)}
                    download={activePdfDoc.filename}
                    className="p-2 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold"
                    title="Download file"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download</span>
                  </a>

                  <button
                    onClick={() => setActivePdfDoc(null)}
                    className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-xl transition ml-2"
                    title="Close viewer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body: Embedded PDF View */}
              <div className="flex-1 bg-gray-100 p-2 sm:p-4">
                <iframe
                  src={getDocumentPdfUrl(activePdfDoc.id)}
                  title={activePdfDoc.title}
                  className="w-full h-full rounded-2xl border border-gray-200 bg-white shadow-inner"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
