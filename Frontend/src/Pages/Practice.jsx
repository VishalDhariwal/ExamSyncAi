import { useState, useEffect } from "react"
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
} from "lucide-react"
import { generateExam, getSubjects } from "../api/api"
import AILoader from "../components/AILoader"
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

  const refreshPending = async () => {
    const list = await getPendingExams()
    setPendingExams(list || [])
  }

  // Refresh pending exams on mount
  useEffect(() => {
    refreshPending()
  }, [])

  // Fetch subjects strictly from user's materials
  useEffect(() => {
    const fetchSubs = async () => {
      try {
        const res = await getSubjects()
        const fetchedSubs = res.data || []
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

    try {
      setLoading(true)
      setErrorMsg("")

      const payload = {
        subject: subject.trim(),
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
        id: `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
      setErrorMsg(`Exam generation failed: ${detail}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full space-y-8">
      {loading && <AILoader />}

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
          {/* Target Subject Dropdown */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Target Subject / Class
            </label>
            <div className="relative">
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
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

          {/* Launch Exam Button with validation state */}
          <button
            onClick={handleGenerate}
            disabled={!subject.trim() || !isMarksBalanced || loading}
            className={`w-full py-3.5 rounded-xl font-bold text-sm transition shadow-lg flex items-center justify-center gap-2 ${
              !subject.trim() || !isMarksBalanced || loading
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25 active:scale-[0.99]"
            }`}
          >
            {isMarksBalanced ? (
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
