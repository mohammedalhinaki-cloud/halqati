import React, { useEffect, useMemo, useState } from "react"
import { createClient, SupabaseClient } from "@supabase/supabase-js"

// ===================== أنواع البيانات =====================
type Role = "owner" | "admin" | "supervisor" | "teacher"
type Grade = "ممتاز" | "جيد جدًا" | "جيد" | "يحتاج إعادة"
type ReviewType = "small" | "large"
type ErrorType = "خطأ في الحفظ" | "نسيان" | "تردد" | "خطأ تجويد" | "تلقين"

interface Circle { id: string; name: string }
interface Staff { id: string; name: string; phone: string; role: Role; circleId: string | null }
interface MemorizationEntry {
  id: string; date: string; surahNumber: number; surahName: string;
  fromAyah: number; toAyah: number; ayahCount: number;
  grade: Grade; teacherId: string; notes?: string
}
interface ReviewEntry {
  id: string; date: string; reviewType: ReviewType;
  surahNumber: number; surahName: string; fromAyah: number; toAyah: number;
  ayahCount: number; grade: Grade; teacherId: string
}
interface ErrorEntry { id: string; date: string; type: ErrorType; description: string; surahName?: string }
interface NoteEntry { id: string; date: string; text: string; authorId: string }
interface VisitEntry { date: string; count: number }
interface Student {
  id: string; name: string; phone: string; circleId: string | null;
  accessToken: string;
  memorizationLog: MemorizationEntry[];
  reviewLog: ReviewEntry[];
  errorsLog: ErrorEntry[];
  notes: NoteEntry[];
  visitLog: VisitEntry[];
}
interface Holiday { id: string; name: string; startDate: string; endDate: string }
interface AcademicPlan {
  startDate: string; endDate: string;
  activeWeekdays: number[]; // 0=الأحد ... 6=السبت
  holidays: Holiday[];
}
type AttendanceStatus = "حاضر" | "غائب" | "متأخر" | "غائب بعذر"
interface AttendanceRecord { id: string; studentId: string; date: string; status: AttendanceStatus; note?: string; recordedBy: string; createdAt: string }

// ===================== بيانات القرآن =====================
const SURAHS: { number: number; name: string; ayahCount: number }[] = [
  [1, "الفاتحة", 7], [2, "البقرة", 286], [3, "آل عمران", 200], [4, "النساء", 176], [5, "المائدة", 120],
  [6, "الأنعام", 165], [7, "الأعراف", 206], [8, "الأنفال", 75], [9, "التوبة", 129], [10, "يونس", 109],
  [11, "هود", 123], [12, "يوسف", 111], [13, "الرعد", 43], [14, "إبراهيم", 52], [15, "الحجر", 99],
  [16, "النحل", 128], [17, "الإسراء", 111], [18, "الكهف", 110], [19, "مريم", 98], [20, "طه", 135],
  [21, "الأنبياء", 112], [22, "الحج", 78], [23, "المؤمنون", 118], [24, "النور", 64], [25, "الفرقان", 77],
  [26, "الشعراء", 227], [27, "النمل", 93], [28, "القصص", 88], [29, "العنكبوت", 69], [30, "الروم", 60],
  [31, "لقمان", 34], [32, "السجدة", 30], [33, "الأحزاب", 73], [34, "سبأ", 54], [35, "فاطر", 45],
  [36, "يس", 83], [37, "الصافات", 182], [38, "ص", 88], [39, "الزمر", 75], [40, "غافر", 85],
  [41, "فصلت", 54], [42, "الشورى", 53], [43, "الزخرف", 89], [44, "الدخان", 59], [45, "الجاثية", 37],
  [46, "الأحقاف", 35], [47, "محمد", 38], [48, "الفتح", 29], [49, "الحجرات", 18], [50, "ق", 45],
  [51, "الذاريات", 60], [52, "الطور", 49], [53, "النجم", 62], [54, "القمر", 55], [55, "الرحمن", 78],
  [56, "الواقعة", 96], [57, "الحديد", 29], [58, "المجادلة", 22], [59, "الحشر", 24], [60, "الممتحنة", 13],
  [61, "الصف", 14], [62, "الجمعة", 11], [63, "المنافقون", 11], [64, "التغابن", 18], [65, "الطلاق", 12],
  [66, "التحريم", 12], [67, "الملك", 30], [68, "القلم", 52], [69, "الحاقة", 52], [70, "المعارج", 44],
  [71, "نوح", 28], [72, "الجن", 28], [73, "المزمل", 20], [74, "المدثر", 56], [75, "القيامة", 40],
  [76, "الإنسان", 31], [77, "المرسلات", 50], [78, "النبأ", 40], [79, "النازعات", 46], [80, "عبس", 42],
  [81, "التكوير", 29], [82, "الانفطار", 19], [83, "المطففين", 36], [84, "الانشقاق", 25], [85, "البروج", 22],
  [86, "الطارق", 17], [87, "الأعلى", 19], [88, "الغاشية", 26], [89, "الفجر", 30], [90, "البلد", 20],
  [91, "الشمس", 15], [92, "الليل", 21], [93, "الضحى", 11], [94, "الشرح", 8], [95, "التين", 8],
  [96, "العلق", 19], [97, "القدر", 5], [98, "البينة", 8], [99, "الزلزلة", 8], [100, "العاديات", 11],
  [101, "القارعة", 11], [102, "التكاثر", 8], [103, "العصر", 3], [104, "الهمزة", 9], [105, "الفيل", 5],
  [106, "قريش", 4], [107, "الماعون", 7], [108, "الكوثر", 3], [109, "الكافرون", 6], [110, "النصر", 3],
  [111, "المسد", 5], [112, "الإخلاص", 4], [113, "الفلق", 5], [114, "الناس", 6],
].map(([n, name, ayah]) => ({ number: Number(n), name: String(name), ayahCount: Number(ayah) }))

const GRADES: Grade[] = ["ممتاز", "جيد جدًا", "جيد", "يحتاج إعادة"]
const GRADE_COLOR: Record<Grade, string> = { "ممتاز": "#1F5E3A", "جيد جدًا": "#3F8F5F", "جيد": "#C9A227", "يحتاج إعادة": "#B3492C" }
const ERROR_TYPES: ErrorType[] = ["خطأ في الحفظ", "نسيان", "تردد", "خطأ تجويد", "تلقين"]
const ROLE_LABEL: Record<Role, string> = { owner: "المالك الرئيسي", admin: "المدير", supervisor: "المشرف", teacher: "المعلم" }
const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
const ATTENDANCE_STATUS: AttendanceStatus[] = ["حاضر", "غائب", "متأخر", "غائب بعذر"]
const ATTENDANCE_COLOR: Record<AttendanceStatus, string> = { "حاضر": "#1F5E3A", "غائب": "#B3492C", "متأخر": "#C9A227", "غائب بعذر": "#2563EB" }
const ATTENDANCE_BG: Record<AttendanceStatus, string> = { "حاضر": "bg-emerald-50 border-emerald-200 text-emerald-700", "غائب": "bg-red-50 border-red-200 text-red-700", "متأخر": "bg-amber-50 border-amber-200 text-amber-700", "غائب بعذر": "bg-blue-50 border-blue-200 text-blue-700" }

// ===================== Supabase =====================
const SQL_CODE = `-- ============================================================
-- كود إنشاء جداول نظام "حلقتي" في Supabase SQL Editor
-- ============================================================
CREATE TABLE IF NOT EXISTS halqati_circles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS halqati_staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'supervisor', 'teacher')),
    circle_id TEXT REFERENCES halqati_circles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS halqati_students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    circle_id TEXT REFERENCES halqati_circles(id) ON DELETE SET NULL,
    access_token TEXT UNIQUE NOT NULL,
    memorization_log JSONB DEFAULT '[]'::jsonb,
    review_log JSONB DEFAULT '[]'::jsonb,
    errors_log JSONB DEFAULT '[]'::jsonb,
    notes JSONB DEFAULT '[]'::jsonb,
    visit_log JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS halqati_settings (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS halqati_attendance (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES halqati_students(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('حاضر', 'غائب', 'متأخر', 'غائب بعذر')),
    note TEXT,
    recorded_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, date)
);
CREATE INDEX IF NOT EXISTS idx_halqati_staff_phone ON halqati_staff(phone);
CREATE INDEX IF NOT EXISTS idx_halqati_students_token ON halqati_students(access_token);
CREATE INDEX IF NOT EXISTS idx_halqati_attendance_date ON halqati_attendance(date);
CREATE INDEX IF NOT EXISTS idx_halqati_attendance_student ON halqati_attendance(student_id);
ALTER TABLE halqati_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE halqati_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE halqati_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE halqati_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE halqati_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access halqati_circles" ON halqati_circles;
CREATE POLICY "Public access halqati_circles" ON halqati_circles FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public access halqati_staff" ON halqati_staff;
CREATE POLICY "Public access halqati_staff" ON halqati_staff FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public access halqati_students" ON halqati_students;
CREATE POLICY "Public access halqati_students" ON halqati_students FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public access halqati_settings" ON halqati_settings;
CREATE POLICY "Public access halqati_settings" ON halqati_settings FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public access halqati_attendance" ON halqati_attendance;
CREATE POLICY "Public access halqati_attendance" ON halqati_attendance FOR ALL USING (true) WITH CHECK (true);
SELECT 'تم إنشاء جداول نظام حلقتي بنجاح!' AS status;`

function getSupabaseConfig() {
  const url = (import.meta as any).env?.VITE_SUPABASE_URL || localStorage.getItem("halqati_supabase_url") || ""
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || localStorage.getItem("halqati_supabase_anon_key") || ""
  return { url, anonKey, isConfigured: !!(url && anonKey) }
}
let supabaseClient: SupabaseClient | null = null
function getSupabase(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseConfig()
  if (!isConfigured) return null
  if (supabaseClient) return supabaseClient
  try {
    supabaseClient = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
    return supabaseClient
  } catch { return null }
}
function saveSupabaseConfig(url: string, key: string) {
  if (url.trim()) localStorage.setItem("halqati_supabase_url", url.trim()); else localStorage.removeItem("halqati_supabase_url")
  if (key.trim()) localStorage.setItem("halqati_supabase_anon_key", key.trim()); else localStorage.removeItem("halqati_supabase_anon_key")
  supabaseClient = null
}

// ===================== Helpers =====================
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
const todayISO = () => new Date().toISOString().slice(0, 10)
const fmtDate = (iso: string) => {
  try { return new Date(iso + "T12:00:00").toLocaleDateString("ar-SA") } catch { return iso }
}
const toHijri = (iso: string) => {
  try {
    return new Date(iso + "T12:00:00Z").toLocaleDateString("ar-SA-u-ca-islamic-umalqura", { year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return iso }
}
const fmtBoth = (iso: string) => {
  try {
    const h = toHijri(iso)
    const m = fmtDate(iso)
    const hijri = h.includes("هـ") ? h : `${h}هـ`
    const greg = m.includes("م") ? m : `${m}م`
    return `${hijri} — ${greg}`
  } catch { return iso }
}
const tokenForStudent = (s: Student) => s.accessToken
const linkForStudent = (s: Student) => {
  const base = window.location.origin + window.location.pathname
  return `${base}?t=${s.accessToken}`
}

// ===================== App =====================
export default function App() {
  // Data
  const [circles, setCircles] = useState<Circle[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [plan, setPlan] = useState<AcademicPlan>({ startDate: todayISO(), endDate: todayISO(), activeWeekdays: [0, 1, 2, 3, 4], holidays: [] })
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [attendanceDate, setAttendanceDate] = useState<string>(todayISO())
  const [attendanceNote, setAttendanceNote] = useState<Record<string,string>>({})
  const [supervisorCircle, setSupervisorCircle] = useState<string>("all")
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => localStorage.getItem("halqati_session"))
  const [toast, setToast] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterCircle, setFilterCircle] = useState<string>("all")
  const [supabaseModal, setSupabaseModal] = useState(false)
  const [planModal, setPlanModal] = useState(false)
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(() => localStorage.getItem("halqati_supabase_url") || "")
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(() => localStorage.getItem("halqati_supabase_anon_key") || "")
  const [cloudStatus, setCloudStatus] = useState<string | null>(null)
  const [isCloudConnected, setIsCloudConnected] = useState<boolean | null>(null)

  // Modals for CRUD
  const [showCircleModal, setShowCircleModal] = useState(false)
  const [circleName, setCircleName] = useState("")
  const [editingCircleId, setEditingCircleId] = useState<string | null>(null)

  const [showStaffModal, setShowStaffModal] = useState(false)
  const [staffForm, setStaffForm] = useState<{ name: string; phone: string; role: Role; circleId: string }>({ name: "", phone: "", role: "teacher", circleId: "" })
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)

  const [showStudentModal, setShowStudentModal] = useState(false)
  const [studentForm, setStudentForm] = useState<{ name: string; phone: string; circleId: string }>({ name: "", phone: "", circleId: "" })
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)

  // Add logs modals
  const [showMemModal, setShowMemModal] = useState(false)
  const [memForm, setMemForm] = useState({ surahNumber: 1, fromAyah: 1, toAyah: 7, grade: "ممتاز" as Grade, date: todayISO(), notes: "" })
  const [showReviewModal, setShowReviewModal] = useState<ReviewType | null>(null)
  const [reviewForm, setReviewForm] = useState({ surahNumber: 2, fromAyah: 1, toAyah: 10, grade: "ممتاز" as Grade, date: todayISO() })
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorForm, setErrorForm] = useState({ type: "خطأ في الحفظ" as ErrorType, description: "", date: todayISO() })
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [noteText, setNoteText] = useState("")

  // Login states
  const [loginTab, setLoginTab] = useState<"management" | "teacher">("management")
  const [loginPhone, setLoginPhone] = useState("")
  const [loginError, setLoginError] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [ownerPhone, setOwnerPhone] = useState("")

  // Load from localStorage
  useEffect(() => {
    try {
      const c = localStorage.getItem("halqati_circles")
      const s = localStorage.getItem("halqati_staff")
      const st = localStorage.getItem("halqati_students")
      const p = localStorage.getItem("halqati_academic_plan")
      const att = localStorage.getItem("halqati_attendance")
      if (c) setCircles(JSON.parse(c))
      if (s) setStaff(JSON.parse(s))
      if (st) setStudents(JSON.parse(st))
      if (p) setPlan(JSON.parse(p))
      if (att) try{ setAttendance(JSON.parse(att)) }catch{}
    } catch { }
    // check cloud connection
    const sb = getSupabase()
    if (sb) {
      sb.from("halqati_circles").select("id").limit(1).then(({ error }) => {
        setIsCloudConnected(!error)
        if (!error) setCloudStatus("Supabase متصل ✓")
        else setCloudStatus("Supabase غير متصل")
      })
    }
    // handle ?t= token view for parent
    const params = new URLSearchParams(window.location.search)
    const t = params.get("t")
    if (t) {
      // will handle after students loaded
      setTimeout(() => {
        const found = JSON.parse(localStorage.getItem("halqati_students") || "[]").find((x: Student) => x.accessToken === t)
        if (found) {
          setSelectedStudentId(found.id)
          // log visit
          const today = todayISO()
          const updated = JSON.parse(localStorage.getItem("halqati_students") || "[]").map((s: Student) => {
            if (s.id === found.id) {
              const visits = s.visitLog || []
              const idx = visits.findIndex(v => v.date === today)
              if (idx >= 0) visits[idx].count += 1
              else visits.push({ date: today, count: 1 })
              return { ...s, visitLog: visits }
            }
            return s
          })
          localStorage.setItem("halqati_students", JSON.stringify(updated))
          setStudents(updated)
        }
      }, 300)
    }
  }, [])

  // Persist
  useEffect(() => { localStorage.setItem("halqati_circles", JSON.stringify(circles)) }, [circles])
  useEffect(() => { localStorage.setItem("halqati_staff", JSON.stringify(staff)) }, [staff])
  useEffect(() => { localStorage.setItem("halqati_students", JSON.stringify(students)) }, [students])
  useEffect(() => { localStorage.setItem("halqati_academic_plan", JSON.stringify(plan)) }, [plan])
  useEffect(() => { localStorage.setItem("halqati_attendance", JSON.stringify(attendance)) }, [attendance])
  useEffect(() => {
    if (currentUserId) localStorage.setItem("halqati_session", currentUserId)
    else localStorage.removeItem("halqati_session")
  }, [currentUserId])

  const currentUser = useMemo(() => staff.find(x => x.id === currentUserId) || null, [staff, currentUserId])
  const isOwner = currentUser?.role === "owner"
  const isOwnerOrAdmin = currentUser && ["owner", "admin"].includes(currentUser.role)
  const canRecordAttendance = currentUser && ["owner", "admin", "supervisor"].includes(currentUser.role)
  const hasOwner = staff.some(s => s.role === "owner")

  // ===== Supervisor dedicated view helpers =====
  const supervisorStudents = useMemo(() => {
    if (currentUser?.role !== "supervisor") return []
    let list = students
    if (supervisorCircle !== "all") list = list.filter(s => s.circleId === supervisorCircle)
    return list
  }, [students, supervisorCircle, currentUser])
  const supervisorStats = useMemo(() => {
    const list = attendance.filter(a => a.date === attendanceDate && supervisorStudents.some(s => s.id === a.studentId))
    return {
      حاضر: list.filter(a => a.status === "حاضر").length,
      غائب: list.filter(a => a.status === "غائب").length,
      متأخر: list.filter(a => a.status === "متأخر").length,
      "غائب بعذر": list.filter(a => a.status === "غائب بعذر").length,
      total: list.length
    }
  }, [attendance, attendanceDate, supervisorStudents])

  // Auto-select supervisor circle if assigned
  useEffect(() => {
    if (currentUser?.role === "supervisor" && supervisorCircle === "all" && currentUser.circleId) {
      setSupervisorCircle(currentUser.circleId)
    } else if (currentUser?.role === "supervisor" && supervisorCircle === "all" && circles.length === 1) {
      setSupervisorCircle(circles[0].id)
    }
  }, [currentUser, circles])


  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2800) }

  // Cloud sync helpers
  const testCloud = async () => {
    const sb = getSupabase()
    if (!sb) { setCloudStatus("أدخل مفاتيح Supabase أولاً"); setIsCloudConnected(false); return }
    setCloudStatus("جاري الاختبار...")
    const { error } = await sb.from("halqati_circles").select("id").limit(1)
    if (error) {
      if (error.code === "42P01") setCloudStatus("الاتصال ناجح لكن الجداول غير موجودة — انسخ كود SQL وشغّله")
      else setCloudStatus("خطأ: " + error.message)
      setIsCloudConnected(false)
    } else { setCloudStatus("تم الاتصال بنجاح ✓ الجداول جاهزة"); setIsCloudConnected(true) }
  }
  const pushToCloud = async () => {
    const sb = getSupabase()
    if (!sb) { showToast("Supabase غير مُعد"); return }
    try {
      if (circles.length) await sb.from("halqati_circles").upsert(circles.map(c => ({ id: c.id, name: c.name })), { onConflict: "id" })
      if (staff.length) await sb.from("halqati_staff").upsert(staff.map(s => ({ id: s.id, name: s.name, phone: s.phone, role: s.role, circle_id: s.circleId })), { onConflict: "id" })
      if (students.length) await sb.from("halqati_students").upsert(students.map(s => ({
        id: s.id, name: s.name, phone: s.phone, circle_id: s.circleId, access_token: s.accessToken,
        memorization_log: s.memorizationLog, review_log: s.reviewLog, errors_log: s.errorsLog, notes: s.notes, visit_log: s.visitLog
      })), { onConflict: "id" })
      await sb.from("halqati_settings").upsert({ id: "academic_plan", data: plan, updated_at: new Date().toISOString() }, { onConflict: "id" })
      // Attendance -> halqati_attendance table + backup in settings
      if (attendance.length) {
        await sb.from("halqati_attendance").upsert(attendance.map(a=>({id:a.id, student_id:a.studentId, date:a.date, status:a.status, note:a.note||null, recorded_by:a.recordedBy})), {onConflict:"id"})
      }
      await sb.from("halqati_settings").upsert({ id: "attendance_backup", data: attendance, updated_at: new Date().toISOString() }, { onConflict: "id" })
      showToast(`تم الرفع: ${circles.length} حلقة • ${staff.length} كادر • ${students.length} طالب`)
      setIsCloudConnected(true)
    } catch (e: any) { showToast("خطأ في الرفع: " + (e.message || "")) }
  }
  const pullFromCloud = async () => {
    const sb = getSupabase()
    if (!sb) { showToast("Supabase غير مُعد"); return }
    try {
      const [cRes, sRes, stRes, pRes, attRes, attSetRes] = await Promise.all([
        sb.from("halqati_circles").select("*"),
        sb.from("halqati_staff").select("*"),
        sb.from("halqati_students").select("*"),
        sb.from("halqati_settings").select("data").eq("id", "academic_plan").maybeSingle(),
        sb.from("halqati_attendance").select("*"),
        sb.from("halqati_settings").select("data").eq("id", "attendance_backup").maybeSingle()
      ])
      if (cRes.error) throw cRes.error
      if (sRes.error) throw sRes.error
      if (stRes.error) throw stRes.error
      const newCircles: Circle[] = (cRes.data || []).map((x: any) => ({ id: x.id, name: x.name }))
      const newStaff: Staff[] = (sRes.data || []).map((x: any) => ({ id: x.id, name: x.name, phone: x.phone, role: x.role, circleId: x.circle_id }))
      const newStudents: Student[] = (stRes.data || []).map((x: any) => ({
        id: x.id, name: x.name, phone: x.phone || "", circleId: x.circle_id,
        accessToken: x.access_token, memorizationLog: x.memorization_log || [], reviewLog: x.review_log || [], errorsLog: x.errors_log || [], notes: x.notes || [], visitLog: x.visit_log || []
      }))
      setCircles(newCircles)
      setStaff(newStaff)
      setStudents(newStudents)
      if (pRes.data?.data) setPlan(pRes.data.data)
      // Attendance: prefer table, fallback to settings backup
      if (attRes.data && attRes.data.length) {
        setAttendance(attRes.data.map((x:any)=>({id:x.id, studentId:x.student_id, date:x.date, status:x.status as AttendanceStatus, note:x.note||"", recordedBy:x.recorded_by||"", createdAt:x.created_at||""})))
      } else if (attSetRes.data?.data && Array.isArray(attSetRes.data.data)) {
        setAttendance(attSetRes.data.data)
      }
      showToast(`تم السحب: ${newCircles.length} حلقة • ${newStaff.length} كادر • ${newStudents.length} طالب`)
      setIsCloudConnected(true)
    } catch (e: any) { showToast("خطأ في السحب: " + (e.message || "")) }
  }

  // Bootstrap owner
  const handleCreateOwner = () => {
    if (!ownerName.trim() || !ownerPhone.trim()) { setLoginError("الرجاء إدخال الاسم ورقم الجوال"); return }
    const id = uid()
    const owner: Staff = { id, name: ownerName.trim(), phone: ownerPhone.trim(), role: "owner", circleId: null }
    setStaff(prev => [...prev, owner])
    setCurrentUserId(id)
    setLoginError("")
    showToast("أهلاً بك يا " + owner.name + " — تم إنشاء حساب المالك")
  }

  const handleLogin = () => {
    setLoginError("")
    if (!loginPhone.trim()) { setLoginError("الرجاء إدخال رقم الجوال"); return }
    const phone = loginPhone.trim()
    if (loginTab === "management") {
      const found = staff.find(s => ["owner", "admin", "supervisor"].includes(s.role) && s.phone.trim() === phone)
      if (!found) { setLoginError("رقم الجوال غير مسجّل في الإدارة"); return }
      setCurrentUserId(found.id)
    } else {
      const found = staff.find(s => s.role === "teacher" && s.phone.trim() === phone)
      if (!found) { setLoginError("رقم الجوال غير مسجّل كمعلم، تواصل مع الإدارة"); return }
      setCurrentUserId(found.id)
    }
  }

  const loadDemo = () => {
    const c1: Circle = { id: uid(), name: "حلقة الإمام حفص" }
    const c2: Circle = { id: uid(), name: "حلقة ورش" }
    const c3: Circle = { id: uid(), name: "حلقة البيان" }
    const t1: Staff = { id: uid(), name: "أحمد المعلم", phone: "0501112223", role: "teacher", circleId: c1.id }
    const t2: Staff = { id: uid(), name: "خالد المشرف", phone: "0503334445", role: "supervisor", circleId: null }
    const owner: Staff[] = hasOwner ? [] as Staff[] : [{ id: uid(), name: "المالك التجريبي", phone: "0500000001", role: "owner" as const, circleId: null }]
    const sList: Student[] = Array.from({ length: 8 }).map((_, i) => {
      const names = ["عبدالله", "عبدالرحمن", "محمد", "يوسف", "إبراهيم", "سامي", "فيصل", "عمر"]
      return {
        id: uid(), name: names[i] + " الطالب", phone: "05" + (10000000 + i * 12345).toString().slice(-8),
        circleId: [c1.id, c2.id, c3.id][i % 3], accessToken: uid() + uid().slice(0, 4),
        memorizationLog: [
          { id: uid(), date: todayISO(), surahNumber: 2, surahName: "البقرة", fromAyah: 1, toAyah: 5, ayahCount: 5, grade: (["ممتاز", "جيد جدًا", "جيد"][i % 3] as Grade), teacherId: t1.id },
          { id: uid(), date: "2026-09-10", surahNumber: 1, surahName: "الفاتحة", fromAyah: 1, toAyah: 7, ayahCount: 7, grade: "ممتاز" as Grade, teacherId: t1.id },
        ],
        reviewLog: [
          { id: uid(), date: todayISO(), reviewType: "small" as const, surahNumber: 78, surahName: "النبأ", fromAyah: 1, toAyah: 40, ayahCount: 40, grade: "جيد جدًا" as Grade, teacherId: t1.id }
        ],
        errorsLog: i % 3 === 0 ? [{ id: uid(), date: todayISO(), type: "تردد" as ErrorType, description: "تردد في آيتين مع تصحيح" }] : [],
        notes: i % 2 === 0 ? [{ id: uid(), date: todayISO(), text: "متميز، استمر على الحفظ اليومي", authorId: t1.id }] : [],
        visitLog: [{ date: todayISO(), count: Math.floor(Math.random() * 3) }]
      }
    })
    setCircles([c1, c2, c3])
    if (owner.length) setStaff(prev => [...prev, ...owner, t1, t2])
    else setStaff(prev => [...prev, t1, t2])
    setStudents(sList)
    if (owner.length) setCurrentUserId(owner[0].id)
    showToast("تمت تعبئة بيانات تجريبية ✓")
  }

  // Filters
  const visibleStudents = useMemo(() => {
    let list = students
    if (currentUser?.role === "teacher" && currentUser.circleId) list = list.filter(s => s.circleId === currentUser.circleId)
    if (filterCircle !== "all") list = list.filter(s => s.circleId === filterCircle)
    if (search.trim()) {
      const q = search.trim()
      list = list.filter(s => s.name.includes(q) || s.phone.includes(q))
    }
    return list
  }, [students, search, filterCircle, currentUser])

  const stats = useMemo(() => {
    const total = visibleStudents.length
    const today = todayISO()
    const todayRecits = visibleStudents.filter(s => s.memorizationLog.some(m => m.date === today)).length
    const excellent = visibleStudents.filter(s => s.memorizationLog.some(m => m.grade === "ممتاز")).length
    const needFollow = visibleStudents.filter(s => s.errorsLog.length > 0 || s.memorizationLog.some(m => m.grade === "يحتاج إعادة")).length
    const visitedToday = visibleStudents.filter(s => s.visitLog.some(v => v.date === today)).length
    return { total, todayRecits, excellent, needFollow, visitedToday }
  }, [visibleStudents])

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId) || null, [students, selectedStudentId])

  // Actions
  const saveCircle = () => {
    if (!circleName.trim()) return
    if (editingCircleId) {
      setCircles(prev => prev.map(c => c.id === editingCircleId ? { ...c, name: circleName.trim() } : c))
      const sb = getSupabase(); if (sb) sb.from("halqati_circles").upsert({ id: editingCircleId, name: circleName.trim() }, { onConflict: "id" }).then()
    } else {
      const c: Circle = { id: uid(), name: circleName.trim() }
      setCircles(prev => [...prev, c])
      const sb = getSupabase(); if (sb) sb.from("halqati_circles").upsert({ id: c.id, name: c.name }, { onConflict: "id" }).then()
    }
    setShowCircleModal(false); setCircleName(""); setEditingCircleId(null); showToast("تم حفظ الحلقة")
  }
  const deleteCircle = (id: string) => {
    if (!confirm("حذف الحلقة؟ سيتم فصل الطلاب عنها")) return
    setCircles(prev => prev.filter(c => c.id !== id))
    setStudents(prev => prev.map(s => s.circleId === id ? { ...s, circleId: null } : s))
    const sb = getSupabase(); if (sb) sb.from("halqati_circles").delete().eq("id", id).then()
    showToast("تم الحذف")
  }

  const saveStaff = () => {
    if (!staffForm.name.trim() || !staffForm.phone.trim()) { showToast("أكمل الاسم والجوال"); return }
    if (staff.some(s => s.phone === staffForm.phone && s.id !== editingStaffId)) { showToast("رقم الجوال مسجل سابقاً"); return }
    if (editingStaffId) {
      setStaff(prev => prev.map(s => s.id === editingStaffId ? { ...s, name: staffForm.name.trim(), phone: staffForm.phone.trim(), role: staffForm.role, circleId: staffForm.circleId || null } : s))
      const sb = getSupabase(); if (sb) sb.from("halqati_staff").upsert({ id: editingStaffId, name: staffForm.name.trim(), phone: staffForm.phone.trim(), role: staffForm.role, circle_id: staffForm.circleId || null }, { onConflict: "id" }).then()
    } else {
      const m: Staff = { id: uid(), name: staffForm.name.trim(), phone: staffForm.phone.trim(), role: staffForm.role, circleId: staffForm.circleId || null }
      setStaff(prev => [...prev, m])
      const sb = getSupabase(); if (sb) sb.from("halqati_staff").upsert({ id: m.id, name: m.name, phone: m.phone, role: m.role, circle_id: m.circleId }, { onConflict: "id" }).then()
    }
    setShowStaffModal(false); setStaffForm({ name: "", phone: "", role: "teacher", circleId: "" }); setEditingStaffId(null); showToast("تم حفظ العضو")
  }
  const deleteStaff = (id: string) => {
    if (!confirm("حذف العضو؟")) return
    setStaff(prev => prev.filter(s => s.id !== id))
    const sb = getSupabase(); if (sb) sb.from("halqati_staff").delete().eq("id", id).then()
    showToast("تم الحذف")
  }

  const saveStudent = () => {
    if (!studentForm.name.trim()) { showToast("اسم الطالب مطلوب"); return }
    if (editingStudentId) {
      setStudents(prev => prev.map(s => s.id === editingStudentId ? { ...s, name: studentForm.name.trim(), phone: studentForm.phone.trim(), circleId: studentForm.circleId || null } : s))
      const sb = getSupabase(); if (sb) {
        const st = students.find(x => x.id === editingStudentId)!;
        sb.from("halqati_students").upsert({ id: st.id, name: studentForm.name.trim(), phone: studentForm.phone.trim(), circle_id: studentForm.circleId || null, access_token: st.accessToken, memorization_log: st.memorizationLog, review_log: st.reviewLog, errors_log: st.errorsLog, notes: st.notes, visit_log: st.visitLog }, { onConflict: "id" }).then()
      }
    } else {
      const st: Student = {
        id: uid(), name: studentForm.name.trim(), phone: studentForm.phone.trim(), circleId: studentForm.circleId || null, accessToken: uid() + uid().slice(0, 6),
        memorizationLog: [], reviewLog: [], errorsLog: [], notes: [], visitLog: []
      }
      setStudents(prev => [...prev, st])
      const sb = getSupabase(); if (sb) sb.from("halqati_students").upsert({ id: st.id, name: st.name, phone: st.phone, circle_id: st.circleId, access_token: st.accessToken, memorization_log: [], review_log: [], errors_log: [], notes: [], visit_log: [] }, { onConflict: "id" }).then()
    }
    setShowStudentModal(false); setStudentForm({ name: "", phone: "", circleId: "" }); setEditingStudentId(null); showToast("تم حفظ الطالب")
  }
  const deleteStudent = (id: string) => {
    if (!confirm("حذف الطالب وكل سجلاته؟")) return
    setStudents(prev => prev.filter(s => s.id !== id))
    const sb = getSupabase(); if (sb) sb.from("halqati_students").delete().eq("id", id).then()
    if (selectedStudentId === id) setSelectedStudentId(null)
    showToast("تم الحذف")
  }

  // ===== Attendance helpers =====
  const getAttendanceFor = (studentId:string, date:string) => attendance.find(a=>a.studentId===studentId && a.date===date)
  const setAttendanceStatus = (studentId:string, status:AttendanceStatus) => {
    const existing = attendance.find(a=>a.studentId===studentId && a.date===attendanceDate)
    if (existing) {
      setAttendance(prev=> prev.map(a=> a.id===existing.id ? {...a, status, note: attendanceNote[studentId]||a.note||"", recordedBy: currentUserId||"", createdAt: new Date().toISOString()} : a))
      const sb=getSupabase(); if(sb) sb.from("halqati_attendance").upsert({id: existing.id, student_id: studentId, date: attendanceDate, status, note: attendanceNote[studentId]||existing.note||null, recorded_by: currentUserId||""}, {onConflict:"id"}).then()
    } else {
      const rec: AttendanceRecord = {id: uid(), studentId, date: attendanceDate, status, note: attendanceNote[studentId]||"", recordedBy: currentUserId||"", createdAt: new Date().toISOString()}
      setAttendance(prev=> [...prev, rec])
      const sb=getSupabase(); if(sb) sb.from("halqati_attendance").insert({id: rec.id, student_id: rec.studentId, date: rec.date, status: rec.status, note: rec.note||null, recorded_by: rec.recordedBy}).then()
    }
  }
  const bulkAttendance = (status:AttendanceStatus) => {
    visibleStudents.forEach(s=> setAttendanceStatus(s.id, status))
    showToast(`تم تسجيل ${status} للجميع في ${fmtBoth(attendanceDate)}`)
  }
  const attendanceStatsForDate = (()=>{
    const list = attendance.filter(a=>a.date===attendanceDate)
    return {
      حاضر: list.filter(a=>a.status==="حاضر").length,
      غائب: list.filter(a=>a.status==="غائب").length,
      متأخر: list.filter(a=>a.status==="متأخر").length,
      "غائب بعذر": list.filter(a=>a.status==="غائب بعذر").length,
      total: list.length
    }
  })()
  const persistStudent = (updated: Student) => {
    setStudents(prev => prev.map(s => s.id === updated.id ? updated : s))
    const sb = getSupabase(); if (sb) sb.from("halqati_students").upsert({
      id: updated.id, name: updated.name, phone: updated.phone, circle_id: updated.circleId, access_token: updated.accessToken,
      memorization_log: updated.memorizationLog, review_log: updated.reviewLog, errors_log: updated.errorsLog, notes: updated.notes, visit_log: updated.visitLog
    }, { onConflict: "id" }).then()
  }

  const handleAddMemorization = () => {
    if (!selectedStudent) return
    const surah = SURAHS.find(s => s.number === memForm.surahNumber)!
    if (memForm.fromAyah < 1 || memForm.toAyah > surah.ayahCount || memForm.fromAyah > memForm.toAyah) { showToast("تحقق من رقم الآيات"); return }
    const entry: MemorizationEntry = {
      id: uid(), date: memForm.date, surahNumber: surah.number, surahName: surah.name,
      fromAyah: memForm.fromAyah, toAyah: memForm.toAyah, ayahCount: memForm.toAyah - memForm.fromAyah + 1,
      grade: memForm.grade, teacherId: currentUserId || "", notes: memForm.notes
    }
    const updated = { ...selectedStudent, memorizationLog: [entry, ...selectedStudent.memorizationLog] }
    persistStudent(updated)
    setShowMemModal(false); showToast("تم تسجيل الحفظ ✓")
  }
  const handleAddReview = () => {
    if (!selectedStudent || !showReviewModal) return
    const surah = SURAHS.find(s => s.number === reviewForm.surahNumber)!
    if (reviewForm.fromAyah < 1 || reviewForm.toAyah > surah.ayahCount || reviewForm.fromAyah > reviewForm.toAyah) { showToast("تحقق من الآيات"); return }
    const entry: ReviewEntry = {
      id: uid(), date: reviewForm.date, reviewType: showReviewModal,
      surahNumber: surah.number, surahName: surah.name, fromAyah: reviewForm.fromAyah, toAyah: reviewForm.toAyah,
      ayahCount: reviewForm.toAyah - reviewForm.fromAyah + 1, grade: reviewForm.grade, teacherId: currentUserId || ""
    }
    const updated = { ...selectedStudent, reviewLog: [entry, ...selectedStudent.reviewLog] }
    persistStudent(updated)
    setShowReviewModal(null); showToast("تم تسجيل المراجعة ✓")
  }
  const handleAddError = () => {
    if (!selectedStudent) return
    if (!errorForm.description.trim()) { showToast("اكتب وصف الخطأ"); return }
    const entry: ErrorEntry = { id: uid(), date: errorForm.date, type: errorForm.type, description: errorForm.description.trim() }
    const updated = { ...selectedStudent, errorsLog: [entry, ...selectedStudent.errorsLog] }
    persistStudent(updated)
    setShowErrorModal(false); setErrorForm({ type: "خطأ في الحفظ", description: "", date: todayISO() }); showToast("تم تسجيل الخطأ")
  }
  const handleAddNote = () => {
    if (!selectedStudent) return
    if (!noteText.trim()) { showToast("اكتب الملاحظة"); return }
    const entry: NoteEntry = { id: uid(), date: todayISO(), text: noteText.trim(), authorId: currentUserId || "" }
    const updated = { ...selectedStudent, notes: [entry, ...selectedStudent.notes] }
    persistStudent(updated)
    setShowNoteModal(false); setNoteText(""); showToast("تمت إضافة الملاحظة")
  }

  // ============ UI ============
  // === اعتراض رابط ولي الأمر عالمياً — حتى لو كان المعلم مسجلاً، ?t= يعرض فقط عرضاً مقفلاً بدون أي صلاحيات ===
  {
    const _gParams = new URLSearchParams(window.location.search)
    const _gToken = _gParams.get("t")
    let _gStudent: Student | null = null
    if (_gToken) {
      _gStudent = students.find(x => x.accessToken === _gToken) || null
      if (!_gStudent) {
        try {
          const _raw: any[] = JSON.parse(localStorage.getItem("halqati_students") || "[]")
          _gStudent = (_raw.find((x: any) => x.accessToken === _gToken) as unknown as Student) || null
        } catch {}
      }
    }
    if (_gToken && _gStudent) {
      return (
        <div className="min-h-screen flex flex-col" style={{ background: "#FAF9F4" }}>
          <ParentTokenView student={_gStudent} circles={circles} staff={staff} attendance={attendance} plan={plan} />
          <Footer />
          {toast && <Toast msg={toast} />}
        </div>
      )
    }
    if (_gToken && !_gStudent) {
      // حاول جلب من Supabase مرة واحدة إذا لم يوجد محلياً (اختياري سريع)
      return (
        <div className="min-h-screen flex flex-col" style={{ background: "#FAF9F4" }}>
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
            <div className="bg-white rounded-2xl border border-amber-200 p-6 text-center max-w-sm shadow-sm">
              <p className="text-2xl mb-2">🔗</p>
              <p className="font-bold text-sm" style={{color:"#163F27"}}>رابط المتابعة غير صالح أو منتهي</p>
              <p className="text-xs text-gray-500 mt-1 leading-5">تأكد من نسخ الرابط كاملاً من المعلم أو تواصل معه للحصول على رابط جديد.</p>
              <p className="text-[11px] text-gray-400 mt-3">هذا الرابط مخصص لولي الأمر — للاستفسار تواصل مع المعلم على واتساب</p>
            </div>
          </div>
          <Footer />
        </div>
      )
    }
  }
  if (!currentUser) {
    // === مسار ولي الأمر عبر ?t= — عرض مباشر بدون تسجيل (حذف نهائي لعناصر الكرت الأبيض من هذا المسار أيضاً) ===
    const _parentParams = new URLSearchParams(window.location.search)
    const _parentToken = _parentParams.get("t")
    let _parentStudent: Student | null = null
    if (_parentToken) {
      _parentStudent = students.find(x => x.accessToken === _parentToken) || null
      if (!_parentStudent) {
        try {
          const _raw: any[] = JSON.parse(localStorage.getItem("halqati_students") || "[]")
          _parentStudent = _raw.find((x: any) => x.accessToken === _parentToken) as Student || null
        } catch {}
      }
    }
    if (_parentToken && _parentStudent) {
      return (
        <div className="min-h-screen flex flex-col" style={{ background: "#FAF9F4" }}>
          <ParentTokenView student={_parentStudent} circles={circles} staff={staff} attendance={attendance} plan={plan} />
          <Footer />
          {toast && <Toast msg={toast} />}
        </div>
      )
    }
    if (_parentToken && !_parentStudent) {
      return (
        <div className="min-h-screen flex flex-col" style={{ background: "#FAF9F4" }}>
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
            <div className="bg-white rounded-2xl border border-amber-200 p-6 text-center max-w-sm shadow-sm">
              <p className="text-2xl mb-2">🔗</p>
              <p className="font-bold text-sm" style={{color:"#163F27"}}>رابط المتابعة غير صالح أو منتهي</p>
              <p className="text-xs text-gray-500 mt-1 leading-5">تأكد من نسخ الرابط كاملاً من المعلم أو تواصل معه للحصول على رابط جديد.</p>
              <p className="text-[11px] text-gray-400 mt-3">هذا الرابط مخصص لولي الأمر — للاستفسار تواصل مع المعلم على واتساب</p>
            </div>
          </div>
          <Footer />
        </div>
      )
    }
    // تسجيل الدخول العادي — الكرت الأبيض بدون أزرار/نصوص محذوفة
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#FAF9F4" }}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
          <div className="w-full max-w-sm">
            {/* Supabase status pill - فقط للمالك في مرحلة التأسيس */}
            {!hasOwner && (
            <div className="flex justify-center mb-4">
              <button onClick={() => setSupabaseModal(true)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition ${isCloudConnected ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                <span className={`w-2 h-2 rounded-full ${isCloudConnected ? "bg-emerald-500" : "bg-amber-500"} animate-pulse`} />
                {isCloudConnected ? "Supabase متصل" : "ربط Supabase"}
              </button>
            </div>
            )}

            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-sm" style={{ background: "#E7EFE7" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M5 19c0-7 4-13 13-15C17.5 13 13 17.5 5 19Z" stroke="#1F5E3A" strokeWidth="1.6" strokeLinejoin="round" /><path d="M6.5 17.2C9 12.5 12.2 9 17.3 6" stroke="#1F5E3A" strokeWidth="1.3" strokeLinecap="round" /></svg>
              </div>
              <h1 className="text-2xl font-black tracking-tight" style={{ color: "#163F27" }}>حلقتي</h1>
              <p className="text-[13px] mt-1 text-center" style={{ color: "#5B6459" }}>نظام إدارة ومتابعة حلقات القرآن الكريم</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-[#E1E5DA] overflow-hidden">
              <div className="flex p-1.5 bg-[#FAF9F4] gap-1.5">
                <button onClick={() => setLoginTab("management")} className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${loginTab === "management" ? "bg-white shadow-sm text-[#1F5E3A] border border-[#E1E5DA]" : "text-[#5B6459] hover:bg-white/60"}`}>الإدارة</button>
                <button onClick={() => setLoginTab("teacher")} className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${loginTab === "teacher" ? "bg-white shadow-sm text-[#1F5E3A] border border-[#E1E5DA]" : "text-[#5B6459] hover:bg-white/60"}`}>المعلم</button>
              </div>

              <div className="p-6">
                {!hasOwner ? (
                  <div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-amber-800 text-xs leading-5">
                      👋 <b>أهلاً بك في نظام حلقتي!</b><br />لم يتم تسجيل مالك للنظام بعد. أدخل اسمك ورقم جوالك للبدء كمالك رئيسي.
                    </div>
                    <label className="text-xs font-bold text-gray-700">اسم المالك الرئيسي</label>
                    <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="مثال: أحمد المالكي" className="w-full mt-1 mb-3 px-3 py-2.5 rounded-xl border border-[#E1E5DA] text-sm focus:outline-none focus:ring-2 focus:ring-[#1F5E3A]" />
                    <label className="text-xs font-bold text-gray-700">رقم الجوال</label>
                    <input value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} placeholder="05XXXXXXXX" className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[#E1E5DA] text-sm focus:outline-none focus:ring-2 focus:ring-[#1F5E3A]" dir="ltr" />
                    {loginError && <p className="text-xs text-red-600 mt-2">{loginError}</p>}
                    <button onClick={handleCreateOwner} className="w-full mt-4 py-2.5 rounded-xl bg-[#1F5E3A] hover:bg-[#163F27] text-white font-bold text-sm transition">إنشاء حساب المالك والدخول</button>
                    
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-[#5B6459] mb-3 leading-5">
                      {loginTab === "management" ? "دخول الإدارة والمشرفين برقم الجوال المسجل" : "دخول المعلم برقم الجوال المسجل في حلقته"}
                    </p>
                    <input value={loginPhone} onChange={e => setLoginPhone(e.target.value)} placeholder="05XXXXXXXX" className="w-full px-3 py-2.5 rounded-xl border border-[#E1E5DA] text-sm focus:outline-none focus:ring-2 focus:ring-[#1F5E3A]" dir="ltr" />
                    {loginError && <p className="text-xs text-red-600 mt-2">{loginError}</p>}
                    <button onClick={handleLogin} className="w-full mt-4 py-2.5 rounded-xl bg-[#1F5E3A] hover:bg-[#163F27] text-white font-bold text-sm transition">دخول النظام</button>
                    
                    {false && <button onClick={() => setSupabaseModal(true)} className="w-full mt-2 py-2 rounded-xl bg-white border border-[#E1E5DA] text-[#1F5E3A] font-bold text-xs hover:bg-gray-50 transition">⚙️ إعداد وحفظ مفاتيح Supabase</button>}
                    
                  </div>
                )}
              </div>
            </div>

            
          </div>
        </div>

        <Footer />

        {supabaseModal && !hasOwner && (
          <SupabaseModal
            url={supabaseUrlInput} setUrl={setSupabaseUrlInput}
            keyVal={supabaseKeyInput} setKey={setSupabaseKeyInput}
            onClose={() => setSupabaseModal(false)}
            onSave={() => { saveSupabaseConfig(supabaseUrlInput, supabaseKeyInput); showToast("تم حفظ مفاتيح Supabase"); setSupabaseModal(false); testCloud() }}
            onClear={() => { saveSupabaseConfig("", ""); setSupabaseUrlInput(""); setSupabaseKeyInput(""); setIsCloudConnected(null); setCloudStatus(null); showToast("تم فصل الربط") }}
            status={cloudStatus} isConnected={isCloudConnected}
            onTest={testCloud} onPush={pushToCloud} onPull={pullFromCloud}
          />
        )}

        {toast && <Toast msg={toast} />}
      </div>
    )
  }

  // ============= LOGGED IN VIEW =============
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FAF9F4" }}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#E1E5DA]">
        <div className="max-w-[1100px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#E7EFE7" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 19c0-7 4-13 13-15C17.5 13 13 17.5 5 19Z" stroke="#1F5E3A" strokeWidth="1.5" strokeLinejoin="round" /><path d="M6.5 17.2C9 12.5 12.2 9 17.3 6" stroke="#1F5E3A" strokeWidth="1.2" strokeLinecap="round" /></svg>
            </div>
            <div>
              <h2 className="font-black text-[15px]" style={{ color: "#163F27" }}>حلقتي</h2>
              <p className="text-[11px]" style={{ color: "#5B6459" }}>{currentUser.name} • {ROLE_LABEL[currentUser.role]} {currentUser.circleId ? "• " + (circles.find(c => c.id === currentUser.circleId)?.name || "") : ""}</p>
            </div>
            {isOwner && <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${isCloudConnected ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isCloudConnected ? "bg-emerald-500" : "bg-amber-500"}`} /> {isCloudConnected ? "Supabase متصل" : "محلي"}
            </span>}
          </div>
          <div className="flex items-center gap-2">
            {currentUser?.role !== "supervisor" && <button onClick={() => setPlanModal(true)} className="hidden sm:inline-flex px-3 py-1.5 rounded-full bg-[#E7EFE7] hover:bg-[#d8ead8] text-[#1F5E3A] text-xs font-bold border border-[#E1E5DA] transition">📅 الخطة السنوية</button>}
            {isOwner && <button onClick={() => setSupabaseModal(true)} className="px-3 py-1.5 rounded-full bg-white border border-[#E1E5DA] text-xs font-bold text-[#1F5E3A] hover:bg-gray-50">⚙️ Supabase</button>}
            <button onClick={() => { setCurrentUserId(null); showToast("تم تسجيل الخروج") }} className="px-3 py-1.5 rounded-full bg-[#B3492C] hover:bg-[#963d25] text-white text-xs font-bold">خروج</button>
          </div>
        </div>
      </header>

      {currentUser.role === "supervisor" ? (
        /* ===== Supervisor dedicated attendance view - بسيطة ومخصصة للتحضير فقط ===== */
        <main className="flex-1 max-w-[900px] w-full mx-auto px-4 py-6">
          {/* Welcome Card */}
          <div className="bg-white rounded-2xl border border-[#E1E5DA] p-5 mb-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-lg flex items-center gap-2" style={{color:"#163F27"}}>📋 تحضير الحلقة</h2>
                <p className="text-[11px] text-gray-400 mt-1">{fmtBoth(attendanceDate)}</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="date" value={attendanceDate} onChange={e=>setAttendanceDate(e.target.value)} className="px-4 py-2.5 rounded-xl border border-[#E1E5DA] text-sm bg-white shadow-sm focus:ring-2 focus:ring-[#1F5E3A] outline-none" />
              </div>
            </div>
            {circles.length > 1 && (
              <div className="mt-4 pt-4 border-t">
                <label className="text-xs font-bold text-gray-700 mb-1 block">اختر الحلقة</label>
                <select value={supervisorCircle} onChange={e=>setSupervisorCircle(e.target.value)} className="w-full md:w-[360px] px-4 py-2.5 rounded-xl border border-[#E1E5DA] text-sm bg-white">
                  <option value="all">كل الحلقات ({students.length} طالب)</option>
                  {circles.map(c=> {
                    const cnt = students.filter(s=>s.circleId===c.id).length
                    return <option key={c.id} value={c.id}>{c.name} ({cnt} طلاب)</option>
                  })}
                </select>
              </div>
            )}
            {circles.length === 1 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-bold" style={{color:"#1F5E3A"}}>الحلقة: {circles[0].name} • {students.filter(s=>s.circleId===circles[0].id).length} طلاب</p>
              </div>
            )}
            {circles.length === 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">⚠️ لا توجد حلقات مسجلة بعد — تواصل مع الإدارة</p>
              </div>
            )}
          </div>

          {/* Summary — مصغر أفقي لتوفير المساحة */}
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {ATTENDANCE_STATUS.map(st=> (
              <div key={st} className="bg-white rounded-xl p-2 md:p-2.5 border shadow-sm text-center">
                <p className="text-[10px] font-bold text-gray-500 leading-none">{st}</p>
                <p className="font-black text-lg md:text-xl leading-none mt-1" style={{color:ATTENDANCE_COLOR[st]}}>{(supervisorStats as any)[st]}</p>
                <p className="text-[9px] text-gray-400 leading-none mt-0.5">طالب</p>
              </div>
            ))}
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-800">الإجمالي المسجل: {supervisorStats.total} / {supervisorStudents.length}</span>
            <span className="text-emerald-700 font-bold">{supervisorStats.total===supervisorStudents.length && supervisorStudents.length>0 ? "✓ مكتمل" : `متبقي ${supervisorStudents.length - supervisorStats.total}`}</span>
          </div>

          {/* Quick bulk */}
          <div className="flex gap-2 mb-4 flex-wrap items-center bg-white rounded-xl p-3 border shadow-sm">
            <span className="text-xs font-bold text-gray-600">تسجيل سريع:</span>
            {ATTENDANCE_STATUS.map(st=> (
              <button key={st} onClick={()=> { supervisorStudents.forEach(s=> setAttendanceStatus(s.id, st)); showToast(`تم تسجيل ${st} للجميع`)}} className="px-4 py-2 rounded-full text-xs font-bold text-white shadow-sm hover:opacity-90 transition" style={{background:ATTENDANCE_COLOR[st]}}>{st} للجميع</button>
            ))}
          </div>

          {/* Students List */}
          <div className="bg-white rounded-2xl border border-[#E1E5DA] shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-[#FAF9F4]/60 flex items-center justify-between">
              <h3 className="font-bold text-sm" style={{color:"#163F27"}}>قائمة الطلاب ({supervisorStudents.length})</h3>
              <span className="text-[11px] text-gray-500">اضغط على الحالة لتعديلها</span>
            </div>
            <div className="p-3 space-y-2 max-h-[520px] overflow-auto">
              {supervisorStudents.length===0 ? (
                <div className="text-center py-12">
                  <p className="text-3xl mb-2">👥</p>
                  <p className="text-sm text-gray-400">لا يوجد طلاب في هذه الحلقة</p>
                </div>
              ) : supervisorStudents.map(s=>{
                  const rec = getAttendanceFor(s.id, attendanceDate)
                  const circleName2 = circles.find(c=>c.id===s.circleId)?.name || "بدون حلقة"
                  return (
                    <div key={s.id} className="flex flex-col gap-2 p-3 rounded-2xl border hover:bg-[#FAF9F4]/60 transition bg-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0" style={{background: rec ? ATTENDANCE_COLOR[rec.status] : "#E7EFE7", color: rec ? "white":"#1F5E3A"}}>{s.name.trim().charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[13px] truncate" style={{color:"#20281F"}}>{s.name} <span className="text-[11px] text-gray-400 font-normal">• {circleName2}</span></p>
                          {rec && <p className="text-[11px] text-gray-500">الحالة الحالية: <span className="font-bold" style={{color:ATTENDANCE_COLOR[rec.status]}}>{rec.status}</span></p>}
                        </div>
                        {rec ? <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${ATTENDANCE_BG[rec.status]}`}>{rec.status}</span> : <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border bg-gray-50 text-gray-500 shrink-0">لم يُحضّر</span>}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {ATTENDANCE_STATUS.map(st=> (
                          <button key={st} onClick={()=> setAttendanceStatus(s.id, st)} className={`py-2 rounded-xl text-[11px] font-bold border transition ${rec?.status===st ? "text-white shadow-sm" : "bg-white hover:bg-gray-50 text-gray-700"}`} style={rec?.status===st ? {background: ATTENDANCE_COLOR[st], borderColor: ATTENDANCE_COLOR[st]} : {}}>{st}</button>
                        ))}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
          <p className="text-center text-[11px] text-gray-400 mt-4">💡 التحضير يُحفظ تلقائياً • يمكنك تعديل أي حالة في أي وقت بالضغط عليها • التاريخ: {fmtBoth(attendanceDate)}</p>
        </main>
      ) : (
      <main className="flex-1 max-w-[1100px] w-full mx-auto px-4 py-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <StatCard label="إجمالي الطلاب" value={stats.total} sub="طالب" />
          <StatCard label="تسميعات اليوم" value={stats.todayRecits} sub="طالب" accent="emerald" />
          <StatCard label="حصلوا على ممتاز" value={stats.excellent} sub="طالب" accent="gold" />
          <StatCard label="يحتاجون متابعة" value={stats.needFollow} sub="طالب" accent="red" highlight={stats.needFollow > 0} />
          <StatCard label="زاروا الرابط اليوم" value={stats.visitedToday} sub="زيارة" accent="blue" />
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-[#E1E5DA] p-3 mb-5 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
            <div className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الجوال..." className="w-full pr-9 pl-3 py-2 rounded-xl border border-[#E1E5DA] text-sm focus:outline-none focus:ring-2 focus:ring-[#1F5E3A]" />
                <span className="absolute right-3 top-2.5 text-gray-400">🔍</span>
              </div>
              <select value={filterCircle} onChange={e => setFilterCircle(e.target.value)} className="px-3 py-2 rounded-xl border border-[#E1E5DA] text-sm bg-white min-w-[160px]">
                <option value="all">كل الحلقات</option>
                {circles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="">بدون حلقة</option>
              </select>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setPlanModal(true)} className="lg:hidden px-3 py-2 rounded-xl bg-[#E7EFE7] text-[#1F5E3A] text-xs font-bold border">📅 الخطة</button>
              <button onClick={() => { setStudentForm({ name: "", phone: "", circleId: filterCircle !== "all" ? filterCircle : "" }); setEditingStudentId(null); setShowStudentModal(true) }} className="px-4 py-2 rounded-xl bg-[#1F5E3A] hover:bg-[#163F27] text-white text-xs font-bold">+ إضافة طالب</button>
            </div>
          </div>
        </div>

        {/* Management tabs */}
        {isOwnerOrAdmin && (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Circles */}
            <div className="bg-white rounded-2xl border border-[#E1E5DA] shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E1E5DA] flex items-center justify-between bg-[#FAF9F4]/60">
                <h3 className="font-bold text-sm" style={{ color: "#163F27" }}>الحلقات ({circles.length})</h3>
                <button onClick={() => { setCircleName(""); setEditingCircleId(null); setShowCircleModal(true) }} className="px-3 py-1.5 rounded-full bg-[#1F5E3A] text-white text-xs font-bold">+ حلقة</button>
              </div>
              <div className="p-3 space-y-2 max-h-[220px] overflow-auto">
                {circles.length === 0 ? <p className="text-xs text-gray-400 text-center py-6">لا يوجد حلقات بعد</p> :
                  circles.map(c => {
                    const count = students.filter(s => s.circleId === c.id).length
                    return (
                      <div key={c.id} className="flex items-center justify-between p-2.5 rounded-xl border border-[#E1E5DA] hover:bg-[#FAF9F4] transition">
                        <div>
                          <p className="font-bold text-sm" style={{ color: "#20281F" }}>{c.name}</p>
                          <p className="text-[11px] text-gray-500">{count} طلاب</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingCircleId(c.id); setCircleName(c.name); setShowCircleModal(true) }} className="px-2.5 py-1 rounded-full bg-white border text-xs">تعديل</button>
                          <button onClick={() => deleteCircle(c.id)} className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-xs text-red-700">حذف</button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Staff */}
            <div className="bg-white rounded-2xl border border-[#E1E5DA] shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E1E5DA] flex items-center justify-between bg-[#FAF9F4]/60">
                <h3 className="font-bold text-sm" style={{ color: "#163F27" }}>الكادر ({staff.length})</h3>
                <button onClick={() => { setStaffForm({ name: "", phone: "", role: "teacher", circleId: "" }); setEditingStaffId(null); setShowStaffModal(true) }} className="px-3 py-1.5 rounded-full bg-[#C9A227] text-white text-xs font-bold">+ عضو</button>
              </div>
              <div className="p-3 space-y-2 max-h-[220px] overflow-auto">
                {staff.length === 0 ? <p className="text-xs text-gray-400 text-center py-6">لا يوجد كادر</p> :
                  staff.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl border border-[#E1E5DA] hover:bg-[#FAF9F4] transition">
                      <div>
                        <p className="font-bold text-sm flex items-center gap-2">{m.name} <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E7EFE7] text-[#1F5E3A] border">{ROLE_LABEL[m.role]}</span></p>
                        <p className="text-[11px] text-gray-500" dir="ltr">{m.phone} {m.circleId ? "• " + (circles.find(c => c.id === m.circleId)?.name || "") : ""}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingStaffId(m.id); setStaffForm({ name: m.name, phone: m.phone, role: m.role, circleId: m.circleId || "" }); setShowStaffModal(true) }} className="px-2.5 py-1 rounded-full bg-white border text-xs">تعديل</button>
                        <button onClick={() => deleteStaff(m.id)} disabled={m.role === "owner" && staff.filter(s => s.role === "owner").length === 1} className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-xs text-red-700 disabled:opacity-40">حذف</button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Attendance System - فقط للمالك/المدير/المشرف */}
        {canRecordAttendance && (
          <div className="bg-white rounded-2xl border border-[#E1E5DA] shadow-sm overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-[#E1E5DA] bg-[#FAF9F4]/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-sm flex items-center gap-2" style={{color:"#163F27"}}>📋 نظام التحضير اليومي <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">{fmtBoth(attendanceDate)}</span></h3>
                <p className="text-[11px] text-gray-500 mt-0.5">تسجيل حضور وغياب الطلاب — يظهر فقط للمالك والمدير والمشرف</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="date" value={attendanceDate} onChange={e=>setAttendanceDate(e.target.value)} className="px-3 py-1.5 rounded-xl border border-[#E1E5DA] text-sm bg-white" />
                <select value={filterCircle} onChange={e=>setFilterCircle(e.target.value)} className="px-3 py-1.5 rounded-xl border border-[#E1E5DA] text-sm bg-white">
                  <option value="all">كل الحلقات</option>
                  {circles.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="">بدون حلقة</option>
                </select>
              </div>
            </div>
            {/* Stats — مصغر أفقي */}
            <div className="grid grid-cols-5 gap-1.5 p-2 bg-gray-50/50 border-b">
              <div className="bg-white rounded-xl p-2 border text-center"><p className="text-[10px] text-gray-500 font-bold leading-none">حاضر</p><p className="font-black text-base md:text-lg leading-none mt-1" style={{color:ATTENDANCE_COLOR["حاضر"]}}>{attendanceStatsForDate["حاضر"]}</p><p className="text-[9px] text-gray-400 leading-none mt-0.5">طالب</p></div>
              <div className="bg-white rounded-xl p-2 border text-center"><p className="text-[10px] text-gray-500 font-bold leading-none">غائب</p><p className="font-black text-base md:text-lg leading-none mt-1" style={{color:ATTENDANCE_COLOR["غائب"]}}>{attendanceStatsForDate["غائب"]}</p><p className="text-[9px] text-gray-400 leading-none mt-0.5">طالب</p></div>
              <div className="bg-white rounded-xl p-2 border text-center"><p className="text-[10px] text-gray-500 font-bold leading-none">متأخر</p><p className="font-black text-base md:text-lg leading-none mt-1" style={{color:ATTENDANCE_COLOR["متأخر"]}}>{attendanceStatsForDate["متأخر"]}</p><p className="text-[9px] text-gray-400 leading-none mt-0.5">طالب</p></div>
              <div className="bg-white rounded-xl p-2 border text-center"><p className="text-[10px] text-gray-500 font-bold leading-none">غائب بعذر</p><p className="font-black text-base md:text-lg leading-none mt-1" style={{color:ATTENDANCE_COLOR["غائب بعذر"]}}>{attendanceStatsForDate["غائب بعذر"]}</p><p className="text-[9px] text-gray-400 leading-none mt-0.5">طالب</p></div>
              <div className="bg-white rounded-xl p-2 border text-center"><p className="text-[10px] text-gray-500 font-bold leading-none">الإجمالي</p><p className="font-black text-base md:text-lg leading-none mt-1" style={{color:"#163F27"}}>{attendanceStatsForDate.total}/{visibleStudents.length}</p><p className="text-[9px] text-gray-400 leading-none mt-0.5">طالب</p></div>
            </div>
            {/* Bulk */}
            <div className="flex gap-2 p-3 border-b bg-white flex-wrap">
              <span className="text-xs font-bold text-gray-600 py-1.5">تسجيل جماعي:</span>
              {ATTENDANCE_STATUS.map(st=> (
                <button key={st} onClick={()=> bulkAttendance(st)} className="px-3 py-1.5 rounded-full text-xs font-bold border hover:opacity-90 transition" style={{background: ATTENDANCE_COLOR[st], color:"white"}}>{st} للجميع</button>
              ))}
              <button onClick={()=>{ if(confirm("حذف تحضير هذا اليوم؟")){ setAttendance(prev=> prev.filter(a=> a.date!==attendanceDate)); const sb=getSupabase(); if(sb) sb.from("halqati_attendance").delete().eq("date", attendanceDate).then(); showToast("تم حذف تحضير "+fmtBoth(attendanceDate)) } }} className="mr-auto px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold">🗑️ حذف تحضير اليوم</button>
            </div>
            {/* List */}
            <div className="p-3 space-y-2 max-h-[420px] overflow-auto">
              {visibleStudents.length===0 ? <p className="text-xs text-gray-400 text-center py-8">لا يوجد طلاب للتحضير</p> :
                visibleStudents.map(s=>{
                  const rec = getAttendanceFor(s.id, attendanceDate)
                  const circleName = circles.find(c=>c.id===s.circleId)?.name || "بدون حلقة"
                  return (
                    <div key={s.id} className="flex flex-col md:flex-row md:items-center gap-2 p-3 rounded-2xl border hover:bg-[#FAF9F4]/60 transition bg-white">
                      <div className="flex items-center gap-2.5 flex-1">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm" style={{background: rec ? ATTENDANCE_COLOR[rec.status] : "#E7EFE7", color: rec ? "white":"#1F5E3A"}}>{s.name.charAt(0)}</div>
                        <div className="flex-1">
                          <p className="font-bold text-[13px]" style={{color:"#20281F"}}>{s.name} <span className="text-[11px] text-gray-400 font-normal">• {circleName}</span></p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {ATTENDANCE_STATUS.map(st=> (
                              <button key={st} onClick={()=> setAttendanceStatus(s.id, st)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${rec?.status===st ? "text-white shadow-sm" : "bg-white hover:bg-gray-50"}`} style={rec?.status===st ? {background: ATTENDANCE_COLOR[st], borderColor: ATTENDANCE_COLOR[st]} : {}}>{st}</button>
                            ))}
                          </div>
                          {rec && <p className="text-[11px] text-gray-500 mt-1">تم بواسطة: {staff.find(x=>x.id===rec.recordedBy)?.name || "—"} • {rec.note ? `ملاحظة: ${rec.note}` : ""}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <input placeholder="ملاحظة (اختياري)" value={attendanceNote[s.id] ?? rec?.note ?? ""} onChange={e=> setAttendanceNote(prev=> ({...prev, [s.id]: e.target.value}))} onBlur={()=>{ if(rec) setAttendanceStatus(s.id, rec.status)}} className="flex-1 md:w-[160px] px-2.5 py-1.5 rounded-xl border border-[#E1E5DA] text-xs bg-white" />
                        {rec ? <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${ATTENDANCE_BG[rec.status]}`}>{rec.status}</span> : <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border bg-gray-50 text-gray-500">لم يُحضّر</span>}
                      </div>
                    </div>
                  )
                })
              }
            </div>
            <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-[11px] text-amber-800 text-center">💡 التحضير يُحفظ تلقائياً في المتصفح و Supabase (إذا كان الربط مفعّلاً من قبل المالك) • التاريخ: {fmtBoth(attendanceDate)}</div>
          </div>
        )}

        {/* Students Grid */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold" style={{ color: "#163F27" }}>الطلاب ({visibleStudents.length})</h3>
          <span className="text-[11px] text-gray-500">اضغط على البطاقة لفتح التفاصيل</span>
        </div>

        {visibleStudents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#E1E5DA] p-10 text-center">
            <p className="text-3xl mb-2">📖</p>
            <p className="font-bold text-sm" style={{ color: "#5B6459" }}>لا يوجد طلاب مطابقون للبحث</p>
            <p className="text-xs text-gray-400 mt-1">أضف طالباً جديداً أو غيّر الفلتر</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleStudents.map(s => {
              const circleName2 = circles.find(c => c.id === s.circleId)?.name || "بدون حلقة"
              const lastGrade = s.memorizationLog[0]?.grade
              const totalAyahs = s.memorizationLog.reduce((a, b) => a + b.ayahCount, 0)
              return (
                <div key={s.id} onClick={() => setSelectedStudentId(s.id)} className="bg-white rounded-2xl border border-[#E1E5DA] p-4 shadow-sm hover:shadow-md hover:border-[#1F5E3A]/20 cursor-pointer transition group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white" style={{ background: GRADE_COLOR[lastGrade as Grade] || "#E7EFE7", color: lastGrade ? "#fff" : "#1F5E3A" }}>
                        {s.name.trim().charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-[13px]" style={{ color: "#20281F" }}>{s.name}</p>
                        <p className="text-[11px] text-gray-500">{circleName2} • {s.phone || "—"}</p>
                      </div>
                    </div>
                    {lastGrade && <span className="text-[10px] font-bold px-2 py-1 rounded-full text-white" style={{ background: GRADE_COLOR[lastGrade] }}>{lastGrade}</span>}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-[#FAF9F4] rounded-xl py-2 border"><p className="font-black text-sm" style={{ color: "#1F5E3A" }}>{s.memorizationLog.length}</p><p className="text-[10px] text-gray-500">حفظ</p></div>
                    <div className="bg-[#FAF9F4] rounded-xl py-2 border"><p className="font-black text-sm" style={{ color: "#C9A227" }}>{s.reviewLog.length}</p><p className="text-[10px] text-gray-500">مراجعة</p></div>
                    <div className="bg-[#FAF9F4] rounded-xl py-2 border"><p className="font-black text-sm" style={{ color: "#B3492C" }}>{s.errorsLog.length}</p><p className="text-[10px] text-gray-500">أخطاء</p></div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 mb-3">
                    <span>آيات محفوظة: <b style={{ color: "#1F5E3A" }}>{totalAyahs}</b></span>
                    <span>الحفظ القادم: {s.memorizationLog[0] ? `${s.memorizationLog[0].surahName} ${s.memorizationLog[0].toAyah + 1}` : "—"}</span>
                  </div>

                  <div className="flex gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedStudentId(s.id) }} className="flex-1 py-1.5 rounded-xl bg-[#1F5E3A] text-white text-xs font-bold group-hover:bg-[#163F27] transition">عرض التفاصيل</button>
                    <button onClick={(e) => { e.stopPropagation(); setEditingStudentId(s.id); setStudentForm({ name: s.name, phone: s.phone, circleId: s.circleId || "" }); setShowStudentModal(true) }} className="px-3 py-1.5 rounded-xl bg-white border text-xs">تعديل</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteStudent(s.id) }} className="px-2 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">حذف</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      )}

      <Footer />

      {/* Student Detail Drawer */}
      {selectedStudent && currentUser?.role !== "supervisor" && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedStudentId(null)} />
          <div className="w-full max-w-[780px] bg-[#FAF9F4] h-full overflow-auto shadow-2xl border-l border-[#E1E5DA]">
            <StudentDetail
              student={selectedStudent}
              circles={circles}
              staff={staff}
              attendance={attendance}
              currentUserId={currentUserId || ""}
              plan={plan}
              onClose={() => setSelectedStudentId(null)}
              onAddMem={() => setShowMemModal(true)}
              onAddSmall={() => { setReviewForm(f => ({ ...f, date: todayISO() })); setShowReviewModal("small") }}
              onAddLarge={() => { setReviewForm(f => ({ ...f, date: todayISO() })); setShowReviewModal("large") }}
              onAddError={() => setShowErrorModal(true)}
              onAddNote={() => setShowNoteModal(true)}
              onUpdate={persistStudent}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      {showCircleModal && (
        <Modal title={editingCircleId ? "تعديل الحلقة" : "حلقة جديدة"} onClose={() => { setShowCircleModal(false); setEditingCircleId(null) }}>
          <label className="text-xs font-bold">اسم الحلقة</label>
          <input value={circleName} onChange={e => setCircleName(e.target.value)} placeholder="مثال: حلقة البيان" className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[#E1E5DA] text-sm focus:ring-2 focus:ring-[#1F5E3A] outline-none" />
          <div className="flex gap-2 mt-4">
            <button onClick={saveCircle} className="flex-1 py-2.5 rounded-xl bg-[#1F5E3A] text-white font-bold text-sm">حفظ</button>
            <button onClick={() => setShowCircleModal(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-bold">إلغاء</button>
          </div>
        </Modal>
      )}

      {showStaffModal && (
        <Modal title={editingStaffId ? "تعديل عضو" : "إضافة عضو للكادر"} onClose={() => setShowStaffModal(false)}>
          <div className="grid gap-3">
            <div><label className="text-xs font-bold">الاسم</label><input value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} className="w-full mt-1 px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[#1F5E3A]" /></div>
            <div><label className="text-xs font-bold">رقم الجوال</label><input value={staffForm.phone} onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })} dir="ltr" className="w-full mt-1 px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[#1F5E3A]" placeholder="05XXXXXXXX" /></div>
            <div><label className="text-xs font-bold">الدور</label>
              <select value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value as Role })} className="w-full mt-1 px-3 py-2.5 rounded-xl border text-sm bg-white">
                <option value="teacher">المعلم</option>
                <option value="supervisor">المشرف</option>
                <option value="admin">المدير</option>
                <option value="owner">المالك الرئيسي</option>
              </select>
            </div>
            {staffForm.role === "teacher" && (
              <div><label className="text-xs font-bold">الحلقة</label>
                <select value={staffForm.circleId} onChange={e => setStaffForm({ ...staffForm, circleId: e.target.value })} className="w-full mt-1 px-3 py-2.5 rounded-xl border text-sm bg-white">
                  <option value="">بدون</option>
                  {circles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={saveStaff} className="flex-1 py-2.5 rounded-xl bg-[#1F5E3A] text-white font-bold text-sm">حفظ</button>
            <button onClick={() => setShowStaffModal(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 font-bold text-sm">إلغاء</button>
          </div>
        </Modal>
      )}

      {showStudentModal && (
        <Modal title={editingStudentId ? "تعديل الطالب" : "إضافة طالب جديد"} onClose={() => setShowStudentModal(false)}>
          <div className="grid gap-3">
            <div><label className="text-xs font-bold">اسم الطالب *</label><input value={studentForm.name} onChange={e => setStudentForm({ ...studentForm, name: e.target.value })} placeholder="اسم الطالب الثلاثي" className="w-full mt-1 px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[#1F5E3A]" /></div>
            <div><label className="text-xs font-bold">رقم جوال ولي الأمر (اختياري)</label><input value={studentForm.phone} onChange={e => setStudentForm({ ...studentForm, phone: e.target.value })} dir="ltr" placeholder="05XXXXXXXX" className="w-full mt-1 px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[#1F5E3A]" /></div>
            <div><label className="text-xs font-bold">الحلقة</label>
              <select value={studentForm.circleId} onChange={e => setStudentForm({ ...studentForm, circleId: e.target.value })} className="w-full mt-1 px-3 py-2.5 rounded-xl border text-sm bg-white">
                <option value="">بدون حلقة</option>
                {circles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={saveStudent} className="flex-1 py-2.5 rounded-xl bg-[#1F5E3A] text-white font-bold text-sm">حفظ</button>
            <button onClick={() => setShowStudentModal(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 font-bold text-sm">إلغاء</button>
          </div>
        </Modal>
      )}

      {showMemModal && selectedStudent && (
        <Modal title="+ تسجيل حفظ جديد" onClose={() => setShowMemModal(false)}>
          <div className="grid gap-3">
            <div><label className="text-xs font-bold">التاريخ</label><input type="date" value={memForm.date} onChange={e => setMemForm({ ...memForm, date: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl border text-sm" /></div>
            <div><label className="text-xs font-bold">السورة</label>
              <select value={memForm.surahNumber} onChange={e => { const n = Number(e.target.value); const s = SURAHS.find(x => x.number === n)!; setMemForm({ ...memForm, surahNumber: n, fromAyah: 1, toAyah: Math.min(7, s.ayahCount) }) }} className="w-full mt-1 px-3 py-2.5 rounded-xl border bg-white text-sm max-h-[200px]">
                {SURAHS.map(s => <option key={s.number} value={s.number}>{s.number} — {s.name} ({s.ayahCount} آية)</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs font-bold">من آية</label><input type="number" value={memForm.fromAyah} onChange={e => setMemForm({ ...memForm, fromAyah: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-xl border text-sm" /></div>
              <div><label className="text-xs font-bold">إلى آية</label><input type="number" value={memForm.toAyah} onChange={e => setMemForm({ ...memForm, toAyah: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-xl border text-sm" /></div>
            </div>
            <div><label className="text-xs font-bold">التقدير</label>
              <select value={memForm.grade} onChange={e => setMemForm({ ...memForm, grade: e.target.value as Grade })} className="w-full mt-1 px-3 py-2.5 rounded-xl border bg-white text-sm">
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select></div>
            <div><label className="text-xs font-bold">ملاحظات</label><input value={memForm.notes} onChange={e => setMemForm({ ...memForm, notes: e.target.value })} placeholder="اختياري" className="w-full mt-1 px-3 py-2.5 rounded-xl border text-sm" /></div>
          </div>
          <div className="flex gap-2 mt-4"><button onClick={handleAddMemorization} className="flex-1 py-2.5 rounded-xl bg-[#1F5E3A] text-white font-bold text-sm">حفظ التسجيل</button><button onClick={() => setShowMemModal(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 font-bold text-sm">إلغاء</button></div>
        </Modal>
      )}

      {showReviewModal && selectedStudent && (
        <Modal title={showReviewModal === "small" ? "+ تسجيل مراجعة صغرى" : "+ تسجيل مراجعة كبرى"} onClose={() => setShowReviewModal(null)}>
          <p className="text-xs text-gray-500 mb-3">{showReviewModal === "small" ? "مخصصة للمراجعة القريبة واليومية (الماضي القريب)" : "مخصصة للمراجعة التراكمية البعيدة"}</p>
          <div className="grid gap-3">
            <div><label className="text-xs font-bold">التاريخ</label><input type="date" value={reviewForm.date} onChange={e => setReviewForm({ ...reviewForm, date: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl border text-sm" /></div>
            <div><label className="text-xs font-bold">السورة</label>
              <select value={reviewForm.surahNumber} onChange={e => { const n = Number(e.target.value); const s = SURAHS.find(x => x.number === n)!; setReviewForm({ ...reviewForm, surahNumber: n, fromAyah: 1, toAyah: Math.min(10, s.ayahCount) }) }} className="w-full mt-1 px-3 py-2.5 rounded-xl border bg-white text-sm">
                {SURAHS.map(s => <option key={s.number} value={s.number}>{s.number} — {s.name} ({s.ayahCount} آية)</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs font-bold">من آية</label><input type="number" value={reviewForm.fromAyah} onChange={e => setReviewForm({ ...reviewForm, fromAyah: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-xl border text-sm" /></div>
              <div><label className="text-xs font-bold">إلى آية</label><input type="number" value={reviewForm.toAyah} onChange={e => setReviewForm({ ...reviewForm, toAyah: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-xl border text-sm" /></div>
            </div>
            <div><label className="text-xs font-bold">التقدير</label>
              <select value={reviewForm.grade} onChange={e => setReviewForm({ ...reviewForm, grade: e.target.value as Grade })} className="w-full mt-1 px-3 py-2.5 rounded-xl border bg-white text-sm">
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select></div>
          </div>
          <div className="flex gap-2 mt-4"><button onClick={handleAddReview} className="flex-1 py-2.5 rounded-xl bg-[#1F5E3A] text-white font-bold text-sm">حفظ المراجعة</button><button onClick={() => setShowReviewModal(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 font-bold text-sm">إلغاء</button></div>
        </Modal>
      )}

      {showErrorModal && selectedStudent && (
        <Modal title="تسجيل خطأ" onClose={() => setShowErrorModal(false)}>
          <div className="grid gap-3">
            <div><label className="text-xs font-bold">التاريخ</label><input type="date" value={errorForm.date} onChange={e => setErrorForm({ ...errorForm, date: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl border text-sm" /></div>
            <div><label className="text-xs font-bold">نوع الخطأ</label>
              <select value={errorForm.type} onChange={e => setErrorForm({ ...errorForm, type: e.target.value as ErrorType })} className="w-full mt-1 px-3 py-2.5 rounded-xl border bg-white text-sm">
                {ERROR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select></div>
            <div><label className="text-xs font-bold">الوصف</label><textarea value={errorForm.description} onChange={e => setErrorForm({ ...errorForm, description: e.target.value })} rows={3} placeholder="اكتب تفاصيل الخطأ..." className="w-full mt-1 px-3 py-2 rounded-xl border text-sm" /></div>
          </div>
          <div className="flex gap-2 mt-4"><button onClick={handleAddError} className="flex-1 py-2.5 rounded-xl bg-[#B3492C] text-white font-bold text-sm">حفظ الخطأ</button><button onClick={() => setShowErrorModal(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 font-bold text-sm">إلغاء</button></div>
        </Modal>
      )}

      {showNoteModal && selectedStudent && (
        <Modal title="إضافة ملاحظة" onClose={() => setShowNoteModal(false)}>
          <label className="text-xs font-bold">نص الملاحظة</label>
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={4} placeholder="اكتب ملاحظة أو توجيهاً للطالب وولي أمره..." className="w-full mt-1 px-3 py-2 rounded-xl border text-sm" />
          <div className="flex gap-2 mt-4"><button onClick={handleAddNote} className="flex-1 py-2.5 rounded-xl bg-[#1F5E3A] text-white font-bold text-sm">إضافة</button><button onClick={() => setShowNoteModal(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 font-bold text-sm">إلغاء</button></div>
        </Modal>
      )}

      {planModal && currentUser?.role !== "supervisor" && (
        <PlanModal plan={plan} setPlan={setPlan} onClose={() => setPlanModal(false)} onToast={showToast} />
      )}

      {supabaseModal && isOwner && (
        <SupabaseModal
          url={supabaseUrlInput} setUrl={setSupabaseUrlInput}
          keyVal={supabaseKeyInput} setKey={setSupabaseKeyInput}
          onClose={() => setSupabaseModal(false)}
          onSave={() => { saveSupabaseConfig(supabaseUrlInput, supabaseKeyInput); showToast("تم حفظ المفاتيح"); testCloud() }}
          onClear={() => { saveSupabaseConfig("", ""); setSupabaseUrlInput(""); setSupabaseKeyInput(""); setIsCloudConnected(null); setCloudStatus(null); showToast("تم فصل الربط") }}
          status={cloudStatus} isConnected={isCloudConnected}
          onTest={testCloud} onPush={pushToCloud} onPull={pullFromCloud}
        />
      )}

      {toast && <Toast msg={toast} />}
    </div>
  )
}

// ===================== Components =====================
function StatCard({ label, value, sub, accent = "default", highlight }: { label: string; value: number; sub: string; accent?: string; highlight?: boolean }) {
  const colors: Record<string, string> = {
    default: "#1F5E3A", emerald: "#1F5E3A", gold: "#C9A227", red: "#B3492C", blue: "#2563EB"
  }
  return (
    <div className={`bg-white rounded-2xl p-3 border shadow-sm ${highlight ? "border-red-200 bg-red-50/40" : "border-[#E1E5DA]"}`}>
      <p className="text-[11px] text-gray-500 font-bold">{label}</p>
      <p className="text-xl font-black mt-1" style={{ color: colors[accent] || "#1F5E3A" }}>{value} <span className="text-[11px] font-bold text-gray-400">{sub}</span></p>
    </div>
  )
}

function Footer() {
  return (
    <footer className="shrink-0 bg-[#163F27] text-[#cfdfd3] border-t border-white/10 py-3 px-4 text-[12px]">
      <div className="max-w-[1100px] mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20c0-8 4.5-14.5 14-16.5C17.5 13.5 12.5 18.5 4 20Z" stroke="#8FBF9F" strokeWidth="1.6" strokeLinejoin="round" /><path d="M6.5 17.2C9 12.5 12.2 9 17.3 6" stroke="#8FBF9F" strokeWidth="1.3" strokeLinecap="round" /></svg>
          <span>جميع الحقوق محفوظة © 2026 لموقع حلقتي</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#C9A227]/15 text-[#e6cd7d] border border-[#C9A227]/30">الإصدار v1.0</span>
        </div>
        <a href="https://wa.me/966507804528?text=السلام%20عليكم،%20عندي%20ملاحظة%20حول%20موقع%20حلقتي" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#25D366]/15 border border-[#25D366]/30 text-[#d8f5e3] font-bold text-xs hover:bg-[#25D366]/20 transition">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.45 1.06 2.86 1.21 3.06.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35Z" /><path d="M12.04 2.5c-5.24 0-9.5 4.26-9.5 9.5 0 1.67.44 3.3 1.27 4.74L2.5 21.5l4.9-1.28a9.46 9.46 0 0 0 4.64 1.2h.01c5.23 0 9.49-4.26 9.49-9.5 0-2.54-.99-4.92-2.78-6.71a9.42 9.42 0 0 0-6.72-2.71Zm0 17.05h-.01a7.9 7.9 0 0 1-4.02-1.1l-.29-.17-2.91.76.78-2.84-.19-.29a7.86 7.86 0 0 1-1.21-4.21c0-4.36 3.55-7.9 7.91-7.9 2.11 0 4.09.83 5.58 2.32a7.84 7.84 0 0 1 2.31 5.59c0 4.36-3.55 7.9-7.95 7.9Z" /></svg>
          💬 للملاحظات والاستفسارات ‎+966507804528
        </a>
      </div>
    </footer>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl border border-[#E1E5DA] overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-5 py-3 border-b flex items-center justify-between bg-[#FAF9F4]">
          <h3 className="font-bold text-sm" style={{ color: "#163F27" }}>{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border hover:bg-gray-50">✕</button>
        </div>
        <div className="p-5 overflow-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

function SupabaseModal({ url, setUrl, keyVal, setKey, onClose, onSave, onClear, status, isConnected, onTest, onPush, onPull }: any) {
  const [tab, setTab] = useState<"keys" | "sql">("keys")
  const [copied, setCopied] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[720px] rounded-2xl shadow-xl border overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-black text-sm" style={{ color: "#163F27" }}>إعداد وربط قاعدة بيانات Supabase</h3>
            <p className="text-xs text-gray-500">حفظ ومزامنة الحلقات والكادر والطلاب سحابياً</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200">✕</button>
        </div>

        <div className="flex gap-2 px-6 pt-4">
          <button onClick={() => setTab("keys")} className={`px-4 py-2 rounded-xl text-xs font-bold border ${tab === "keys" ? "bg-[#1F5E3A] text-white border-[#1F5E3A]" : "bg-white"}`}>مفاتيح الربط</button>
          <button onClick={() => setTab("sql")} className={`px-4 py-2 rounded-xl text-xs font-bold border ${tab === "sql" ? "bg-[#1F5E3A] text-white border-[#1F5E3A]" : "bg-white"}`}>كود SQL</button>
          <div className="mr-auto flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : isConnected === false ? "bg-red-500" : "bg-gray-300"}`} />
            {status || "غير متصل"}
          </div>
        </div>

        <div className="p-6 overflow-auto flex-1">
          {tab === "keys" ? (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs leading-5">
                <b>✨ ميزة حلقتي الذكية:</b> النظام يعمل حالياً في المتصفح بكل كفاءة مع التخزين المحلي، وبمجرد إدخال مفاتيح Supabase سيبدأ بالحفظ السحابي الفوري ومشاركة البيانات بين المعلمين والإدارة وأولياء الأمور لحظياً!
              </div>
              <div>
                <label className="text-xs font-bold">رابط مشروع Supabase (Project URL)</label>
                <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" dir="ltr" className="w-full mt-1 px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-600" />
                <p className="text-[11px] text-gray-500 mt-1">تجد هذا الرابط في Supabase تحت: Settings ➔ API ➔ Project URL</p>
              </div>
              <div>
                <label className="text-xs font-bold">مفتاح الوصول العام (anon / public key)</label>
                <textarea value={keyVal} onChange={e => setKey(e.target.value)} rows={3} placeholder="eyJhbGciOi..." dir="ltr" className="w-full mt-1 px-3 py-2.5 rounded-xl border text-xs outline-none focus:ring-2 focus:ring-emerald-600" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={onSave} className="px-5 py-2 rounded-xl bg-[#1F5E3A] text-white font-bold text-sm">حفظ وربط</button>
                <button onClick={onTest} className="px-5 py-2 rounded-xl bg-white border font-bold text-sm">اختبار الاتصال</button>
                <button onClick={onClear} className="px-5 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold text-sm">فصل الربط</button>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border">
                <p className="font-bold text-xs mb-2">أدوات المزامنة السحابية:</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={onPush} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">⬆️ رفع البيانات إلى السحابة</button>
                  <button onClick={onPull} className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold">⬇️ سحب البيانات من السحابة</button>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">استخدم الرفع بعد إدخال بيانات جديدة، والسحب لجلب آخر التحديثات من الأجهزة الأخرى.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-600">انسخ هذا الكود والصقه في Supabase → SQL Editor ثم اضغط Run:</p>
              <div className="relative">
                <pre dir="ltr" className="bg-[#0f1e13] text-[#d8f5e3] p-4 rounded-xl text-[11px] leading-4 overflow-auto max-h-[300px] text-left">{SQL_CODE}</pre>
                <button onClick={() => { navigator.clipboard.writeText(SQL_CODE); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="absolute top-2 right-2 px-3 py-1.5 rounded-full bg-white text-xs font-bold border shadow">{copied ? "تم النسخ ✓" : "نسخ الكود"}</button>
              </div>
              <div className="grid md:grid-cols-2 gap-3 text-xs leading-5">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3"><b>خطوات الإعداد (دليل سريع):</b><ol className="list-decimal pr-5 mt-1 space-y-1"><li>ادخل على supabase.com وأنشئ حساباً ثم اضغط New Project</li><li>اختر اسماً للمشروع وكلمة مرور</li><li>افتح SQL Editor → New Query</li><li>الصق الكود واضغط Run</li><li>انسخ Project URL و anon key من Settings → API</li></ol></div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3"><b>ملاحظة هامة:</b><p className="mt-1">يتضمن الكود إنشاء جداول الحلقات والكادر والطلاب وسياسات الأمان (RLS) التي تسمح للتطبيق بقراءة وحفظ بيانات التسميع والمتابعة بكل سلاسة.</p><p className="mt-2 text-[11px] text-emerald-700">حلقتي · دعم مباشر مع Supabase PostgreSQL</p></div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-gray-100 border-t flex justify-between items-center">
          <span className="text-[11px] text-gray-500">حلقتي · دعم الربط المباشر مع Supabase</span>
          <button onClick={onClose} className="px-4 py-1.5 rounded-full bg-gray-200 hover:bg-gray-300 text-xs font-bold">إغلاق</button>
        </div>
      </div>
    </div>
  )
}

function PlanModal({ plan, setPlan, onClose, onToast }: { plan: AcademicPlan; setPlan: React.Dispatch<React.SetStateAction<AcademicPlan>>; onClose: () => void; onToast: (s: string) => void }) {
  const [newHoliday, setNewHoliday] = useState({ name: "", startDate: todayISO(), endDate: todayISO() })
  const toggleDay = (d: number) => {
    setPlan(p => ({ ...p, activeWeekdays: p.activeWeekdays.includes(d) ? p.activeWeekdays.filter(x => x !== d) : [...p.activeWeekdays, d].sort() }))
  }
  const addHoliday = () => {
    if (!newHoliday.name.trim()) { onToast("اسم الإجازة مطلوب"); return }
    if (newHoliday.endDate < newHoliday.startDate) { onToast("تاريخ النهاية قبل البداية"); return }
    setPlan(p => ({ ...p, holidays: [...p.holidays, { id: uid(), name: newHoliday.name.trim(), startDate: newHoliday.startDate, endDate: newHoliday.endDate }] }))
    setNewHoliday({ name: "", startDate: todayISO(), endDate: todayISO() }); onToast("تمت إضافة الإجازة")
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[640px] rounded-2xl shadow-xl border max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b bg-[#FAF9F4] flex items-center justify-between">
          <h3 className="font-black text-sm" style={{ color: "#163F27" }}>الخطة السنوية للحلقة</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border">✕</button>
        </div>
        <div className="p-6 overflow-auto flex-1 space-y-5">
          <div>
            <h4 className="font-bold text-sm mb-2">السنة الدراسية</h4>
            <p className="text-xs text-gray-500 mb-3">نطاق السنة الدراسية بالتقويم الهجري — يُعرض التاريخ الهجري للمراجعة</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-bold">تاريخ البداية</label><input type="date" value={plan.startDate} onChange={e => setPlan({ ...plan, startDate: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl border text-sm" /><p className="text-[11px] text-gray-500 mt-1">{fmtBoth(plan.startDate)}</p></div>
              <div><label className="text-xs font-bold">تاريخ النهاية</label><input type="date" value={plan.endDate} onChange={e => setPlan({ ...plan, endDate: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl border text-sm" /><p className="text-[11px] text-gray-500 mt-1">{fmtBoth(plan.endDate)}</p></div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-sm">أيام التسميع الأسبوعية</h4>
            <p className="text-xs text-gray-500 mb-2">الأيام غير المحددة تُعامل كعطلة أسبوعية.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WEEKDAYS.map((d, i) => (
                <label key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${plan.activeWeekdays.includes(i) ? "bg-[#1F5E3A] text-white border-[#1F5E3A]" : "bg-white hover:bg-gray-50"}`}>
                  <input type="checkbox" checked={plan.activeWeekdays.includes(i)} onChange={() => toggleDay(i)} className="accent-[#1F5E3A]" />
                  {d}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">الجدول الأسبوعي — أيام التسميع: <b>{plan.activeWeekdays.map(i => WEEKDAYS[i]).join("، ") || "لا يوجد"}</b></p>
          </div>

          <div>
            <h4 className="font-bold text-sm">الإجازات والمناسبات</h4>
            <div className="grid md:grid-cols-3 gap-2 mt-2">
              <input value={newHoliday.name} onChange={e => setNewHoliday({ ...newHoliday, name: e.target.value })} placeholder="اسم الإجازة" className="px-3 py-2 rounded-xl border text-sm" />
              <input type="date" value={newHoliday.startDate} onChange={e => setNewHoliday({ ...newHoliday, startDate: e.target.value })} className="px-3 py-2 rounded-xl border text-sm" />
              <input type="date" value={newHoliday.endDate} onChange={e => setNewHoliday({ ...newHoliday, endDate: e.target.value })} className="px-3 py-2 rounded-xl border text-sm" />
            </div>
            <button onClick={addHoliday} className="mt-2 px-4 py-2 rounded-xl bg-[#C9A227] text-white text-xs font-bold">+ إضافة الإجازة</button>

            <div className="mt-3 space-y-2">
              {plan.holidays.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">لم تُضف إجازات بعد</p> :
                plan.holidays.map(h => (
                  <div key={h.id} className="flex items-center justify-between p-2.5 rounded-xl border bg-[#FAF9F4]">
                    <div>
                      <p className="font-bold text-xs">{h.name}</p>
                      <p className="text-[11px] text-gray-500">{fmtBoth(h.startDate)} إلى {fmtBoth(h.endDate)}</p>
                    </div>
                    <button onClick={() => setPlan(p => ({ ...p, holidays: p.holidays.filter(x => x.id !== h.id) }))} className="px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs">حذف</button>
                  </div>
                ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-3 bg-gray-50 border-t flex justify-between items-center">
          <span className="text-[11px] text-gray-500">يُحفظ تلقائياً في المتصفح {getSupabaseConfig().isConfigured && "و Supabase"}</span>
          <button onClick={() => { onClose(); onToast("تم حفظ الخطة السنوية") }} className="px-5 py-2 rounded-xl bg-[#1F5E3A] text-white font-bold text-sm">إغلاق وحفظ</button>
        </div>
      </div>
    </div>
  )
}

function ParentTokenView({ student, circles, staff, attendance, plan }: { student: Student; circles: Circle[]; staff: Staff[]; attendance: AttendanceRecord[]; plan: AcademicPlan }) {
  const circleName = circles.find(c => c.id === student.circleId)?.name || "بدون حلقة"
  const totalAyah = student.memorizationLog.reduce((a,b)=>a+b.ayahCount,0)
  const totalReview = student.reviewLog.reduce((a,b)=>a+b.ayahCount,0)
  const excellenceRate = student.memorizationLog.length ? Math.round(student.memorizationLog.filter(x=>x.grade==="ممتاز").length / student.memorizationLog.length * 100) : 0

  // آخر سجل هو المطلوب الحالي (حسب اختيار المستخدم)
  const latestMem = React.useMemo(() => {
    if (!student.memorizationLog.length) return null
    return [...student.memorizationLog].sort((a,b)=> b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0] as MemorizationEntry
  }, [student])
  const latestSmall = React.useMemo(() => {
    const arr = student.reviewLog.filter(x=> x.reviewType === "small")
    if (!arr.length) return null
    return [...arr].sort((a,b)=> b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0] as ReviewEntry
  }, [student])
  const latestLarge = React.useMemo(() => {
    const arr = student.reviewLog.filter(x=> x.reviewType === "large")
    if (!arr.length) return null
    return [...arr].sort((a,b)=> b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0] as ReviewEntry
  }, [student])

  const [historyFilter, setHistoryFilter] = React.useState<"all"|"mem"|"review">("all")
  const [showPlanPage, setShowPlanPage] = React.useState(false)

  // السجلات السابقة = كل السجلات ما عدا الأحدث لكل نوع
  const previousCombined = React.useMemo(() => {
    const list: Array<{ key: string; type: "mem"|"small"|"large"; date: string; sortKey: string }> = []
    const memPrev = latestMem ? student.memorizationLog.filter(x=> x.id !== latestMem.id) : student.memorizationLog
    const smallPrev = latestSmall ? student.reviewLog.filter(x=> x.id !== latestSmall.id && x.reviewType==="small") : student.reviewLog.filter(x=> x.reviewType==="small")
    const largePrev = latestLarge ? student.reviewLog.filter(x=> x.id !== latestLarge.id && x.reviewType==="large") : student.reviewLog.filter(x=> x.reviewType==="large")
    memPrev.forEach(e=> list.push({ key: e.id, type: "mem", date: e.date, sortKey: e.date + e.id }))
    smallPrev.forEach(e=> list.push({ key: e.id, type: "small", date: e.date, sortKey: e.date + e.id }))
    largePrev.forEach(e=> list.push({ key: e.id, type: "large", date: e.date, sortKey: e.date + e.id }))
    // رتب تنازلياً حسب التاريخ
    return list.sort((a,b)=> b.sortKey.localeCompare(a.sortKey))
  }, [student, latestMem, latestSmall, latestLarge])

  const filteredPrev = React.useMemo(() => {
    if (historyFilter === "mem") return previousCombined.filter(x=> x.type==="mem")
    if (historyFilter === "review") return previousCombined.filter(x=> x.type!=="mem")
    return previousCombined
  }, [previousCombined, historyFilter])

  // خرائط سريعة للوصول للبيانات
  const memMap = React.useMemo(()=> new Map(student.memorizationLog.map(e=>[e.id, e])), [student])
  const reviewMap = React.useMemo(()=> new Map(student.reviewLog.map(e=>[e.id, e])), [student])

  const hasAnyRequired = !!(latestMem || latestSmall || latestLarge)

  // ===== صفحة الخطة السنوية الكاملة (صفحة منفصلة) =====
  if (showPlanPage) {
    return (
      <div className="flex-1 min-h-[70vh]">
        <div className="max-w-[900px] mx-auto px-4 py-6 space-y-4">
          <button onClick={()=> setShowPlanPage(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-[#E1E5DA] text-xs font-bold text-[#1F5E3A] hover:bg-[#FAF9F4] transition">
            <span>→</span> رجوع لصفحة الطالب
          </button>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b bg-[#FAF9F4]/60">
              <h2 className="font-black text-lg flex items-center gap-2" style={{color:"#163F27"}}>📅 الخطة السنوية</h2>
              <p className="text-xs text-gray-500 mt-1">تفاصيل السنة الدراسية وأيام التسميع والإجازات المعتمدة</p>
            </div>

            <div className="p-6 space-y-6">
              {/* السنة الدراسية */}
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2" style={{color:"#163F27"}}><span className="w-1 h-4 rounded-full" style={{background:"#1F5E3A"}}></span> السنة الدراسية</h3>
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  <div className="bg-[#FAF9F4] rounded-xl p-4 border border-[#E1E5DA]">
                    <p className="text-[11px] font-bold text-gray-500">تاريخ البداية</p>
                    <p className="font-black text-sm mt-1" style={{color:"#163F27"}}>{plan.startDate ? fmtBoth(plan.startDate) : "غير محدد"}</p>
                  </div>
                  <div className="bg-[#FAF9F4] rounded-xl p-4 border border-[#E1E5DA]">
                    <p className="text-[11px] font-bold text-gray-500">تاريخ النهاية</p>
                    <p className="font-black text-sm mt-1" style={{color:"#163F27"}}>{plan.endDate ? fmtBoth(plan.endDate) : "غير محدد"}</p>
                  </div>
                </div>
              </div>

              {/* أيام التسميع */}
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2" style={{color:"#163F27"}}><span className="w-1 h-4 rounded-full" style={{background:"#1F5E3A"}}></span> أيام التسميع الأسبوعية</h3>
                <p className="text-[11px] text-gray-500 mt-1">الأيام المفعّلة هي أيام الحضور والتسميع المعتمدة</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  {WEEKDAYS.map((d, i) => (
                    <div key={i} className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-center transition ${plan.activeWeekdays.includes(i) ? "bg-[#1F5E3A] text-white border-[#1F5E3A] shadow-sm" : "bg-white text-gray-400 border-[#E1E5DA]"}`}>
                      {d}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center mt-3 px-3 py-2 rounded-xl bg-[#E7EFE7] border border-[#1F5E3A]/20 font-bold" style={{color:"#1F5E3A"}}>
                  الجدول الأسبوعي: {plan.activeWeekdays.length ? plan.activeWeekdays.map(i=> WEEKDAYS[i]).join("، ") : "لم يتم تحديد أيام"}
                </p>
              </div>

              {/* الإجازات */}
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2" style={{color:"#163F27"}}><span className="w-1 h-4 rounded-full" style={{background:"#1F5E3A"}}></span> الإجازات والمناسبات <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E7EFE7] border border-[#1F5E3A]/20 text-[#1F5E3A]">{plan.holidays.length}</span></h3>
                {plan.holidays.length===0 ? (
                  <div className="text-center py-8 bg-[#FAF9F4] rounded-xl border border-dashed mt-3">
                    <p className="text-2xl mb-1">🏖️</p>
                    <p className="text-xs font-bold text-gray-600">لا توجد إجازات مسجلة حالياً</p>
                    <p className="text-[11px] text-gray-400 mt-1">سيتم تحديثها من قبل الإدارة عند الحاجة</p>
                  </div>
                ) : (
                  <div className="space-y-2 mt-3">
                    {plan.holidays.map(h=> (
                      <div key={h.id} className="flex items-center justify-between p-3 rounded-xl border bg-[#FAF9F4] border-[#E1E5DA]">
                        <div>
                          <p className="font-bold text-xs" style={{color:"#163F27"}}>{h.name}</p>
                          <p className="text-[11px] text-gray-500 mt-1">{fmtBoth(h.startDate)} إلى {fmtBoth(h.endDate)}</p>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border text-gray-600">إجازة</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-[#FAF9F4] border border-[#E1E5DA] rounded-xl p-3 text-center">
                <p className="text-[11px] text-gray-500">💡 هذه الخطة معتمدة من إدارة الحلقة وتُحدّث تلقائياً</p>
              </div>
            </div>
          </div>

          <button onClick={()=> setShowPlanPage(false)} className="w-full py-3 rounded-xl bg-[#1F5E3A] hover:bg-[#163F27] text-white font-bold text-sm transition">العودة لصفحة الطالب</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1">
      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-4">
        {/* بطاقة الطالب — بدون أي هيدر علوي حسب الطلب السابق */}
        <div className="bg-white rounded-2xl border p-5 flex items-center gap-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white text-xl shrink-0" style={{background:"#1F5E3A"}}>{student.name.trim().charAt(0)}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-lg" style={{color:"#163F27"}}>{student.name}</h3>
            <p className="text-xs text-gray-500 mt-1 truncate">{circleName} • حفظ: {student.memorizationLog.length} • مراجعة: {student.reviewLog.length} • أخطاء: {student.errorsLog.length}</p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">متابعة ولي الأمر</span>
            <span className="text-[11px] text-gray-400">{fmtBoth(todayISO())}</span>
          </div>
        </div>

        {/* ===== المطلوب غداً ===== */}
        <div className="bg-[#1F5E3A] rounded-2xl p-4 shadow-sm text-center">
          <h4 className="font-black text-sm text-white">المطلوب غداً</h4>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {/* حفظ جديد — لون موحد */}
          <div className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden" style={{borderColor: latestMem ? "#1F5E3A" : "#E1E5DA"}}>
            <div className="px-3 py-2 flex items-center justify-between" style={{background: latestMem ? "#1F5E3A" : "#F3F4F6"}}>
              <p className="font-black text-xs flex items-center gap-1.5" style={{color: latestMem ? "white" : "#6B7280"}}>حفظ جديد</p>
              {latestMem && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#1F5E3A]">{latestMem.ayahCount} آية</span>}
            </div>
            <div className="p-3">
              {latestMem ? (
                <div>
                  <p className="font-black text-sm" style={{color:"#163F27"}}>سورة {latestMem.surahName}</p>
                  <p className="text-xs font-bold mt-1" style={{color:"#1F5E3A"}}>من الآية {latestMem.fromAyah} إلى {latestMem.toAyah}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{background: GRADE_COLOR[latestMem.grade]}}>{latestMem.grade}</span>
                    <span className="text-[11px] text-gray-500">{fmtBoth(latestMem.date)}</span>
                  </div>

                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-2xl mb-1">📭</p>
                  <p className="text-xs font-bold text-gray-600">لا يوجد حفظ جديد مسجل</p>
                  <p className="text-[11px] text-gray-400 mt-1 leading-5">تابع مع المعلم لمعرفة المقطع القادم</p>
                </div>
              )}
            </div>
          </div>

          {/* مراجعة صغرى — لون موحد نفس النظام */}
          <div className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden" style={{borderColor: latestSmall ? "#1F5E3A" : "#E1E5DA"}}>
            <div className="px-3 py-2 flex items-center justify-between" style={{background: latestSmall ? "#1F5E3A" : "#F3F4F6"}}>
              <p className="font-black text-xs flex items-center gap-1.5" style={{color: latestSmall ? "white" : "#6B7280"}}>مراجعة صغرى</p>
              {latestSmall && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#1F5E3A]">{latestSmall.ayahCount} آية</span>}
            </div>
            <div className="p-3">
              {latestSmall ? (
                <div>
                  <p className="font-black text-sm" style={{color:"#163F27"}}>سورة {latestSmall.surahName}</p>
                  <p className="text-xs font-bold mt-1" style={{color:"#1F5E3A"}}>من الآية {latestSmall.fromAyah} إلى {latestSmall.toAyah}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{background: GRADE_COLOR[latestSmall.grade]}}>{latestSmall.grade}</span>
                    <span className="text-[11px] text-gray-500">{fmtBoth(latestSmall.date)}</span>
                  </div>

                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-2xl mb-1">📭</p>
                  <p className="text-xs font-bold text-gray-600">لا توجد مراجعة صغرى</p>
                  <p className="text-[11px] text-gray-400 mt-1">الماضي القريب — ستظهر هنا عند التسجيل</p>
                </div>
              )}
            </div>
          </div>

          {/* مراجعة كبرى — لون موحد نفس النظام */}
          <div className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden" style={{borderColor: latestLarge ? "#1F5E3A" : "#E1E5DA"}}>
            <div className="px-3 py-2 flex items-center justify-between" style={{background: latestLarge ? "#1F5E3A" : "#F3F4F6"}}>
              <p className="font-black text-xs flex items-center gap-1.5" style={{color: latestLarge ? "white" : "#6B7280"}}>مراجعة كبرى</p>
              {latestLarge && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#1F5E3A]">{latestLarge.ayahCount} آية</span>}
            </div>
            <div className="p-3">
              {latestLarge ? (
                <div>
                  <p className="font-black text-sm" style={{color:"#163F27"}}>سورة {latestLarge.surahName}</p>
                  <p className="text-xs font-bold mt-1" style={{color:"#1F5E3A"}}>من الآية {latestLarge.fromAyah} إلى {latestLarge.toAyah}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{background: GRADE_COLOR[latestLarge.grade]}}>{latestLarge.grade}</span>
                    <span className="text-[11px] text-gray-500">{fmtBoth(latestLarge.date)}</span>
                  </div>

                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-2xl mb-1">📭</p>
                  <p className="text-xs font-bold text-gray-600">لا توجد مراجعة كبرى</p>
                  <p className="text-[11px] text-gray-400 mt-1">الماضي البعيد — ستظهر هنا عند التسجيل</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {!hasAnyRequired && (
          <div className="bg-[#FAF9F4] border border-[#E1E5DA] rounded-2xl p-3 text-center">
            <p className="text-xs font-bold" style={{color:"#163F27"}}>👋 مرحباً {student.name} — لم يسجّل المعلم أي حفظ أو مراجعة بعد</p>
            <p className="text-[11px] text-gray-500 mt-1">سيظهر المطلوب منك هنا فور تسجيل المعلم لأول تسميع</p>
          </div>
        )}

        {/* إحصائيات سريعة + زر الخطة السنوية بجانبها */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <MiniStat label="مقدار الحفظ" value={totalAyah + " آية"} />
          <MiniStat label="مقدار المراجعة" value={totalReview + " آية"} />
          <MiniStat label="نسبة الامتياز" value={excellenceRate + "%"} />
          <MiniStat label="عدد الملاحظات" value={String(student.notes.length)} />
          <button onClick={()=> setShowPlanPage(true)} className="bg-white rounded-xl border-2 border-[#1F5E3A]/20 hover:border-[#1F5E3A] hover:bg-[#E7EFE7]/50 p-3 text-center transition group flex flex-col items-center justify-center gap-1 shadow-sm">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{background:"#1F5E3A", color:"white"}}>📅</span>
            <span className="text-[11px] font-black" style={{color:"#1F5E3A"}}>الخطة السنوية</span>
            <span className="text-[10px] font-bold text-gray-500 group-hover:text-[#1F5E3A]">عرض كامل ←</span>
          </button>
        </div>

        {/* ===== تبويب السجل السابق — تبويب واحد يجمع الكل مع فلتر داخلي — ألوان موحدة ===== */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-[#FAF9F4]/70 flex flex-wrap items-center justify-between gap-3">
            <h4 className="font-black text-sm flex items-center gap-2" style={{color:"#163F27"}}>
              📂 السجل السابق
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border text-gray-600">{previousCombined.length} سجل</span>
              <span className="hidden sm:inline text-[11px] font-normal text-gray-400">— ما عدا المطلوب المعروض أعلاه</span>
            </h4>
            <div className="flex gap-1 p-1 rounded-full bg-gray-100 border">
              <button onClick={()=> setHistoryFilter("all")} className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${historyFilter==="all" ? "bg-[#1F5E3A] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>الكل</button>
              <button onClick={()=> setHistoryFilter("mem")} className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${historyFilter==="mem" ? "bg-[#1F5E3A] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>حفظ فقط</button>
              <button onClick={()=> setHistoryFilter("review")} className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${historyFilter==="review" ? "bg-[#1F5E3A] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>مراجعة فقط</button>
            </div>
          </div>
          <div className="p-4">
            {filteredPrev.length===0 ? (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">✨</p>
                <p className="text-xs font-bold text-gray-600">{previousCombined.length===0 ? "لا يوجد سجل سابق بعد" : "لا توجد سجلات في هذا الفلتر"}</p>
                <p className="text-[11px] text-gray-400 mt-1">{previousCombined.length===0 ? "سيظهر هنا سجلّك السابق بعد إضافة أكثر من تسميع" : "جرّب اختيار فلتر آخر"}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {filteredPrev.map(item => {
                  if (item.type==="mem") {
                    const e = memMap.get(item.key) as MemorizationEntry
                    if (!e) return null
                    return (
                      <div key={e.id} className="flex items-center justify-between p-3 rounded-xl border bg-[#FAF9F4]/60 hover:bg-white transition">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0" style={{background:"#E7EFE7", color:"#1F5E3A"}}>📖</span>
                          <div>
                            <p className="font-bold text-xs">حفظ — سورة {e.surahName} <span className="font-normal text-gray-500">({e.fromAyah}-{e.toAyah} • {e.ayahCount} آية)</span></p>
                            <p className="text-[11px] text-gray-500">{fmtBoth(e.date)}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white shrink-0" style={{background: GRADE_COLOR[e.grade]}}>{e.grade}</span>
                      </div>
                    )
                  } else {
                    const e = reviewMap.get(item.key) as ReviewEntry
                    if (!e) return null
                    const isSmall = e.reviewType==="small"
                    return (
                      <div key={e.id} className="flex items-center justify-between p-3 rounded-xl border bg-white hover:bg-[#FAF9F4]/50 transition">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0" style={{background:"#E7EFE7", color:"#1F5E3A"}}>{isSmall ? "🔁" : "📚"}</span>
                          <div>
                            <p className="font-bold text-xs">{isSmall ? "مراجعة صغرى" : "مراجعة كبرى"} — سورة {e.surahName} <span className="font-normal text-gray-500">({e.fromAyah}-{e.toAyah} • {e.ayahCount} آية)</span></p>
                            <p className="text-[11px] text-gray-500">{fmtBoth(e.date)}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white shrink-0" style={{background: GRADE_COLOR[e.grade]}}>{e.grade}</span>
                      </div>
                    )
                  }
                })}
              </div>
            )}
            {filteredPrev.length>0 && <p className="text-center text-[11px] text-gray-400 mt-3">💡 هذا هو سجلك السابق — المطلوب الحالي معروض في الأعلى بشكل منفصل</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-4">
          <h4 className="font-bold text-xs mb-3">الأخطاء ({student.errorsLog.length})</h4>
          {student.errorsLog.length===0 ? <p className="text-xs text-emerald-700 text-center py-2 bg-emerald-50 border border-emerald-200 rounded-xl">لا يوجد أخطاء مسجلة، ما شاء الله!</p> : (
            <div className="space-y-2">
              {student.errorsLog.map(e=> (
                <div key={e.id} className="p-3 rounded-xl border bg-red-50/40 border-red-200">
                  <p className="font-bold text-xs text-red-800">{e.type} — <span className="font-normal text-gray-700">{e.description}</span></p>
                  <p className="text-[11px] text-gray-500">{fmtBoth(e.date)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border p-4">
          <h4 className="font-bold text-xs mb-3">الملاحظات ({student.notes.length})</h4>
          {student.notes.length===0 ? <p className="text-xs text-gray-400 text-center py-2">لا توجد ملاحظات</p> : (
            <div className="space-y-2">
              {student.notes.map(n=> (
                <div key={n.id} className="p-3 rounded-xl border bg-[#FAF9F4] border-[#E1E5DA]">
                  <p className="text-xs leading-5">{n.text}</p>
                  <p className="text-[11px] text-gray-500 mt-1">{fmtBoth(n.date)} • {staff.find(s=>s.id===n.authorId)?.name || "—"}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}



function StudentDetail({ student, circles, staff, attendance, currentUserId, plan, onClose, onAddMem, onAddSmall, onAddLarge, onAddError, onAddNote, onUpdate }: {
  student: Student; circles: Circle[]; staff: Staff[]; attendance: AttendanceRecord[]; currentUserId: string; plan: AcademicPlan;
  onClose: () => void; onAddMem: () => void; onAddSmall: () => void; onAddLarge: () => void; onAddError: () => void; onAddNote: () => void;
  onUpdate: (s: Student) => void;
}) {
  const circleName = circles.find(c => c.id === student.circleId)?.name || "بدون حلقة"
  const link = linkForStudent(student)
  const waText = `السلام عليكم ورحمة الله،\nرابط متابعة إنجاز الطالب في حلقة القرآن الكريم (${student.name}):\n${link}`
  const waLink = `https://wa.me/${student.phone.replace(/\D/g, "")}?text=${encodeURIComponent(waText)}`
  const waGeneral = `https://wa.me/?text=${encodeURIComponent(waText)}`
  const totalAyah = student.memorizationLog.reduce((a, b) => a + b.ayahCount, 0)
  const totalReview = student.reviewLog.reduce((a, b) => a + b.ayahCount, 0)
  const excellenceRate = student.memorizationLog.length ? Math.round(student.memorizationLog.filter(x => x.grade === "ممتاز").length / student.memorizationLog.length * 100) : 0
  const cumData = useMemo(() => {
    const all = [...student.memorizationLog, ...student.reviewLog].sort((a, b) => a.date.localeCompare(b.date))
    let cum = 0; return all.map(e => { cum += (e as any).ayahCount; return { date: e.date.slice(5), cum } }).slice(-10)
  }, [student])

  const copyLink = () => { navigator.clipboard.writeText(link); }
  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg" style={{ background: "#1F5E3A" }}>{student.name.charAt(0)}</div>
          <div>
            <h3 className="font-black text-[15px]" style={{ color: "#163F27" }}>{student.name}</h3>
            <p className="text-xs text-gray-500">{circleName} • {student.phone || "بدون جوال"} • حفظ: {student.memorizationLog.length} • مراجعة: {student.reviewLog.length}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200">✕</button>
      </div>

      <div className="p-5 space-y-4">
        {/* Share */}
        <div className="bg-white rounded-2xl border p-4">
          <p className="font-bold text-xs mb-2">رابط المتابعة لولي الأمر</p>
          <div className="flex gap-2">
            <input value={link} readOnly dir="ltr" className="flex-1 px-3 py-2 rounded-xl border bg-gray-50 text-xs ltr" />
            <button onClick={copyLink} className="px-3 py-2 rounded-xl bg-[#1F5E3A] text-white text-xs font-bold">نسخ</button>
          </div>
          <div className="flex gap-2 mt-2">
            <a href={student.phone ? waLink : waGeneral} target="_blank" rel="noreferrer" className="flex-1 text-center py-2 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-xs font-bold">📱 واتساب لولي الأمر</a>
            <a href={waGeneral} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-xl bg-white border text-xs font-bold">مشاركة عامة</a>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">آخر زيارة: {student.visitLog[0]?.date ? fmtBoth(student.visitLog[0].date) + ` (${student.visitLog.length} زيارة)` : "لم يزر بعد"} • مجموع الزيارات: {student.visitLog.reduce((a, b) => a + b.count, 0)}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <MiniStat label="مقدار الحفظ" value={totalAyah + " آية"} />
          <MiniStat label="مقدار المراجعة" value={totalReview + " آية"} />
          <MiniStat label="نسبة الامتياز" value={excellenceRate + "%"} />
          <MiniStat label="عدد الأخطاء" value={String(student.errorsLog.length)} />
        </div>

        {/* Memorization */}
        <Section title="سجل التسميعات" emptyText="لا يوجد سجل حفظ بعد" count={student.memorizationLog.length} actionLabel="+ تسجيل حفظ جديد" onAction={onAddMem}>
          <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
            {student.memorizationLog.map(e => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-xl border bg-white hover:bg-gray-50">
                <div>
                  <p className="font-bold text-xs">سورة {e.surahName} — من الآية {e.fromAyah} إلى {e.toAyah} <span className="text-gray-400">({e.ayahCount} آية)</span></p>
                  <p className="text-[11px] text-gray-500">{fmtBoth(e.date)} • المعلم: {staff.find(s => s.id === e.teacherId)?.name || "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: GRADE_COLOR[e.grade] }}>{e.grade}</span>
                  <button onClick={() => { if (confirm("حذف التسجيل؟")) onUpdate({ ...student, memorizationLog: student.memorizationLog.filter(x => x.id !== e.id) }) }} className="text-[11px] px-2 py-1 rounded-full bg-red-50 border border-red-200 text-red-700">حذف</button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Review small / large */}
        <div className="grid md:grid-cols-2 gap-4">
          <Section title="1. مراجعة صغرى" subtitle="الماضي القريب" count={student.reviewLog.filter(x => x.reviewType === "small").length} emptyText="لا توجد مراجعات صغرى" actionLabel="+ تسجيل مراجعة صغرى" onAction={onAddSmall}>
            <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
              {student.reviewLog.filter(x => x.reviewType === "small").map(e => (
                <LogRow key={e.id} e={e} staff={staff} onDelete={() => onUpdate({ ...student, reviewLog: student.reviewLog.filter(x => x.id !== e.id) })} />
              ))}
              {student.reviewLog.filter(x => x.reviewType === "small").length === 0 && <p className="text-xs text-gray-400 text-center py-4">لا توجد تسجيلات بعد</p>}
            </div>
          </Section>
          <Section title="2. مراجعة كبرى" subtitle="الماضي البعيد" count={student.reviewLog.filter(x => x.reviewType === "large").length} emptyText="لا توجد مراجعات كبرى" actionLabel="+ تسجيل مراجعة كبرى" onAction={onAddLarge}>
            <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
              {student.reviewLog.filter(x => x.reviewType === "large").map(e => (
                <LogRow key={e.id} e={e} staff={staff} onDelete={() => onUpdate({ ...student, reviewLog: student.reviewLog.filter(x => x.id !== e.id) })} />
              ))}
              {student.reviewLog.filter(x => x.reviewType === "large").length === 0 && <p className="text-xs text-gray-400 text-center py-4">لا توجد تسجيلات بعد</p>}
            </div>
          </Section>
        </div>



        {/* Errors */}
        <Section title="الأخطاء" count={student.errorsLog.length} emptyText="لا يوجد أخطاء، ما شاء الله!" actionLabel="+ تسجيل خطأ" onAction={onAddError}>
          <div className="space-y-2">
            {student.errorsLog.map(e => (
              <div key={e.id} className="p-3 rounded-xl border bg-red-50/50 border-red-200 flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-red-800">{e.type} — <span className="font-normal text-gray-700">{e.description}</span></p>
                  <p className="text-[11px] text-gray-500">{fmtBoth(e.date)}</p>
                </div>
                <button onClick={() => onUpdate({ ...student, errorsLog: student.errorsLog.filter(x => x.id !== e.id) })} className="px-2 py-1 rounded-full bg-white border text-xs">حذف</button>
              </div>
            ))}
            {student.errorsLog.length === 0 && <p className="text-xs text-emerald-700 text-center py-2 bg-emerald-50 border border-emerald-200 rounded-xl">لا يوجد أخطاء مسجلة، ما شاء الله تبارك الله!</p>}
          </div>
        </Section>

        {/* Notes */}
        <Section title="الملاحظات والتوجيهات" count={student.notes.length} emptyText="لا توجد ملاحظات" actionLabel="إضافة ملاحظة" onAction={onAddNote}>
          <div className="space-y-2">
            {student.notes.map(n => (
              <div key={n.id} className="p-3 rounded-xl border bg-amber-50/50 border-amber-200">
                <p className="text-xs leading-5">{n.text}</p>
                <p className="text-[11px] text-gray-500 mt-1">{fmtBoth(n.date)} • {staff.find(s => s.id === n.authorId)?.name || "—"}</p>
              </div>
            ))}
            {student.notes.length === 0 && <p className="text-xs text-gray-400 text-center py-2">لا توجد ملاحظات</p>}
          </div>
        </Section>

        {/* Chart */}
        <div className="bg-white rounded-2xl border p-4">
          <h4 className="font-bold text-xs mb-3">تطور الحفظ والمراجعة (تراكمي بالآيات)</h4>
          {cumData.length < 2 ? <p className="text-xs text-gray-400 text-center py-6">لا توجد بيانات كافية لعرض الرسم البياني بعد</p> :
            <div className="h-[140px] flex items-end gap-1">
              {cumData.map((d, i) => {
                const max = Math.max(...cumData.map(x => x.cum), 1)
                const h = Math.max(8, (d.cum / max) * 120)
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-lg transition" style={{ height: h, background: i % 2 ? "#1F5E3A" : "#C9A227" }} title={`${d.date}: ${d.cum} آية`} />
                    <span className="text-[9px] text-gray-500 rotate-[-30deg]">{d.date}</span>
                  </div>
                )
              })}
            </div>
          }
        </div>




        <div className="pb-6" />
      </div>
    </div>
  )
}

function Section({ title, subtitle, count, emptyText, actionLabel, onAction, children }: { title: string; subtitle?: string; count?: number; emptyText: string; actionLabel: string; onAction: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-xs">{title} {subtitle && <span className="text-gray-400 font-normal">• {subtitle}</span>} {count !== undefined && <span className="mr-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-100 border"> {count}</span>}</h4>
        <button onClick={onAction} className="px-3 py-1.5 rounded-full bg-[#1F5E3A] text-white text-[11px] font-bold hover:bg-[#163F27]">{actionLabel}</button>
      </div>
      {children}
    </div>
  )
}
function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="bg-white rounded-xl border p-3 text-center"><p className="text-[11px] text-gray-500 font-bold">{label}</p><p className="font-black text-sm mt-1" style={{ color: "#1F5E3A" }}>{value}</p></div>
}
function LogRow({ e, staff, onDelete }: { e: ReviewEntry; staff: Staff[]; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl border bg-white">
      <div>
        <p className="font-bold text-xs">سورة {e.surahName} {e.fromAyah}-{e.toAyah} ({e.ayahCount} آية)</p>
        <p className="text-[11px] text-gray-500">{fmtBoth(e.date)} • {staff.find(s => s.id === e.teacherId)?.name || "—"}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-bold px-2 py-1 rounded-full text-white" style={{ background: GRADE_COLOR[e.grade] }}>{e.grade}</span>
        <button onClick={onDelete} className="text-[11px] px-2 py-1 rounded-full bg-red-50 border border-red-200 text-red-700">حذف</button>
      </div>
    </div>
  )
}
function Toast({ msg }: { msg: string }) {
  return <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#163F27] text-white px-5 py-3 rounded-full shadow-lg text-sm font-bold z-50">{msg}</div>
}
