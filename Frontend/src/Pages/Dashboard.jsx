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

const PRESETS = {
  standard_40: {
    id: "standard_40",
    name: "Standard University (40m)",
    description: "5×2m, 4×3m, 2×4m, 2×5m (13 Qs)",
    total_marks: 40,
    breakdown: [
      { type: "short", marks: 2, count: 5 },
      { type: "short", marks: 3, count: 4 },
      { type: "medium", marks: 4, count: 2 },
      { type: "long", marks: 5, count: 2 },
    ],
  },
  quiz_20: {
    id: "quiz_20",
    name: "MCQ & Short Quiz (20m)",
    description: "10×1m MCQs + 5×2m Short Questions",
    total_marks: 20,
    breakdown: [
      { type: "mcq", marks: 1, count: 10 },
      { type: "short", marks: 2, count: 5 },
    ],
  },
  comprehensive_50: {
    id: "comprehensive_50",
    name: "Comprehensive Mock (50m)",
    description: "10×1m MCQs, 5×2m Short, 4×5m Medium, 1×10m Long",
    total_marks: 50,
    breakdown: [
      { type: "mcq", marks: 1, count: 10 },
      { type: "short", marks: 2, count: 5 },
      { type: "medium", marks: 5, count: 4 },
      { type: "long", marks: 10, count: 1 },
    ],
  },
}

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

  // Rubric / Exam Pattern State
  const [selectedPreset, setSelectedPreset] = useState("standard_40")
  const [customTotalMarks, setCustomTotalMarks] = useState(40)
  const [breakdown, setBreakdown] = useState(PRESETS.standard_40.breakdown)
  const [isCustomMode, setIsCustomMode] = useState(false)

  // Calculated total marks from questions breakdown
  const calculatedTotal = breakdown.reduce(
    (sum, tier) => sum + (Number(tier.marks) || 0) * (Number(tier.count) || 0),
    0
  )
  const targetTotal = Number(customTotalMarks) || 0
  const isMarksBalanced = calculatedTotal === targetTotal && targetTotal > 0
  const marksDifference = targetTotal - calculatedTotal

  // Preset switch handler
  const handleSelectPreset = (presetKey) => {
    setSelectedPreset(presetKey)
    if (presetKey === "custom") {
      setIsCustomMode(true)
    } else {
      setIsCustomMode(false)
      const p = PRESETS[presetKey]
      setCustomTotalMarks(p.total_marks)
      setBreakdown(p.breakdown.map((b) => ({ ...b })))
    }
  }

  // Tier modifier handlers
  const handleTierChange = (index, field, value) => {
    setIsCustomMode(true)
    setSelectedPreset("custom")
    const updated = [...breakdown]
    updated[index] = { ...updated[index], [field]: value }
    setBreakdown(updated)
  }

  const handleAddTier = () => {
    setIsCustomMode(true)
    setSelectedPreset("custom")
    setBreakdown([...breakdown, { type: "short", marks: 2, count: 1 }])
  }

  const handleRemoveTier = (index) => {
    if (breakdown.length <= 1) return
    setIsCustomMode(true)
    setSelectedPreset("custom")
    setBreakdown(breakdown.filter((_, i) => i !== index))
  }

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

  // Generate Exam with Custom Rubric
  const generate = async () => {
    const targetSubject = subject.trim()
    if (!targetSubject) {
      alert("Please enter or select a class or subject first.")
      return
    }

    if (!isMarksBalanced) {
      alert(
        `Rubric Mismatch: Configured marks (${calculatedTotal}) must exactly equal the total marks (${targetTotal}). Please balance your rubric before launching.`
      )
      return
    }

    try {
      setLoading(true)

      const examConfigPayload = {
        total_marks: targetTotal,
        breakdown: breakdown.map((t) => ({
          type: t.type,
          marks: Number(t.marks),
          count: Number(t.count),
        })),
      }

      const res = await generateExam({
        student_id: email,
        subject: targetSubject,
        exam_config: examConfigPayload,
      })

      localStorage.setItem("exam", JSON.stringify(res.data))
      navigate("/exam")
    } catch (err) {
      console.error("Generate exam failed:", err)
      const detail =
        err.response?.data?.detail ||
        "Failed to generate exam. Please check your notes and rubric."
      alert(detail)
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
          isMarksBalanced={isMarksBalanced}
          targetTotal={targetTotal}
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
                    Configure your custom exam pattern (MCQs, short & long questions) and ensure exact mark balance!
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
                      disabled={!subject.trim() || !isMarksBalanced}
                      className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition backdrop-blur-sm flex items-center gap-2 ${
                        !subject.trim() || !isMarksBalanced
                          ? "bg-white/10 text-white/50 cursor-not-allowed border border-white/10"
                          : "bg-white/15 hover:bg-white/25 text-white border border-white/30"
                      }`}
                    >
                      <span>⚡</span> Practice &quot;{subject || "Subject"}&quot; ({targetTotal}m)
                    </button>
                  </div>
                </div>

                {/* Subtle background decoration */}
                <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
              </div>

              {/* View 1: Upload Hub & Practice Launcher */}
              {activeTab === "hub" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Upload Form (6 cols) */}
                  <div className="lg:col-span-6 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">Upload Study Material</h2>
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
                            <span>Existing:</span>
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

                  {/* Exam Pattern & Rubric Configurator (6 cols) */}
                  <div className="lg:col-span-6 space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">Exam Rubric & Pattern</h2>
                          <p className="text-xs text-gray-500">
                            Configure total marks, MCQs, and question mark distribution
                          </p>
                        </div>
                        <span className="text-2xl">🎯</span>
                      </div>

                      <div className="space-y-4">
                        {/* Target Subject */}
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

                        {/* Preset Selection Tabs */}
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                            Exam Format Preset
                          </label>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.values(PRESETS).map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectPreset(p.id)}
                                className={`p-2.5 rounded-xl border text-left transition ${
                                  selectedPreset === p.id && !isCustomMode
                                    ? "border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-sm"
                                    : "border-gray-200 hover:border-gray-300 text-gray-700 bg-gray-50/50"
                                }`}
                              >
                                <div className="font-semibold">{p.name}</div>
                                <div className="text-[11px] text-gray-500 truncate">{p.description}</div>
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleSelectPreset("custom")}
                              className={`p-2.5 rounded-xl border text-left transition ${
                                isCustomMode
                                  ? "border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-sm"
                                  : "border-gray-200 hover:border-gray-300 text-gray-700 bg-gray-50/50"
                              }`}
                            >
                              <div className="font-semibold">🛠️ Custom Rubric</div>
                              <div className="text-[11px] text-gray-500">Build your own pattern</div>
                            </button>
                          </div>
                        </div>

                        {/* Custom Rubric Controls */}
                        <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-200/80 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                              Target Total Marks
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max="200"
                                value={customTotalMarks}
                                onChange={(e) => {
                                  setIsCustomMode(true)
                                  setSelectedPreset("custom")
                                  setCustomTotalMarks(Number(e.target.value) || 0)
                                }}
                                className="w-20 px-2.5 py-1 text-right text-sm font-bold bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-xs font-semibold text-gray-600">Marks</span>
                            </div>
                          </div>

                          {/* Question Breakdown Table */}
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-gray-500 flex justify-between px-1">
                              <span>Question Tier</span>
                              <span>Marks × Qty = Subtotal</span>
                            </div>

                            {breakdown.map((tier, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-gray-200 text-xs shadow-2xs"
                              >
                                <select
                                  value={tier.type === "mcq" ? "mcq" : `sub_${tier.marks}`}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    if (val === "mcq") {
                                      handleTierChange(idx, "type", "mcq")
                                      handleTierChange(idx, "marks", 1)
                                    } else {
                                      const m = Number(val.replace("sub_", "")) || tier.marks
                                      handleTierChange(idx, "type", "subjective")
                                      handleTierChange(idx, "marks", m)
                                    }
                                  }}
                                  className="flex-1 bg-gray-50 border border-gray-200 rounded p-1 text-xs text-gray-800"
                                >
                                  <option value="mcq">MCQ (1 mark each)</option>
                                  <option value="sub_2">Short (2 marks)</option>
                                  <option value="sub_3">Short (3 marks)</option>
                                  <option value="sub_4">Medium (4 marks)</option>
                                  <option value="sub_5">Medium (5 marks)</option>
                                  <option value="sub_10">Long (10 marks)</option>
                                </select>

                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={tier.marks}
                                    onChange={(e) =>
                                      handleTierChange(idx, "marks", Number(e.target.value) || 1)
                                    }
                                    className="w-12 p-1 text-center bg-gray-50 border border-gray-200 rounded font-semibold"
                                    title="Marks per question"
                                  />
                                  <span>m ×</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={tier.count}
                                    onChange={(e) =>
                                      handleTierChange(idx, "count", Number(e.target.value) || 1)
                                    }
                                    className="w-12 p-1 text-center bg-gray-50 border border-gray-200 rounded font-semibold"
                                    title="Question count"
                                  />
                                  <span>=</span>
                                  <span className="w-10 font-bold text-gray-800 text-right">
                                    {(Number(tier.marks) || 0) * (Number(tier.count) || 0)}m
                                  </span>
                                </div>

                                {breakdown.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTier(idx)}
                                    className="text-gray-400 hover:text-red-600 px-1 font-bold text-sm"
                                    title="Remove tier"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={handleAddTier}
                              className="w-full py-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold border border-dashed border-blue-300 hover:border-blue-400 bg-blue-50/40 rounded-lg transition"
                            >
                              + Add Question Tier
                            </button>
                          </div>

                          {/* Live Total Invariant Status Bar */}
                          <div className="pt-2 border-t border-gray-200">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-semibold text-gray-600">Calculated Sum:</span>
                              <span className="font-extrabold text-gray-900">
                                {calculatedTotal} / {targetTotal} Marks
                              </span>
                            </div>

                            {isMarksBalanced ? (
                              <div className="bg-green-100 text-green-800 border border-green-300 p-2 rounded-lg text-xs font-semibold flex items-center justify-between">
                                <span>✅ Balanced: Questions match target total marks!</span>
                                <span className="text-[10px] bg-green-200 px-2 py-0.5 rounded">Exact</span>
                              </div>
                            ) : marksDifference > 0 ? (
                              <div className="bg-amber-100 text-amber-800 border border-amber-300 p-2 rounded-lg text-xs font-medium flex items-center justify-between">
                                <span>⚠️ Need {marksDifference} more mark(s) to reach target</span>
                                <span className="text-[10px] font-bold">-{marksDifference}m</span>
                              </div>
                            ) : (
                              <div className="bg-red-100 text-red-800 border border-red-300 p-2 rounded-lg text-xs font-medium flex items-center justify-between">
                                <span>⛔ Exceeds target by {Math.abs(marksDifference)} mark(s)</span>
                                <span className="text-[10px] font-bold">+{Math.abs(marksDifference)}m</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Launch Exam Button with validation state */}
                        <button
                          onClick={generate}
                          disabled={!subject.trim() || !isMarksBalanced}
                          className={`w-full py-3.5 rounded-xl font-bold text-sm transition shadow-lg flex items-center justify-center gap-2 ${
                            !subject.trim() || !isMarksBalanced
                              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                              : "bg-green-600 hover:bg-green-500 text-white shadow-green-600/20 active:scale-[0.99]"
                          }`}
                        >
                          {isMarksBalanced ? (
                            <>
                              <span>⚡</span> Launch Mock Exam ({targetTotal} Marks)
                            </>
                          ) : (
                            <>
                              <span>🔒</span> Balance Rubric to Launch ({calculatedTotal}/{targetTotal}m)
                            </>
                          )}
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