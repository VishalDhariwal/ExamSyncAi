import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  Zap,
  Wrench,
  Plus,
  X,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ChevronDown,
  Play,
  Trash2,
  Clock,
  RotateCcw,
  GraduationCap,
  CheckSquare,
  Layers,
  Sliders,
  Loader2,
  BookOpen,
  FileText,
} from "lucide-react"
import { generateExam, getSubjects, getSubjectMaterials, getMe, getDocuments } from "../api/api"
import {
  getPendingExams,
  resumePendingExam,
  removePendingExam,
  savePendingExam,
} from "../utils/examStorage"

const PRESETS = {
  standard_40: {
    id: "standard_40",
    name: "Standard University (40m)",
    icon: GraduationCap,
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
    icon: CheckSquare,
    total_marks: 20,
    breakdown: [
      { type: "mcq", marks: 1, count: 10 },
      { type: "short", marks: 2, count: 5 },
    ],
  },
  comprehensive_50: {
    id: "comprehensive_50",
    name: "Comprehensive Mock (50m)",
    icon: Layers,
    total_marks: 50,
    breakdown: [
      { type: "mcq", marks: 1, count: 10 },
      { type: "short", marks: 2, count: 5 },
      { type: "medium", marks: 5, count: 4 },
      { type: "long", marks: 10, count: 1 },
    ],
  },
}

export default function Practice() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [subject, setSubject] = useState(searchParams.get("subject") || "")
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  // Rubric / Exam Pattern State
  const [selectedPreset, setSelectedPreset] = useState("standard_40")
  const [customTotalMarks, setCustomTotalMarks] = useState(40)
  const [breakdown, setBreakdown] = useState(PRESETS.standard_40.breakdown)
  const [isCustomMode, setIsCustomMode] = useState(false)
  const [pendingExams, setPendingExams] = useState([])
  const [usageQuota, setUsageQuota] = useState(null)

  const refreshPending = async () => {
    const list = await getPendingExams()
    setPendingExams(list || [])
  }

  // Refresh pending exams and user quota on mount
  useEffect(() => {
    refreshPending()
    const loadUsage = async () => {
      try {
        const res = await getMe()
        if (res.data?.usage) {
          setUsageQuota(res.data.usage)
        }
      } catch (err) {
        console.warn("Could not load usage quota:", err)
      }
    }
    loadUsage()
  }, [])

  // Fetch subjects strictly from user's materials
  useEffect(() => {
    const fetchSubs = async () => {
      try {
        const [subsRes, docsRes] = await Promise.allSettled([
          getSubjects(),
          getDocuments(),
        ])
        const docs = docsRes.status === "fulfilled" ? (docsRes.value.data || []) : []
        const userDocSubs = new Set(docs.map((d) => (d.subject || "").toUpperCase()))
        const rawSubs = subsRes.status === "fulfilled" ? (subsRes.value.data || []) : []
        const fetchedSubs = rawSubs.filter(
          (s) =>
            s &&
            (userDocSubs.has(s.toUpperCase()) ||
              (s.toUpperCase() !== "DSA" && s.toUpperCase() !== "DBMS"))
        )
        setSubjects(fetchedSubs)

        const paramSub = searchParams.get("subject")
        if (paramSub && fetchedSubs.includes(paramSub)) {
          setSubject(paramSub)
        } else if (fetchedSubs.length > 0) {
          setSubject(fetchedSubs[0])
        } else {
          setSubject("")
        }
      } catch (err) {
        console.error("Failed to load subjects:", err)
      }
    }
    fetchSubs()
  }, [searchParams])

  // Materials State (All Notes & Multi-Select PYQ Papers)
  const [materials, setMaterials] = useState({ notes: [], pyqs: [] })
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [selectedPyqs, setSelectedPyqs] = useState([])
  const [pyqDropdownOpen, setPyqDropdownOpen] = useState(false)
  const pyqDropdownRef = useRef(null)

  // Close PYQ dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pyqDropdownRef.current && !pyqDropdownRef.current.contains(e.target)) {
        setPyqDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Whenever subject changes, fetch materials for this subject
  useEffect(() => {
    if (!subject) {
      setMaterials({ notes: [], pyqs: [] })
      setSelectedPyqs([])
      setPyqDropdownOpen(false)
      return
    }

    const fetchMaterials = async () => {
      try {
        setLoadingMaterials(true)
        const res = await getSubjectMaterials(subject)
        const data = res.data || { notes: [], pyqs: [] }
        setMaterials(data)
        // By default, select all available PYQ papers for this subject
        const allPyqIds = (data.pyqs || []).map((p) => p.id)
        setSelectedPyqs(allPyqIds)
      } catch (err) {
        console.error("Failed to load subject materials:", err)
      } finally {
        setLoadingMaterials(false)
      }
    }

    fetchMaterials()
  }, [subject])

  const togglePyqSelection = (id) => {
    setSelectedPyqs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const selectAllPyqs = () => {
    const allIds = (materials.pyqs || []).map((p) => p.id)
    setSelectedPyqs(allIds)
  }

  const clearAllPyqs = () => {
    setSelectedPyqs([])
  }

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

  // Exam Generation Handler
  const handleGenerate = async () => {
    if (!subject.trim()) {
      alert("Please select a subject or class name.")
      return
    }

    if (!isMarksBalanced) {
      alert(
        `Total marks (${targetTotal}) must strictly equal the sum of questions (${calculatedTotal}). Difference: ${marksDifference} marks.`
      )
      return
    }

    if (usageQuota && usageQuota.exams_used >= usageQuota.exams_max) {
      setErrorMsg(`Mock exam quota reached: You have used ${usageQuota.exams_used}/${usageQuota.exams_max} mock exams. Each student is limited to 2 mock exams.`)
      return
    }

    try {
      setLoading(true)
      setErrorMsg("")

      const payload = {
        subject: subject.trim(),
        selected_pyqs: selectedPyqs,
        exam_config: {
          total_marks: targetTotal,
          breakdown: breakdown.map((t) => ({
            type: t.type,
            marks: Number(t.marks),
            count: Number(t.count),
          })),
        },
      }

      const res = await generateExam(payload)
      const newExam = {
        ...res.data,
        id: res.data.id || `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        status: "PENDING",
        user_email: localStorage.getItem("user") || "",
        createdAt: new Date().toISOString(),
        saved_answers: {},
      }
      savePendingExam(newExam, {})
      navigate("/exam")
    } catch (err) {
      console.error("Failed to generate exam:", err)
      const detail = err.response?.data?.detail || err.message
      if (err.response?.status === 429) {
        setErrorMsg(`Rate limit exceeded: ${detail}`)
      } else if (err.response?.status === 403) {
        setErrorMsg(`Quota reached: ${detail}`)
        try {
          const res = await getMe()
          if (res.data?.usage) setUsageQuota(res.data.usage)
        } catch (_) {}
      } else {
        setErrorMsg(`Exam generation failed: ${detail}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full space-y-8">
      {/* Pending Exams Banner */}
      {pendingExams.length > 0 && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-blue-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-900">
                  {pendingExams[0].subject}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-150 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                  <span>In Progress</span>
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {pendingExams[0].answeredCount || 0} of {pendingExams[0].totalQuestions || pendingExams[0].exam_questions?.length || 0} questions answered. You can resume anytime without losing your answers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={async () => {
                await removePendingExam(pendingExams[0].id)
                await refreshPending()
              }}
              className="p-2 text-gray-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition"
              title="Discard attempt"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => resumePendingExam(pendingExams[0].id, navigate)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Resume Exam</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            Exam Rubric & Pattern Configurator
          </h2>
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Zap className="w-5 h-5 fill-blue-600" />
          </div>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* 2 Dropdowns: 1. Subject / Notes, 2. PYQ Multi-Select */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Dropdown 1: Subject / Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                Subject / Notes
              </label>
              <div className="relative">
                <select
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value)
                    setPyqDropdownOpen(false)
                  }}
                  disabled={subjects.length === 0}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition cursor-pointer appearance-none shadow-xs disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {subjects.length > 0 ? (
                    subjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))
                  ) : (
                    <option value="">No study materials uploaded yet</option>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              {subjects.length === 0 && (
                <p className="text-xs text-amber-600 mt-2 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>You have not uploaded any study materials yet.</span>
                  <button
                    type="button"
                    onClick={() => navigate("/materials")}
                    className="text-blue-600 font-bold underline hover:text-blue-700 ml-1"
                  >
                    Upload notes in Study Materials &rarr;
                  </button>
                </p>
              )}
            </div>

            {/* Dropdown 2: Previous Year Questions (PYQ) Multi-Select */}
            <div className="relative" ref={pyqDropdownRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Previous Year Questions (PYQ)
                </label>
                {selectedPyqs.length > 0 && (
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                    {selectedPyqs.length} Selected
                  </span>
                )}
              </div>

              {/* Dropdown Button Trigger */}
              <button
                type="button"
                onClick={() => setPyqDropdownOpen((prev) => !prev)}
                disabled={!subject || loadingMaterials || (materials.pyqs?.length || 0) === 0}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-left text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition cursor-pointer flex items-center justify-between shadow-xs disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <span className="truncate">
                  {loadingMaterials
                    ? "Loading PYQs..."
                    : (materials.pyqs?.length || 0) === 0
                    ? `No PYQs available for ${subject || "selected subject"}`
                    : selectedPyqs.length === 0
                    ? "Select PYQ papers (0 selected)"
                    : selectedPyqs.length === materials.pyqs.length
                    ? `All PYQs Selected (${materials.pyqs.length} papers)`
                    : `${selectedPyqs.length} of ${materials.pyqs.length} PYQ papers selected`}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                    pyqDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Multi-Select Dropdown Menu Popover */}
              {pyqDropdownOpen && (
                <div className="absolute z-30 left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/80 border-b border-gray-100 text-xs">
                    <span className="font-bold text-gray-700">
                      {materials.pyqs?.length || 0} PYQ Papers for {subject}
                    </span>
                    {materials.pyqs && materials.pyqs.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={selectAllPyqs}
                          className="font-bold text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          Select All
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={clearAllPyqs}
                          className="font-bold text-gray-500 hover:text-gray-700 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                    {materials.pyqs && materials.pyqs.length > 0 ? (
                      materials.pyqs.map((p) => {
                        const isChecked = selectedPyqs.includes(p.id)
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition select-none ${
                              isChecked
                                ? "bg-blue-50/40 hover:bg-blue-50/60"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePyqSelection(p.id)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer accent-blue-600"
                            />
                            <div className="min-w-0 flex-1">
                              <div
                                className="text-xs font-semibold text-gray-900 truncate"
                                title={p.title}
                              >
                                {p.title}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {p.chunk_count} chunks •{" "}
                                {p.is_user_uploaded ? "User Uploaded" : "Course Archive"}
                              </div>
                            </div>
                            {isChecked && (
                              <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            )}
                          </label>
                        )
                      })
                    ) : (
                      <div className="p-4 text-center text-xs text-gray-500">
                        No PYQ papers found for {subject}.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preset Buttons */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Select Exam Format Preset
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.values(PRESETS).map((p) => {
                const IconComponent = p.icon || GraduationCap
                const isSelected = selectedPreset === p.id && !isCustomMode

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p.id)}
                    className={`p-3.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs ring-1 ring-blue-500"
                        : "border-gray-200 hover:border-blue-200 text-gray-700 bg-gray-50/40"
                    }`}
                  >
                    <IconComponent
                      className={`w-4 h-4 flex-shrink-0 ${
                        isSelected ? "text-blue-600" : "text-gray-500"
                      }`}
                    />
                    <span className="font-semibold text-xs text-gray-900">{p.name}</span>
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() => handleSelectPreset("custom")}
                className={`p-3.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                  isCustomMode
                    ? "border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs ring-1 ring-blue-500"
                    : "border-gray-200 hover:border-blue-200 text-gray-700 bg-gray-50/40"
                }`}
              >
                <Sliders
                  className={`w-4 h-4 flex-shrink-0 ${
                    isCustomMode ? "text-blue-600" : "text-gray-500"
                  }`}
                />
                <span className="font-semibold text-xs text-gray-900">Custom Rubric</span>
              </button>
            </div>
          </div>

          {/* Rubric Breakdown Controls */}
          <div className="bg-gray-50/70 rounded-2xl p-5 border border-gray-200/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
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
                  className="w-24 px-3 py-1.5 text-right text-base font-bold bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-gray-600">Marks</span>
              </div>
            </div>

            {/* Question Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-gray-400 uppercase tracking-wider text-[10px] border-b border-gray-200">
                    <th className="pb-2">Question Type</th>
                    <th className="pb-2 text-center">Marks/Question</th>
                    <th className="pb-2 text-center">Count</th>
                    <th className="pb-2 text-right">Subtotal</th>
                    <th className="pb-2 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/60">
                  {breakdown.map((tier, idx) => (
                    <tr key={idx} className="hover:bg-white/60 transition">
                      <td className="py-2.5">
                        <select
                          value={tier.type}
                          onChange={(e) => handleTierChange(idx, "type", e.target.value)}
                          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="mcq">MCQ (4 choices)</option>
                          <option value="short">Short Subjective</option>
                          <option value="medium">Medium Subjective</option>
                          <option value="long">Long Essay</option>
                        </select>
                      </td>
                      <td className="py-2.5 text-center">
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={tier.marks}
                          onChange={(e) =>
                            handleTierChange(idx, "marks", Number(e.target.value) || 1)
                          }
                          className="w-16 px-2 py-1 text-center bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2.5 text-center">
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={tier.count}
                          onChange={(e) =>
                            handleTierChange(idx, "count", Number(e.target.value) || 1)
                          }
                          className="w-16 px-2 py-1 text-center bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2.5 text-right font-extrabold text-gray-800">
                        {tier.marks * tier.count}m
                      </td>
                      <td className="py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveTier(idx)}
                          disabled={breakdown.length <= 1}
                          className={`text-gray-400 hover:text-red-500 p-1 transition ${
                            breakdown.length <= 1 ? "opacity-20 cursor-not-allowed" : ""
                          }`}
                          title="Remove tier"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <button
                type="button"
                onClick={handleAddTier}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question Tier</span>
              </button>
              <div className="text-xs text-gray-500">
                Total Questions:{" "}
                <span className="font-bold text-gray-900">
                  {breakdown.reduce((sum, t) => sum + (Number(t.count) || 0), 0)}
                </span>
              </div>
            </div>

            {/* Live Mathematical Invariant Balance Indicator */}
            <div className="pt-3 border-t border-gray-200 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-gray-600">Calculated Marks Sum:</span>
                <span
                  className={
                    isMarksBalanced
                      ? "text-blue-600 font-extrabold text-sm"
                      : "text-red-600 font-extrabold text-sm"
                  }
                >
                  {calculatedTotal} / {targetTotal} Marks
                </span>
              </div>

              {isMarksBalanced ? (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>Balanced: Questions match target total marks perfectly!</span>
                </div>
              ) : marksDifference > 0 ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3.5 py-2 rounded-xl flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Need {marksDifference} more mark(s) to match target ({targetTotal}m)</span>
                  </div>
                  <span className="text-[10px] font-bold">-{marksDifference}m</span>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2 rounded-xl flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span>Exceeds target by {Math.abs(marksDifference)} mark(s)</span>
                  </div>
                  <span className="text-[10px] font-bold">+{Math.abs(marksDifference)}m</span>
                </div>
              )}
            </div>
          </div>

          {/* Quota limit warning banner */}
          {usageQuota && usageQuota.exams_used >= usageQuota.exams_max && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-3 rounded-xl flex items-start gap-2.5 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold">Mock Exam Quota Limit Reached ({usageQuota.exams_used} / {usageQuota.exams_max})</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Each student account is limited to generating and giving a maximum of 2 mock exams.
                </p>
              </div>
            </div>
          )}

          {/* Launch Exam Button with validation state */}
          <button
            onClick={handleGenerate}
            disabled={!subject.trim() || !isMarksBalanced || loading || (usageQuota && usageQuota.exams_used >= usageQuota.exams_max)}
            className={`w-full py-3.5 rounded-xl font-bold text-sm transition shadow-lg flex items-center justify-center gap-2 ${
              !subject.trim() || !isMarksBalanced || (usageQuota && usageQuota.exams_used >= usageQuota.exams_max)
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : loading
                ? "bg-blue-600/80 text-white cursor-wait"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25 active:scale-[0.99]"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Launching...</span>
              </>
            ) : usageQuota && usageQuota.exams_used >= usageQuota.exams_max ? (
              <>
                <Lock className="w-4 h-4 text-gray-400" />
                <span>Mock Exam Limit Reached ({usageQuota.exams_used}/{usageQuota.exams_max})</span>
              </>
            ) : isMarksBalanced ? (
              <>
                <Zap className="w-4 h-4 fill-white" />
                <span>Launch Mock Exam ({targetTotal} Marks)</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Balance Rubric to Launch ({calculatedTotal}/{targetTotal}m)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
