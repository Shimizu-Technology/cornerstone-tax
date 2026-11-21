import { useState, useEffect, useCallback, useRef } from 'react'
import { FadeUp } from '../../components/ui/MotionComponents'
import { AnimatePresence, motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import UnassignedTime from '../../components/time-tracking/UnassignedTime'
import WorkLinesEditor from '../../components/time-tracking/WorkLinesEditor'
import VersionConflictPanel from '../../components/time-tracking/VersionConflictPanel'
import LogMyDay from '../../components/time-tracking/LogMyDay'
import WorkSummary from '../../components/time-tracking/WorkSummary'
import { attendanceChanges, checkLines, detailsRequired, draftsFromEntry, linesPayload, newDraft, useWorkLineSuggestions, type WorkLineDraft } from '../../components/time-tracking/workLinesModel'
import type { HoursReportDownloadType, HoursReportEmployee, HoursReportParams, HoursReportResponse, PendingApprovalsSummary, TimeEntry as TimeEntryItem } from '../../lib/api'
import { Skeleton, SkeletonTimeEntry } from '../../components/ui/Skeleton'
import { FadeIn } from '../../components/ui/FadeIn'
import { formatDateISO } from '../../lib/dateUtils'
import { reportPeriodForPreset, reportPeriodFromSearchParams } from '../../lib/reportPeriods'
import ClockInOutCard from '../../components/time-tracking/ClockInOutCard'
import ApprovalQueue from '../../components/time-tracking/ApprovalQueue'
import WhosWorking from '../../components/time-tracking/WhosWorking'
import StuckClockEntries from '../../components/time-tracking/StuckClockEntries'
import HoursReportWorkspace, { type HoursReportFilters, type ReportView } from '../../components/time-tracking/HoursReportWorkspace'
import TimeEntryWorkFields, { CategoryFilterSelect, ClientPicker, PeriodPicker } from '../../components/time-tracking/TimeEntryWorkFields'
import { EMPTY_WORK_FIELDS, changedWorkFieldsPayload, useTimeEntryWorkOptions, workFieldsFromEntry, type WorkFieldsValue } from '../../components/time-tracking/timeEntryWorkForm'
import { buildHoursReportParams, normalizeReportFilters } from '../../lib/hoursReportParams'
import {
  categoryFilterValue,
  parseCategoryFilter,
  periodLabel,
  workCategory,
  workCategoryText,
  workSummary,
} from '../../lib/timeEntryWork'

// Local types to avoid Vite caching issues
interface TimeCategory {
  id: number
  name: string
  description: string | null
}

// Break duration presets
const BREAK_PRESETS = [
  { label: 'None', minutes: null },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: 'Custom', minutes: -1 }, // -1 indicates custom
]

const EMPTY_REPORT_QUALITY = {
  status: 'clear' as const,
  flagged_entries_count: 0,
  uncategorized_count: 0,
  missing_client_count: 0,
  missing_description_count: 0,
  long_shift_count: 0,
  overlapping_entry_count: 0,
  long_shift_threshold_hours: 12,
}

function normalizeHoursReport(report: HoursReportResponse): HoursReportResponse {
  return {
    ...report,
    quality: report.quality || EMPTY_REPORT_QUALITY,
    employees: report.employees.map(employee => ({
      ...employee,
      days_worked: employee.days_worked ?? employee.days.length,
      first_work_date: employee.first_work_date ?? employee.days[0]?.work_date ?? null,
      last_work_date: employee.last_work_date ?? employee.days[employee.days.length - 1]?.work_date ?? null,
      quality: employee.quality || EMPTY_REPORT_QUALITY,
      excluded_entries: employee.excluded_entries || [],
      days: employee.days.map(day => ({
        ...day,
        entries: day.entries.map(entry => ({ ...entry, review_flags: entry.review_flags || [] })),
      })),
    })),
  }
}

interface UserOption {
  id: number
  email: string
  display_name?: string
  full_name?: string
  role: string
  employment_status: 'active' | 'terminated'
  termination_effective_on: string | null
}

// Icons
const PlusIcon = () => (
  <svg className="h-5 w-5" fill="none" aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const ClockIcon = () => (
  <svg className="h-5 w-5" fill="none" aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const EditIcon = () => (
  <svg className="h-4 w-4" fill="none" aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

const TrashIcon = () => (
  <svg className="h-4 w-4" fill="none" aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const ChevronLeftIcon = () => (
  <svg className="h-5 w-5" fill="none" aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg className="h-5 w-5" fill="none" aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

const ChartIcon = () => (
  <svg className="h-5 w-5" fill="none" aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)

const LockIcon = () => (
  <svg className="h-3 w-3" fill="none" aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
)

// Helper functions
function formatDate(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

function getWeekDates(date: Date): Date[] {
  const start = new Date(date)
  const day = start.getDay()
  start.setDate(start.getDate() - day) // Start on Sunday
  
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    dates.push(d)
  }
  return dates
}

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate()
}

function formatBadgeCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}

function entryPeriodLabel(entry: TimeEntryItem): string | null {
  return entry.period_label || periodLabel(entry.period_type, entry.period_start)
}

export default function TimeTracking() {
  useEffect(() => { document.title = 'Time Tracking | Cornerstone Admin' }, [])

  const [searchParams, setSearchParams] = useSearchParams()
  const initialReportPeriod = reportPeriodFromSearchParams(searchParams, reportPeriodForPreset('this_month'))
  const [entries, setEntries] = useState<TimeEntryItem[]>([])
  const [entrySummary, setEntrySummary] = useState({ total_hours: 0, total_break_hours: 0, entry_count: 0 })
  const [categories, setCategories] = useState<TimeCategory[]>([])
  // Categories (with tasks) and the client picker list; errors stay visible with a retry.
  const workOptions = useTimeEntryWorkOptions()
  const { serviceTypes, clients } = workOptions
  const [users, setUsers] = useState<UserOption[]>([])
  const [pendingApprovalSummary, setPendingApprovalSummary] = useState<PendingApprovalsSummary | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Tab: entries, approvals, or reports
  const requestedTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<'entries' | 'day' | 'summary' | 'approvals' | 'unassigned' | 'reports'>(
    requestedTab === 'reports' || requestedTab === 'approvals' || requestedTab === 'unassigned' || requestedTab === 'day' || requestedTab === 'summary' ? requestedTab : 'entries'
  )
  const [unassignedRefresh, setUnassignedRefresh] = useState(0)
  const [modalVersionConflict, setModalVersionConflict] = useState(false)
  const [modalConflictEntry, setModalConflictEntry] = useState<TimeEntryItem | null>(null)
  
  // View mode: 'day' or 'week'. Phones open on Day: a seven-column week
  // doesn't fit at phone width. Wider screens open on Week.
  const [viewMode, setViewMode] = useState<'day' | 'week'>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches ? 'day' : 'week',
  )
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // Entries filters (for Time Entries tab)
  const emptyEntryFilters = {
    user_id: '',
    client_id: '',
    service_type_id: '',
    time_category_id: '',
    service_task_id: '',
    period_type: '' as WorkFieldsValue['period_type'],
    period_start: '',
  }
  const [entryFilters, setEntryFilters] = useState(emptyEntryFilters)
  const [showDenied, setShowDenied] = useState(false)
  
  // Report filters
  const [reportFilters, setReportFilters] = useState<HoursReportFilters>(() => normalizeReportFilters({
    start_date: initialReportPeriod.start,
    end_date: initialReportPeriod.end,
    user_id: searchParams.get('user_id') || '',
    time_category_id: searchParams.get('time_category_id') || '',
    client_id: searchParams.get('client_id') || '',
    service_type_id: searchParams.get('service_type_id') || '',
    service_task_id: searchParams.get('service_task_id') || '',
    period_type: searchParams.get('period_type') || '',
    period_start: searchParams.get('period_start') || '',
    status: searchParams.get('status') || '',
    entry_method: searchParams.get('entry_method') || '',
    overtime_status: searchParams.get('overtime_status') || '',
  }))
  const requestedReportView = searchParams.get('report_view')
  const [reportView, setReportView] = useState<ReportView>(requestedReportView === 'people' || requestedReportView === 'daily' || requestedReportView === 'review' ? requestedReportView : 'overview')
  const [reportData, setReportData] = useState<TimeEntryItem[]>([])
  const [hoursReport, setHoursReport] = useState<HoursReportResponse | null>(null)
  const [selectedReportEmployee, setSelectedReportEmployee] = useState<HoursReportEmployee | null>(null)
  const handleCloseEmployeeReportDrawer = useCallback(() => {
    setSelectedReportEmployee(null)
  }, [])
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportExporting, setReportExporting] = useState<HoursReportDownloadType | null>(null)
  const reportRequestId = useRef(0)
  
  // Period lock state (CST-43)
  const [currentWeekLocked, setCurrentWeekLocked] = useState(false)
  const [currentWeekLockId, setCurrentWeekLockId] = useState<number | null>(null)
  const [lockingWeek, setLockingWeek] = useState(false)
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimeEntryItem | null>(null)
  const [correctionReason, setCorrectionReason] = useState('')
  const [correctionReferences, setCorrectionReferences] = useState<string[]>([])
  const [requiresCorrectionReason, setRequiresCorrectionReason] = useState(false)
  const [formData, setFormData] = useState({
    work_date: formatDateISO(new Date()),
    start_time: '08:00',
    end_time: '17:00',
    user_id: '',
    break_minutes: null as number | null
  })
  // Client -> Category -> Task -> Period -> Comments
  const [workFields, setWorkFields] = useState<WorkFieldsValue>(EMPTY_WORK_FIELDS)
  const [saving, setSaving] = useState(false)

  // Calculate hours from start/end times and break
  const calculateHours = (start: string, end: string, breakMins: number | null): number => {
    if (!start || !end) return 0
    const [startH, startM] = start.split(':').map(Number)
    const [endH, endM] = end.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    let durationMinutes = endMinutes - startMinutes
    if (durationMinutes < 0) durationMinutes += 24 * 60 // Handle overnight
    if (breakMins) durationMinutes -= breakMins
    return Math.max(0, durationMinutes / 60)
  }

  const calculatedHours = calculateHours(formData.start_time, formData.end_time, formData.break_minutes)
  const [lines, setLines] = useState<WorkLineDraft[]>(() => [newDraft()])
  const [initialLines, setInitialLines] = useState<WorkLineDraft[]>(() => [newDraft()])
  const lineSuggestions = useWorkLineSuggestions(showModal, editingEntry?.user?.id ?? (formData.user_id ? Number(formData.user_id) : null))
  const editingActiveClock = Boolean(editingEntry && editingEntry.status !== 'completed')
  const editingDayLog = Boolean(editingEntry?.duration_only)
  // While the times are untouched, the stored hours are the target (a clock
  // entry's seconds can make them a minute off what the HH:MM fields give).
  const modalTimesUntouched = Boolean(editingEntry) && formData.start_time === (editingEntry?.start_time || '08:00') &&
    formData.end_time === (editingEntry?.end_time || '17:00') && formData.break_minutes === editingEntry?.break_minutes
  const modalTargetMinutes = editingDayLog
    ? null
    : modalTimesUntouched && editingEntry ? Math.round(editingEntry.hours * 60) : Math.round(calculatedHours * 60)
  const modalLinesRequired = detailsRequired(lineSuggestions.requiredFrom, formData.work_date)
  const modalLineCheck = checkLines(lines, { targetMinutes: modalTargetMinutes, required: modalLinesRequired, clients, serviceTypes, taskRequired: modalLinesRequired && lineSuggestions.taskRequired })
  const modalLinesChanged = JSON.stringify(linesPayload(lines, modalTargetMinutes)) !== JSON.stringify(linesPayload(initialLines, modalTargetMinutes))
  const modalHoursChanged = Boolean(editingEntry && !editingDayLog && Math.round(editingEntry.hours * 60) !== modalTargetMinutes)
  const modalSendsLines = !editingActiveClock && (!editingEntry || modalLinesChanged || (modalHoursChanged && lines.length > 1))

  // Owner display: "You" for self, real name for others
  const ownerLabel = (entry: TimeEntryItem): string => {
    if (!entry.user) return 'Former employee'
    const name = entry.user.display_name || entry.user.full_name || entry.user.email.split('@')[0]
    if (currentUserId && entry.user.id === currentUserId) return 'You'
    return name
  }

  const currentWeekStartIso = useCallback((): string => {
    const weekStart = new Date(currentDate)
    weekStart.setDate(currentDate.getDate() - currentDate.getDay())
    return formatDateISO(weekStart)
  }, [currentDate])

  const dateIsInLockedWeek = useCallback((dateLike: Date | string): boolean => {
    if (!currentWeekLocked) return false
    const date = typeof dateLike === 'string' ? new Date(`${dateLike}T00:00:00`) : dateLike
    const weekStart = new Date(currentDate)
    weekStart.setDate(currentDate.getDate() - currentDate.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    return date >= new Date(weekStart.toDateString()) && date <= new Date(weekEnd.toDateString())
  }, [currentDate, currentWeekLocked])

  // Load time entries
  const loadEntries = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params: Record<string, string | number> = { per_page: 500 }
      
      if (viewMode === 'day') {
        params.date = formatDateISO(currentDate)
      } else {
        // Get week start (Sunday)
        const weekStart = new Date(currentDate)
        weekStart.setDate(currentDate.getDate() - currentDate.getDay())
        params.week = formatDateISO(weekStart)
      }

      // Apply filters
      if (entryFilters.user_id) {
        params.user_id = parseInt(entryFilters.user_id)
      }
      if (entryFilters.time_category_id) {
        params.time_category_id = parseInt(entryFilters.time_category_id)
      }
      if (entryFilters.service_type_id) {
        params.service_type_id = parseInt(entryFilters.service_type_id)
      }
      if (entryFilters.service_task_id) {
        params.service_task_id = parseInt(entryFilters.service_task_id)
      }
      if (entryFilters.period_type && entryFilters.period_start) {
        params.period_type = entryFilters.period_type
        params.period_start = entryFilters.period_start
      }
      if (entryFilters.client_id) {
        params.client_id = parseInt(entryFilters.client_id)
      }

      const response = await api.getTimeEntries(params as unknown as Parameters<typeof api.getTimeEntries>[0])
      
      if (response.data) {
        setEntries(response.data.time_entries)
        setEntrySummary({
          total_hours: response.data.summary.total_hours,
          total_break_hours: response.data.summary.total_break_hours || 0,
          entry_count: response.data.summary.entry_count
        })
      } else {
        setError(response.error || 'Failed to load time entries')
      }
    } catch {
      setError('Failed to load time entries')
    } finally {
      setLoading(false)
    }
  }, [currentDate, viewMode, entryFilters])

  // Load categories, clients, and users
  const loadOptions = useCallback(async () => {
    try {
      const [catResponse, userResponse, currentUserResponse] = await Promise.all([
        api.getTimeCategories(),
        api.getUsers({ include_terminated: true }),
        api.getCurrentUser()
      ])

      if (catResponse.data) {
        setCategories(catResponse.data.time_categories as unknown as TimeCategory[])
      }

      if (userResponse.data) {
        setUsers(userResponse.data.users.map(u => ({
          id: u.id,
          email: u.email,
          display_name: u.display_name,
          full_name: u.full_name,
          role: u.role,
          employment_status: u.employment_status,
          termination_effective_on: u.termination_effective_on
        })))
      }

      if (currentUserResponse.data) {
        setIsAdmin(currentUserResponse.data.user.is_admin)
        setCurrentUserId(currentUserResponse.data.user.id)
      }
    } catch {
      console.error('Failed to load options')
    }
  }, [])

  const loadPendingApprovalSummary = useCallback(async () => {
    if (!isAdmin) {
      setPendingApprovalSummary(null)
      return
    }

    try {
      const response = await api.getPendingApprovals({ page: 1, per_page: 1 })
      if (response.data) {
        setPendingApprovalSummary(response.data.summary ?? null)
      }
    } catch {
      // The approvals queue itself will surface errors when opened.
    }
  }, [isAdmin])
  
  const loadWeekLockStatus = useCallback(async () => {
    try {
      const response = await api.getTimePeriodLockStatus(currentWeekStartIso())
      if (response.data) {
        setCurrentWeekLocked(response.data.locked)
        setCurrentWeekLockId(response.data.lock?.id ?? null)
      }
    } catch {
      // best-effort only
    }
  }, [currentWeekStartIso])

  const finalizeWeek = async () => {
    if (!isAdmin) return
    if (!confirm('Finalize and lock this week? No add/edit/delete will be allowed for this week.')) return

    setLockingWeek(true)
    try {
      const res = await api.lockTimePeriod(currentWeekStartIso(), 'Finalized from Time Tracking screen')
      if (res.error) {
        setError(res.error)
        return
      }
      await loadWeekLockStatus()
      await loadEntries()
    } finally {
      setLockingWeek(false)
    }
  }

  const unlockWeek = async () => {
    if (!isAdmin || !currentWeekLockId) return
    if (!confirm('Unlock this week? This re-opens add/edit/delete for this period.')) return

    setLockingWeek(true)
    try {
      const res = await api.unlockTimePeriod(currentWeekLockId)
      if (res.error) {
        setError(res.error)
        return
      }
      await loadWeekLockStatus()
      await loadEntries()
    } finally {
      setLockingWeek(false)
    }
  }

  // Load report data
  const loadReport = useCallback(async () => {
    const requestId = ++reportRequestId.current
    setReportLoading(true)
    setReportError(null)
    setHoursReport(null)
    setSelectedReportEmployee(null)
    setReportData([])

    try {
      const params = buildHoursReportParams(reportFilters)

      const response = await api.getHoursReport(params)
      if (requestId !== reportRequestId.current) return

      if (response.data) {
        const normalizedReport = normalizeHoursReport(response.data)
        setHoursReport(normalizedReport)
        setSelectedReportEmployee((current) => current ? normalizedReport.employees.find((employee) => employee.id === current.id) ?? null : null)

        const rows: TimeEntryItem[] = normalizedReport.employees.flatMap(employee =>
          employee.days.flatMap(day =>
            day.entries.map(entry => ({
              id: entry.id,
              work_date: entry.work_date,
              start_time: entry.start_time,
              end_time: entry.end_time,
              formatted_start_time: entry.formatted_start_time,
              formatted_end_time: entry.formatted_end_time,
              hours: entry.total_hours,
              regular_hours: entry.regular_hours,
              overtime_hours: entry.overtime_hours,
              break_minutes: entry.break_minutes,
              description: entry.description,
              entry_method: entry.entry_method as TimeEntryItem['entry_method'],
              status: 'completed' as const,
              admin_override: false,
              attendance_status: null,
              approval_status: entry.approval_status as TimeEntryItem['approval_status'],
              overtime_status: entry.overtime_status as TimeEntryItem['overtime_status'],
              approval_reasons: [],
              clock_in_at: null,
              clock_out_at: null,
              approved_by: entry.approved_by,
              approved_at: entry.approved_at,
              approval_note: null,
              overtime_approved_by: entry.overtime_approved_by,
              overtime_approved_at: entry.overtime_approved_at,
              overtime_note: null,
              schedule: null,
              breaks: entry.breaks.map(entryBreak => ({
                id: entryBreak.id,
                start_time: entryBreak.start_time || '',
                end_time: entryBreak.end_time,
                duration_minutes: entryBreak.duration_minutes,
                active: entryBreak.end_time === null,
              })),
              user: {
                id: employee.id,
                email: employee.email || '',
                display_name: employee.display_name,
                full_name: employee.full_name,
              },
              time_category: entry.time_category,
              client: entry.client,
              tax_return: entry.tax_return,
              service_type: entry.service_type ? { ...entry.service_type, color: entry.service_type.color ?? null } : null,
              service_task: entry.service_task,
              period_type: entry.period_type ?? null,
              period_start: entry.period_start ?? null,
              period_label: entry.period_label ?? null,
              linked_operation_task: null,
              locked_at: entry.locked_at,
              created_at: '',
              updated_at: '',
              review_flags: entry.review_flags,
            }))
          )
        )

        setReportData(rows)
      } else {
        setReportError(response.error || 'Unable to load this report')
      }
    } catch {
      if (requestId === reportRequestId.current) {
        setReportError('Unable to load this report')
      }
    } finally {
      if (requestId === reportRequestId.current) {
        setReportLoading(false)
      }
    }
  }, [reportFilters])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (activeTab === 'entries') next.delete('tab')
    else next.set('tab', activeTab)

    const reportKeys: Array<keyof HoursReportFilters> = [
      'start_date', 'end_date', 'user_id', 'time_category_id', 'client_id', 'service_type_id', 'service_task_id',
      'period_type', 'period_start', 'status', 'entry_method', 'overtime_status',
    ]
    if (activeTab === 'reports') {
      reportKeys.forEach(key => {
        const value = reportFilters[key]
        if (value) next.set(key, value)
        else next.delete(key)
      })
      next.set('report_view', reportView)
    } else {
      reportKeys.forEach(key => next.delete(key))
      next.delete('report_view')
    }

    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true })
  }, [activeTab, reportFilters, reportView, searchParams, setSearchParams])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  useEffect(() => {
    if (!isAdmin) {
      setPendingApprovalSummary(null)
      return
    }

    void loadPendingApprovalSummary()
    const interval = window.setInterval(() => {
      void loadPendingApprovalSummary()
    }, 60000)

    return () => window.clearInterval(interval)
  }, [isAdmin, loadPendingApprovalSummary])

  useEffect(() => {
    loadWeekLockStatus()
  }, [loadWeekLockStatus])
  
  useEffect(() => {
    if (activeTab === 'reports') {
      void loadReport()
    }

    return () => {
      reportRequestId.current += 1
    }
  }, [activeTab, loadReport])

  useEffect(() => {
    if (activeTab !== 'reports') {
      setSelectedReportEmployee(null)
    }
  }, [activeTab])

  // Handle prefill from schedule
  useEffect(() => {
    const prefill = searchParams.get('prefill')
    if (prefill === 'true') {
      const date = searchParams.get('date') || formatDateISO(new Date())
      const startTime = searchParams.get('start_time') || '08:00'
      const endTime = searchParams.get('end_time') || '17:00'
      const notes = searchParams.get('notes') || ''
      
      // Open modal with pre-filled data
      setEditingEntry(null)
      setFormData({
        work_date: date,
        start_time: startTime,
        end_time: endTime,
        user_id: currentUserId?.toString() || '',
        break_minutes: null
      })
      setWorkFields({ ...EMPTY_WORK_FIELDS, description: notes })
      setShowModal(true)
      
      // Clear the URL params
      setSearchParams({})
    }
  }, [currentUserId, searchParams, setSearchParams])

  // Navigation
  const goToToday = () => setCurrentDate(new Date())
  
  const goToPrevious = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1)
    } else {
      newDate.setDate(newDate.getDate() - 7)
    }
    setCurrentDate(newDate)
  }

  const goToNext = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setCurrentDate(newDate)
  }

  // Modal handlers
  const openNewEntry = (date?: Date, prefillStart?: string, prefillEnd?: string, prefillNotes?: string) => {
    if (dateIsInLockedWeek(date || currentDate)) {
      setError('This time period is locked and cannot be modified')
      return
    }

    setEditingEntry(null)
    setCorrectionReason('')
    setCorrectionReferences([])
    setRequiresCorrectionReason(false)
    setFormData({
      work_date: formatDateISO(date || currentDate),
      start_time: prefillStart || '08:00',
      end_time: prefillEnd || '17:00',
      user_id: currentUserId?.toString() || '',
      break_minutes: null
    })
    setWorkFields({ ...EMPTY_WORK_FIELDS, description: prefillNotes || '' })
    const fresh = [newDraft({ description: prefillNotes || '' })]
    setLines(fresh)
    setInitialLines(fresh)
    setShowModal(true)
  }

  const openEditEntry = (entry: TimeEntryItem) => {
    setEditingEntry(entry)
    setModalVersionConflict(false)
    setModalConflictEntry(null)
    setCorrectionReason('')
    setCorrectionReferences([])
    setRequiresCorrectionReason(false)
    setFormData({
      work_date: entry.work_date,
      start_time: entry.start_time || '08:00',
      end_time: entry.end_time || '17:00',
      user_id: entry.user?.id.toString() || '',
      break_minutes: entry.break_minutes
    })
    setWorkFields(workFieldsFromEntry(entry))
    const drafts = draftsFromEntry(entry)
    setLines(drafts)
    setInitialLines(drafts)
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (dateIsInLockedWeek(formData.work_date)) {
      setError('This time period is locked and cannot be modified')
      return
    }

    if (!editingEntry && isAdmin && !formData.user_id) {
      setError('Please select an entry owner')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Edits send only the attendance fields that changed (resending an
      // unchanged HH:MM would drop a clock entry's seconds and its approval).
      const timeFields = editingEntry ? attendanceChanges({
        workDate: [formData.work_date, editingEntry.work_date],
        startTime: editingDayLog ? null : [formData.start_time, editingEntry.start_time || '08:00'],
        endTime: editingDayLog || editingActiveClock ? null : [formData.end_time, editingEntry.end_time || '17:00'],
        breakMinutes: editingDayLog || editingActiveClock ? null : [formData.break_minutes, editingEntry.break_minutes],
      }) : {
        work_date: formData.work_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        break_minutes: formData.break_minutes
      }
      const linesField = modalSendsLines ? { work_lines: linesPayload(lines, modalTargetMinutes) } : {}

      const editPayload = editingEntry ? {
        ...timeFields,
        ...(editingActiveClock ? changedWorkFieldsPayload(workFieldsFromEntry(editingEntry), workFields) : linesField),
      } : {}

      if (editingEntry && Object.keys(editPayload).length === 0) {
        // Nothing changed: close without a request (an empty update is an error).
        setShowModal(false)
      } else if (editingEntry) {
        // Send only what the user changed so a concurrent edit is not overwritten.
        const response = await api.updateTimeEntry(editingEntry.id, editPayload, correctionReason, { expectedVersion: editingEntry.version })
        if (response.status === 409) {
          // Changed elsewhere since the modal opened: nothing was saved.
          // Refetch at once so the panel and the list show what is saved now.
          setModalVersionConflict(true)
          setModalConflictEntry(response.current_entry ?? null)
          void loadEntries()
          const fresh = await api.getTimeEntry(editingEntry.id)
          if (fresh.data?.time_entry) setModalConflictEntry(fresh.data.time_entry)
          return
        }
        if (response.error) {
          if (response.code === 'correction_reason_required') {
            setRequiresCorrectionReason(true)
            setCorrectionReferences(response.export_references || [])
          }
          setError(response.error)
          return
        }
      } else {
        const response = await api.createTimeEntry({
          work_date: formData.work_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          break_minutes: formData.break_minutes,
          ...linesField,
          user_id: isAdmin && formData.user_id ? parseInt(formData.user_id) : undefined,
        })
        if (response.error) {
          setError(response.error)
          return
        }
      }

      setShowModal(false)
      setCorrectionReason('')
      setCorrectionReferences([])
      setRequiresCorrectionReason(false)
      await loadEntries()
      await loadPendingApprovalSummary()
      if (activeTab === 'reports') await loadReport()
      if (activeTab === 'unassigned') setUnassignedRefresh((value) => value + 1)
    } catch {
      setError('Failed to save time entry')
    } finally {
      setSaving(false)
    }
  }

  // After a version conflict: keep the edited lines as their own day log.
  const saveModalLinesSeparately = async () => {
    if (!editingEntry) return
    setSaving(true)
    const response = await api.createTimeEntry({
      work_date: formData.work_date,
      work_lines: linesPayload(lines, null),
      additional_day_log: true,
      user_id: isAdmin && editingEntry.user ? editingEntry.user.id : undefined,
    })
    setSaving(false)
    if (response.error) {
      setError(response.error)
      return
    }
    setModalVersionConflict(false)
    setShowModal(false)
    await loadEntries()
  }

  const canDeleteEntry = (entry: TimeEntryItem): boolean => {
    if (dateIsInLockedWeek(entry.work_date) || !!entry.locked_at) return false
    if (isAdmin) return true
    return currentUserId === entry.user?.id
  }

  const handleDelete = async (entry: TimeEntryItem) => {
    if (!canDeleteEntry(entry)) {
      setError('This time entry cannot be deleted (locked or insufficient permissions)')
      return
    }

    if (!confirm('Are you sure you want to delete this time entry?')) return

    try {
      const response = await api.deleteTimeEntry(entry.id, correctionReason)
      if (response.error) {
        if (response.code === 'correction_reason_required') {
          openEditEntry(entry)
          setRequiresCorrectionReason(true)
          setCorrectionReferences(response.export_references || [])
        }
        setError(response.error)
        return
      }
      setShowModal(false)
      setEditingEntry(null)
      await loadEntries()
      await loadPendingApprovalSummary()
    } catch {
      setError('Failed to delete time entry')
    }
  }

  // Get week dates for week view
  const weekDates = getWeekDates(currentDate)

  // Filter out denied entries unless toggle is on
  const visibleEntries = showDenied
    ? entries
    : entries.filter(e => e.approval_status !== 'denied')

  // Group entries by date for week view
  const entriesByDate = visibleEntries.reduce((acc, entry) => {
    const date = entry.work_date
    if (!acc[date]) acc[date] = []
    acc[date].push(entry)
    return acc
  }, {} as Record<string, TimeEntryItem[]>)

  // Calculate hours per day
  const hoursPerDay = weekDates.reduce((acc, date) => {
    const dateStr = formatDateISO(date)
    const dayEntries = entriesByDate[dateStr] || []
    acc[dateStr] = dayEntries.reduce((sum, e) => sum + e.hours, 0)
    return acc
  }, {} as Record<string, number>)

  const deniedCount = entries.filter(e => e.approval_status === 'denied').length
  const deniedHours = entries.filter(e => e.approval_status === 'denied').reduce((sum, e) => sum + e.hours, 0)
  const visibleTotalHours = showDenied ? entrySummary.total_hours : entrySummary.total_hours - deniedHours

  const activeUsers = users.filter(user => user.employment_status === 'active')
  const pendingApprovalCount = pendingApprovalSummary?.entry_count ?? 0
  const pendingOvertimeApprovalCount = pendingApprovalSummary?.pending_overtime_count ?? 0

  const currentReportParams = (): HoursReportParams => buildHoursReportParams(reportFilters)

  const saveReportDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const downloadReport = async (type: HoursReportDownloadType, acknowledgeDraft = false) => {
    setReportExporting(type)
    setReportError(null)
    try {
      const response = await api.downloadHoursReport(type, currentReportParams(), acknowledgeDraft)
      if (response.code === 'draft_acknowledgement_required' && !acknowledgeDraft) {
        const confirmed = confirm('This report has pending approvals or open clocks. Download a clearly marked draft anyway?')
        if (confirmed) await downloadReport(type, true)
        return
      }
      if (response.error || !response.blob) {
        setReportError(response.error || 'Unable to download report')
        return
      }
      saveReportDownload(response.blob, response.filename || 'Cornerstone_Report')
    } finally {
      setReportExporting(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeUp>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark tracking-tight">Time Tracking</h1>
          <p className="text-text-muted mt-1">Track your hours by category and client</p>
        </div>
        {activeTab === 'entries' && (
          <button
            onClick={() => openNewEntry()}
            disabled={currentWeekLocked}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
            title={currentWeekLocked ? 'This week is locked' : 'Log Time'}
          >
            <PlusIcon />
            <span>Log Time</span>
          </button>
        )}
      </div>
      </FadeUp>

      {/* Clock In/Out Card - full width, horizontal on desktop */}
      <ClockInOutCard onStatusChange={() => {
        void loadEntries()
        void loadPendingApprovalSummary()
      }} />

      {/* Admin live status */}
      {isAdmin && activeTab !== 'approvals' && (
        <WhosWorking />
      )}

      {/* Admin: clock entries left open with an end time */}
      {isAdmin && (
        <StuckClockEntries onResolved={() => {
          void loadEntries()
          void loadPendingApprovalSummary()
        }} />
      )}
      
      {workOptions.error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{workOptions.error} Categories, tasks or clients may be missing from the forms and filters below.</span>
          <button type="button" onClick={workOptions.retry} className="min-h-11 rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-100">
            Try again
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-neutral-warm">
        <nav className="flex gap-4 overflow-x-auto" aria-label="Time tracking sections">
          <button
            onClick={() => setActiveTab('entries')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'entries'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-primary-dark'
            }`}
          >
            <ClockIcon />
            Time Entries
          </button>
          <button
            onClick={() => setActiveTab('day')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'day'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-primary-dark'
            }`}
          >
            <ClockIcon />
            Log my day
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'summary'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-primary-dark'
            }`}
          >
            <ChartIcon />
            {isAdmin ? 'Work summary' : 'My summary'}
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('approvals')}
              aria-label={pendingApprovalCount > 0 ? `Approvals, ${pendingApprovalCount} pending` : 'Approvals'}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'approvals'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-primary-dark'
              }`}
            >
              <ClockIcon />
              <span>Approvals</span>
              {pendingApprovalCount > 0 && (
                <span className="relative inline-flex items-center" title={`${pendingApprovalCount} pending approval${pendingApprovalCount === 1 ? '' : 's'}${pendingOvertimeApprovalCount > 0 ? ` · ${pendingOvertimeApprovalCount} OT` : ''}`}>
                  <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-amber-400 opacity-30" aria-hidden="true" />
                  <span className="relative inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-1.5 text-[11px] font-bold leading-none text-amber-700 shadow-sm">
                    {formatBadgeCount(pendingApprovalCount)}
                  </span>
                </span>
              )}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('unassigned')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'unassigned'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-primary-dark'
              }`}
            >
              <ClockIcon />
              Unassigned
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('reports')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'reports'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-primary-dark'
              }`}
            >
              <ChartIcon />
              Reports
            </button>
          )}
        </nav>
      </div>

      {/* Entries Tab */}
      {activeTab === 'entries' && (
      <>
      {/* Filters (Admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-warm p-4 hover:shadow-md transition-shadow duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label htmlFor="entry-filter-employee" className="block text-sm text-text-muted mb-1">Employee</label>
              <select
                id="entry-filter-employee"
                value={entryFilters.user_id}
                onChange={(e) => setEntryFilters({ ...entryFilters, user_id: e.target.value })}
                className="min-h-11 w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">All Employees</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.display_name || user.email.split('@')[0]}</option>
                ))}
              </select>
            </div>
            <ClientPicker
              id="entry-filter-client"
              value={entryFilters.client_id}
              onChange={(client_id) => setEntryFilters({ ...entryFilters, client_id })}
              clients={clients}
              emptyLabel="All Clients"
              searchable={false}
              labelClassName="block text-sm text-text-muted mb-1"
              className="min-h-11 w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white"
            />
            <div>
              <label htmlFor="entry-filter-category" className="block text-sm text-text-muted mb-1">Category</label>
              <CategoryFilterSelect
                id="entry-filter-category"
                serviceTypes={serviceTypes}
                legacyCategories={categories}
                value={categoryFilterValue(entryFilters.service_type_id, entryFilters.time_category_id)}
                onChange={(value) => setEntryFilters({ ...entryFilters, ...parseCategoryFilter(value), service_task_id: '' })}
                className="min-h-11 w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>
            <div>
              <label htmlFor="entry-filter-task" className="block text-sm text-text-muted mb-1">Task</label>
              <select
                id="entry-filter-task"
                value={entryFilters.service_task_id}
                disabled={!entryFilters.service_type_id}
                onChange={(e) => setEntryFilters({ ...entryFilters, service_task_id: e.target.value })}
                className="min-h-11 w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:bg-neutral-warm/30 disabled:text-text-muted"
              >
                <option value="">All Tasks</option>
                {(serviceTypes.find(type => String(type.id) === entryFilters.service_type_id)?.tasks || []).map(task => (
                  <option key={task.id} value={task.id}>{task.name}</option>
                ))}
              </select>
            </div>
            <PeriodPicker
              idPrefix="entry-filter"
              hint=""
              emptyLabel="Any Period"
              stacked
              value={entryFilters}
              referenceDate={formatDateISO(currentDate)}
              onChange={(period) => setEntryFilters({ ...entryFilters, ...period })}
              labelClassName="block text-sm text-text-muted mb-1"
              className="min-h-11 w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white"
            />
          </div>
          {/* Clear filters button */}
          {Object.values(entryFilters).some(Boolean) && (
            <button
              onClick={() => setEntryFilters(emptyEntryFilters)}
              className="mt-3 text-sm text-primary hover:text-primary-dark font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* View Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-warm p-4 hover:shadow-md transition-shadow duration-300">
        {/* Mobile Layout */}
        <div className="flex flex-col gap-4 sm:hidden">
          {/* Top row: Date range and total */}
          <div className="text-center">
            <div className="font-semibold text-primary-dark">
              {viewMode === 'day'
                ? currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                : `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              }
            </div>
            <div className="text-sm text-primary-dark">
              Total: <span className="font-semibold text-primary">{visibleTotalHours.toFixed(1)} hours</span>
            </div>
          </div>
          {/* Bottom row: Toggle + Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex rounded-lg overflow-hidden border border-neutral-warm">
              <button
                onClick={() => setViewMode('day')}
                aria-pressed={viewMode === 'day'}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'day'
                    ? 'bg-primary text-white'
                    : 'bg-white text-primary-dark'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setViewMode('week')}
                aria-pressed={viewMode === 'week'}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'week'
                    ? 'bg-primary text-white'
                    : 'bg-white text-primary-dark'
                }`}
              >
                Week
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrevious}
                className="p-2 text-primary-dark hover:bg-neutral-warm rounded-lg"
              >
                <ChevronLeftIcon />
              </button>
              <button
                onClick={goToToday}
                className={`px-2 py-1 text-sm font-medium rounded-lg ${
                  isSameDay(currentDate, new Date())
                    ? 'bg-primary text-white'
                    : 'text-primary-dark hover:bg-neutral-warm'
                }`}
              >
                Today
              </button>
              <button
                onClick={goToNext}
                className="p-2 text-primary-dark hover:bg-neutral-warm rounded-lg"
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:grid grid-cols-3 items-center gap-4">
          {/* View Mode Toggle - Left */}
          <div className="flex rounded-lg overflow-hidden border border-neutral-warm w-fit">
            <button
              onClick={() => setViewMode('day')}
              aria-pressed={viewMode === 'day'}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'day'
                  ? 'bg-primary text-white'
                  : 'bg-white text-primary-dark hover:bg-neutral-warm'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              aria-pressed={viewMode === 'week'}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-primary text-white'
                  : 'bg-white text-primary-dark hover:bg-neutral-warm'
              }`}
            >
              Week
            </button>
          </div>

          {/* Date Navigation - Center */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={goToPrevious}
              className="p-2 text-primary-dark hover:text-primary hover:bg-neutral-warm rounded-lg transition-colors"
            >
              <ChevronLeftIcon />
            </button>
            <button
              onClick={goToToday}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isSameDay(currentDate, new Date())
                  ? 'bg-primary text-white'
                  : 'text-primary-dark hover:text-primary hover:bg-neutral-warm'
              }`}
            >
              Today
            </button>
            <button
              onClick={goToNext}
              className="p-2 text-primary-dark hover:text-primary hover:bg-neutral-warm rounded-lg transition-colors"
            >
              <ChevronRightIcon />
            </button>
          </div>

          {/* Current Date Display - Right */}
          <div className="text-right">
            <div className="font-semibold text-primary-dark">
              {viewMode === 'day'
                ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                : `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              }
            </div>
            <div className="text-sm text-primary-dark">
              Total: <span className="font-semibold text-primary">{visibleTotalHours.toFixed(1)} hours</span>
            </div>
          </div>
        </div>
      </div>

      {/* Week Lock Controls */}
      <div className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${currentWeekLocked ? 'bg-amber-50 border-amber-200' : 'bg-white border-neutral-warm'}`}>
        <div className="text-sm">
          {currentWeekLocked ? (
            <span className="text-amber-700 font-medium">This week is finalized and locked. Adding, editing, and deleting time entries is disabled.</span>
          ) : (
            <span className="text-primary-dark">This week is currently open for time entry changes.</span>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {!currentWeekLocked ? (
              <button
                onClick={finalizeWeek}
                disabled={lockingWeek}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {lockingWeek ? 'Locking...' : 'Finalize Week'}
              </button>
            ) : (
              <button
                onClick={unlockWeek}
                disabled={lockingWeek}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {lockingWeek ? 'Unlocking...' : 'Unlock Week'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Denied entries toggle */}
      {deniedCount > 0 && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowDenied(!showDenied)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              showDenied
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-white border-neutral-warm text-text-muted hover:text-primary-dark hover:border-primary/30'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {showDenied ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878l4.242 4.242M21 21l-4.35-4.35" />
              )}
            </svg>
            {showDenied ? `Showing ${deniedCount} denied` : `${deniedCount} denied hidden`}
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-warm overflow-hidden hover:shadow-md transition-shadow duration-300">
          {/* Header skeleton */}
          <div className="p-4 border-b border-neutral-warm">
            <div className="flex items-center justify-between">
              <Skeleton height={20} className="w-32" />
              <Skeleton height={32} className="w-24 rounded-lg" />
            </div>
          </div>
          {/* Week view skeleton */}
          <div className="grid grid-cols-7 border-b border-neutral-warm">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="p-3 text-center border-r border-neutral-warm last:border-r-0">
                <Skeleton height={14} className="w-12 mx-auto mb-2" />
                <Skeleton height={24} className="w-8 mx-auto rounded-full" />
              </div>
            ))}
          </div>
          {/* Content skeleton */}
          <div className="divide-y divide-neutral-warm">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonTimeEntry key={i} />
            ))}
          </div>
        </div>
      ) : viewMode === 'week' ? (
        /* Week View */
        <FadeIn>
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-warm overflow-hidden hover:shadow-md transition-shadow duration-300">
          <div className="overflow-x-auto">
            {/* Week Header */}
            <div className="grid grid-cols-7 border-b border-neutral-warm min-w-[600px]">
              {weekDates.map((date, idx) => {
                const dateStr = formatDateISO(date)
                const isToday = isSameDay(date, new Date())
                const dayHours = hoursPerDay[dateStr] || 0
                
                return (
                  <div
                    key={idx}
                    className={`p-2 sm:p-3 text-center border-r border-neutral-warm last:border-r-0 ${
                      isToday ? 'bg-primary/20 border-b-2 border-b-primary' : ''
                    }`}
                  >
                    <div className={`text-xs font-semibold uppercase ${isToday ? 'text-primary' : 'text-primary-dark'}`}>
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={`text-base sm:text-lg font-bold ${isToday ? 'text-primary' : 'text-primary-dark'}`}>
                      {date.getDate()}
                    </div>
                    <div className={`text-xs font-semibold ${isToday ? 'text-primary' : (dayHours > 0 ? 'text-primary' : 'text-primary-dark')}`}>
                      {dayHours.toFixed(1)}h
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Week Entries */}
            <div className="grid grid-cols-7 min-h-[250px] sm:min-h-[300px] min-w-[600px]">
              {weekDates.map((date, idx) => {
                const dateStr = formatDateISO(date)
                const dayEntries = entriesByDate[dateStr] || []
                const isToday = isSameDay(date, new Date())
                
                return (
                  <div
                    key={idx}
                    className={`border-r border-neutral-warm last:border-r-0 p-1 sm:p-2 ${
                      isToday ? 'bg-primary/10' : ''
                    }`}
                  >
                    {dayEntries.map(entry => (
                      <div
                        key={entry.id}
                        className={`mb-1 sm:mb-2 p-1 sm:p-2 bg-white border rounded text-xs cursor-pointer hover:bg-neutral-warm/50 transition-colors shadow-sm ${entry.locked_at ? 'border-amber-300 bg-amber-50/30' : 'border-neutral-warm'}`}
                        onClick={() => openEditEntry(entry)}
                      >
                        <div className="font-bold text-primary-dark flex items-center gap-1">
                          {entry.locked_at ? <LockIcon /> : <ClockIcon />}
                          {entry.hours}h
                          {entry.approval_status === 'pending' && (
                            <span className="ml-auto w-2 h-2 rounded-full bg-amber-500" title="Pending approval" />
                          )}
                          {entry.approval_status === 'denied' && (
                            <span className="ml-auto w-2 h-2 rounded-full bg-red-500" title="Denied" />
                          )}
                          {entry.overtime_status === 'pending' && (
                            <span className="ml-auto w-2 h-2 rounded-full bg-orange-500" title="Overtime pending" />
                          )}
                        </div>
                        {entry.entry_method === 'clock' && (
                          <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">CLOCK</div>
                        )}
                        {entry.formatted_start_time && entry.formatted_end_time && (
                          <div className="text-primary-dark/70 text-[10px]">
                            {entry.formatted_start_time} - {entry.formatted_end_time}
                          </div>
                        )}
                        {entry.client && (
                          <div className="text-primary-dark font-medium truncate text-[10px] sm:text-xs" title={entry.client.name}>{entry.client.name}</div>
                        )}
                        {workCategory(entry) && (
                          <div className="text-primary font-medium truncate text-[10px] sm:text-xs" title={[workCategoryText(entry), entry.service_task?.name].filter(Boolean).join(' / ')}>
                            {workCategoryText(entry)}{entry.service_task ? ` / ${entry.service_task.name}` : ''}
                          </div>
                        )}
                        {entryPeriodLabel(entry) && (
                          <div className="text-primary-dark/70 truncate text-[10px]">{entryPeriodLabel(entry)}</div>
                        )}
                        <div className="text-primary-dark/70 truncate text-[10px] mt-0.5 sm:mt-1">{ownerLabel(entry)}</div>
                        {entry.approval_note && (
                          <div className="text-[9px] text-text-muted italic truncate mt-0.5" title={entry.approval_note}>
                            "{entry.approval_note}"
                          </div>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => openNewEntry(date)}
                      disabled={currentWeekLocked}
                      className="w-full p-1 sm:p-2 text-xs text-primary-dark font-medium hover:text-primary hover:bg-neutral-warm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={currentWeekLocked ? 'This week is locked' : 'Add time entry'}
                    >
                      + Add
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        </FadeIn>
      ) : (
        /* Day View */
        <FadeIn>
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-warm hover:shadow-md transition-shadow duration-300">
          {visibleEntries.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 text-primary-dark">
                <ClockIcon />
              </div>
              <p className="text-primary-dark font-medium">No time entries for this day</p>
              <button
                onClick={() => openNewEntry()}
                className="mt-4 text-primary hover:text-primary-dark font-semibold"
              >
                Log your first entry
              </button>
            </div>
          ) : (
            <div className="divide-y divide-neutral-warm">
              {visibleEntries.map(entry => (
                <div key={entry.id} className={`p-3 sm:p-4 ${entry.locked_at ? 'bg-amber-50/30' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Hours + Time + Category Row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 sm:px-3 py-1 font-bold rounded-full text-sm ${entry.locked_at ? 'bg-amber-100 text-amber-700' : 'bg-primary/20 text-primary'}`}>
                          {entry.locked_at ? <LockIcon /> : <ClockIcon />}
                          {entry.hours}h
                        </span>
                        {entry.formatted_start_time && entry.formatted_end_time && (
                          <span className="text-xs sm:text-sm text-primary-dark/70">
                            {entry.formatted_start_time} - {entry.formatted_end_time}
                          </span>
                        )}
                        {entry.locked_at && (
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 font-medium text-xs rounded">
                            Locked
                          </span>
                        )}
                        {entry.entry_method === 'clock' && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-medium text-xs rounded">
                            Clock
                          </span>
                        )}
                        {entry.approval_status === 'pending' && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 font-medium text-xs rounded">
                            Pending
                          </span>
                        )}
                        {entry.approval_status === 'denied' && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 font-medium text-xs rounded">
                            Denied
                          </span>
                        )}
                        {entry.overtime_status === 'pending' && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 font-medium text-xs rounded">
                            OT Pending
                          </span>
                        )}
                      </div>
                      {/* Client -> Category -> Task -> Period */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
                        <span className="font-semibold text-primary-dark">
                          {entry.client ? entry.client.name : 'Internal'}
                          {entry.tax_return && ` (${entry.tax_return.tax_year})`}
                        </span>
                        {workCategory(entry) ? (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary font-medium rounded">
                            {workCategory(entry)?.label}
                            {workCategory(entry)?.legacy && <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Legacy</span>}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-neutral-warm/50 text-text-muted rounded">Uncategorized</span>
                        )}
                        {entry.service_task && <span className="px-2 py-0.5 bg-secondary/60 text-primary-dark rounded">{entry.service_task.name}</span>}
                        {entryPeriodLabel(entry) && <span className="px-2 py-0.5 border border-neutral-warm text-primary-dark rounded">{entryPeriodLabel(entry)}</span>}
                      </div>
                      {/* Owner */}
                      <p className="mt-1 text-xs sm:text-sm text-primary-dark/80 truncate">
                        by {ownerLabel(entry)}
                      </p>
                      {/* Comments */}
                      {entry.description && (
                        <p className="mt-2 text-primary-dark text-sm">{entry.description}</p>
                      )}
                      {/* Approval info */}
                      {entry.approved_by && (
                        <div className="mt-2 text-xs text-text-muted border-t border-neutral-warm/50 pt-2">
                          <span className={entry.approval_status === 'approved' ? 'text-emerald-600' : 'text-red-500'}>
                            {entry.approval_status === 'approved' ? 'Approved' : 'Denied'} by {entry.approved_by.full_name}
                          </span>
                          {entry.approval_note && (
                            <p className="mt-0.5 text-primary-dark/70 italic">"{entry.approval_note}"</p>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditEntry(entry)}
                        disabled={!!entry.locked_at}
                        className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${entry.locked_at ? 'text-gray-300 cursor-not-allowed' : 'text-primary-dark hover:text-primary hover:bg-neutral-warm'}`}
                        title={entry.locked_at ? 'This entry is locked' : 'Edit entry'}
                        aria-label={entry.locked_at ? 'This entry is locked' : 'Edit entry'}
                      >
                        <EditIcon />
                      </button>
                      <button
                        onClick={() => handleDelete(entry)}
                        disabled={!canDeleteEntry(entry)}
                        className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${!canDeleteEntry(entry) ? 'text-gray-300 cursor-not-allowed' : 'text-primary-dark hover:text-red-600 hover:bg-red-50'}`}
                        title={!canDeleteEntry(entry) ? 'This entry is locked/finalized or cannot be deleted' : 'Delete entry'}
                        aria-label={!canDeleteEntry(entry) ? 'Delete entry (locked)' : 'Delete entry'}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </FadeIn>
      )}

      </>
      )}

      {/* Approvals Tab */}
      {activeTab === 'approvals' && isAdmin && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-warm bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold text-primary-dark">Approval Review</h2>
            <p className="mt-1 text-sm text-text-muted">Filter pending time, edit exceptions inline, and approve entries in batches.</p>
          </div>
          <ApprovalQueue
            onUpdate={() => {
              void loadEntries()
              void loadPendingApprovalSummary()
            }}
            canDeleteEntry={(entry) => entry.user ? canDeleteEntry(entry) : false}
            clients={clients}
            serviceTypes={serviceTypes}
            catalogError={workOptions.error}
            onRetryCatalog={workOptions.retry}
          />
        </div>
      )}

      {/* Log my day: quick per-day grid of client lines */}
      {activeTab === 'day' && (
        <LogMyDay
          userId={currentUserId}
          clients={clients}
          serviceTypes={serviceTypes}
          catalogError={workOptions.error}
          onRetryCatalog={workOptions.retry}
          onSaved={() => {
            void loadEntries()
            if (isAdmin) void loadPendingApprovalSummary()
          }}
        />
      )}

      {/* Pay-period work summary with CSV/PDF */}
      {activeTab === 'summary' && (
        <WorkSummary currentUserId={currentUserId} isAdmin={isAdmin} users={users} />
      )}

      {/* Unassigned time (admin clean-up) */}
      {activeTab === 'unassigned' && isAdmin && (
        <UnassignedTime users={users} onEditEntry={openEditEntry} refreshKey={unassignedRefresh} />
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && isAdmin && (
        <>
          <HoursReportWorkspace
            filters={reportFilters}
            onFiltersChange={setReportFilters}
            report={hoursReport}
            entries={reportData}
            loading={reportLoading}
            error={reportError}
            users={users}
            categories={categories}
            serviceTypes={serviceTypes}
            clients={clients}
            exporting={reportExporting}
            onExport={(type) => void downloadReport(type)}
            onOpenEmployee={setSelectedReportEmployee}
            onEditEntry={openEditEntry}
            view={reportView}
            onViewChange={setReportView}
          />
          <EmployeeReportDrawer
            employee={selectedReportEmployee}
            overtimePolicy={hoursReport?.overtime_policy ?? null}
            onClose={handleCloseEmployeeReportDrawer}
          />
        </>
      )}

      {/* Entry Modal: mounted for every tab so Unassigned and Reports can open it */}
      <AnimatePresence>
      {showModal && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false)
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="time-entry-modal-title"
            className="h-[100dvh] w-full overflow-y-auto overscroll-contain bg-white shadow-xl md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-2xl xl:max-w-5xl">
            <div className="p-4 md:p-6">
              <h2 id="time-entry-modal-title" className="text-xl font-bold text-primary-dark mb-1">
                {editingEntry ? 'Edit Time Entry' : 'Log Time'}
              </h2>
              {editingEntry && (
                <div className="mb-4">
                  <p className="text-sm text-primary-dark/70">
                    Entry for: <span className="font-medium text-primary-dark">{ownerLabel(editingEntry)}</span>
                  </p>
                  {editingEntry.locked_at && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                      <LockIcon />
                      <span>This entry is locked and cannot be edited.</span>
                    </div>
                  )}
                  {editingEntry.approved_by && (
                    <div className={`mt-2 px-3 py-2 rounded-lg text-sm border ${
                      editingEntry.approval_status === 'approved'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      <span className="font-medium">
                        {editingEntry.approval_status === 'approved' ? 'Approved' : 'Denied'}
                      </span>
                      {' '}by {editingEntry.approved_by.full_name}
                      {editingEntry.approval_note && (
                        <p className="mt-1 text-xs italic opacity-80">"{editingEntry.approval_note}"</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {!editingEntry && <div className="mb-4" />}
              
              <form onSubmit={handleSubmit} className="space-y-4">
              <fieldset disabled={!!(editingEntry?.locked_at)} className={`space-y-4 ${editingEntry?.locked_at ? 'opacity-60' : ''}`}>
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.work_date}
                    onChange={(e) => setFormData({ ...formData, work_date: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>

                {editingDayLog ? (
                  <p className="rounded-lg bg-neutral-warm/30 p-3 text-sm text-primary-dark">
                    Day log without clock times: its hours are the total of the work lines below.
                  </p>
                ) : (<>
                {/* Time Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      Start Time *
                    </label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      End Time *
                    </label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                
                {/* Calculated Hours Display */}
                <div className="bg-neutral-warm/30 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm text-primary-dark">Calculated Hours:</span>
                  <span className="text-lg font-bold text-primary">{calculatedHours.toFixed(2)}h</span>
                </div>

                {/* Entry Owner (admin create only) */}
                {isAdmin && !editingEntry && (
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      Entry Owner
                    </label>
                    <select
                      value={formData.user_id}
                      onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Select user...</option>
                      {activeUsers.map(user => (
                        <option key={user.id} value={user.id}>
                          {(user.full_name || user.display_name || user.email)} ({user.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Break Duration */}
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Break Duration
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {BREAK_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          if (preset.minutes === -1) {
                            // Custom - keep current value or set to empty for custom input
                            setFormData({ ...formData, break_minutes: formData.break_minutes || 0 })
                          } else {
                            setFormData({ ...formData, break_minutes: preset.minutes })
                          }
                        }}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          (preset.minutes === null && formData.break_minutes === null) ||
                          (preset.minutes === formData.break_minutes) ||
                          (preset.minutes === -1 && formData.break_minutes !== null && !BREAK_PRESETS.slice(0, -1).some(p => p.minutes === formData.break_minutes))
                            ? 'bg-primary text-white'
                            : 'bg-neutral-warm text-primary-dark hover:bg-primary/20'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  {/* Custom input - show when a value is set that's not a preset, or when Custom is selected */}
                  {formData.break_minutes !== null && !BREAK_PRESETS.slice(0, -1).some(p => p.minutes === formData.break_minutes) && (
                    <input
                      type="number"
                      min="0"
                      aria-label="Custom break duration in minutes"
                      max="480"
                      value={formData.break_minutes || ''}
                      onChange={(e) => setFormData({ ...formData, break_minutes: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Minutes"
                      className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  )}
                  <p className="text-xs text-text-muted mt-1">Break time is not counted toward work hours</p>
                </div>

                </>)}

                {/* Work details: Client -> Category -> Task -> Period -> Comments */}
                <div className="border-t border-neutral-warm pt-4">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-text-muted">Work details</h3>
                  {editingActiveClock ? (
                    <TimeEntryWorkFields
                      idPrefix="log-time"
                      value={workFields}
                      onChange={setWorkFields}
                      clients={clients}
                      serviceTypes={serviceTypes}
                      current={editingEntry}
                      referenceDate={formData.work_date}
                      loadError={workOptions.error}
                      onRetry={workOptions.retry}
                    />
                  ) : (
                    <>
                      {workOptions.error && (
                        <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                          <span>{workOptions.error}</span>
                          <button type="button" onClick={workOptions.retry} className="min-h-11 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-700">Try again</button>
                        </div>
                      )}
                      {editingEntry?.time_category && !editingEntry.service_type && (
                        <p className="mb-3 rounded-lg bg-secondary/40 px-3 py-2 text-sm text-primary-dark">
                          Legacy category: <span className="font-semibold">{editingEntry.time_category.name}</span>. It stays on this entry.
                        </p>
                      )}
                      <WorkLinesEditor
                        idPrefix="log-time"
                        lines={lines}
                        onChange={setLines}
                        targetMinutes={modalTargetMinutes}
                        clients={clients}
                        serviceTypes={serviceTypes}
                        suggestions={lineSuggestions}
                        required={modalLinesRequired}
                        referenceDate={formData.work_date}
                        mode={editingDayLog ? 'day' : 'session'}
                      />
                    </>
                  )}
                </div>

                {editingEntry && requiresCorrectionReason && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <label htmlFor="time-entry-correction-reason" className="block text-sm font-semibold text-amber-900">
                      Correction reason *
                    </label>
                    <p className="mt-1 text-xs leading-relaxed text-amber-800">
                      This entry appears in a previously exported report. Explain the correction so the earlier export can be marked stale with a clear audit trail.
                    </p>
                    {correctionReferences.length > 0 && (
                      <p className="mt-2 break-all text-xs font-medium text-amber-900">Affected: {correctionReferences.join(', ')}</p>
                    )}
                    <textarea
                      id="time-entry-correction-reason"
                      value={correctionReason}
                      onChange={(event) => setCorrectionReason(event.target.value)}
                      rows={3}
                      required
                      placeholder="What changed, why, and who confirmed it?"
                      className="mt-2 w-full resize-none rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}

              </fieldset>
                {modalVersionConflict && editingEntry && (
                  <VersionConflictPanel
                    title="This entry was changed elsewhere after you opened it."
                    detail="Nothing was saved, so that change isn’t overwritten."
                    busy={saving}
                    canSaveSeparately={Object.keys(modalLineCheck.problems).length === 0}
                    onSaveSeparately={() => void saveModalLinesSeparately()}
                    current={modalConflictEntry}
                    onDiscard={() => {
                      setModalVersionConflict(false)
                      setShowModal(false)
                      void loadEntries()
                    }}
                  />
                )}
                {/* Actions */}
                <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-neutral-warm bg-white px-4 py-3 md:static md:mx-0 md:border-0 md:px-0 md:pt-4">
                  <div>
                    {editingEntry && (
                      <button
                        type="button"
                        onClick={() => handleDelete(editingEntry)}
                        disabled={!canDeleteEntry(editingEntry)}
                        className={`px-4 py-2 rounded-lg transition-colors ${canDeleteEntry(editingEntry) ? 'text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'}`}
                        title={canDeleteEntry(editingEntry) ? 'Delete this time entry' : 'This entry is locked or cannot be deleted'}
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 text-primary-dark font-medium hover:bg-neutral-warm rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    {!(editingEntry?.locked_at) && (
                      <button
                        type="submit"
                        disabled={saving || (modalSendsLines && !modalLineCheck.canSubmit)}
                        className="min-h-11 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : (editingEntry ? 'Update' : 'Save')}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

    </div>
  )
}

function ReportMetric({ label, value, emphasize = false, tone = 'normal' }: { label: string; value: string; emphasize?: boolean; tone?: 'normal' | 'warning' }) {
  return (
    <div className="rounded-2xl border border-neutral-warm bg-white p-4 shadow-sm">
      <div className="text-sm text-text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${emphasize ? 'text-primary' : tone === 'warning' ? 'text-orange-700' : 'text-primary-dark'}`}>{value}</div>
    </div>
  )
}

function EmployeeReportDrawer({
  employee,
  overtimePolicy,
  onClose,
}: {
  employee: HoursReportEmployee | null
  overtimePolicy: HoursReportResponse['overtime_policy'] | null
  onClose: () => void
}) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const titleId = 'cornerstone-employee-report-drawer-title'
  const dailyThreshold = overtimePolicy?.daily_threshold_hours ?? 8
  const weeklyThreshold = overtimePolicy?.weekly_threshold_hours ?? 40

  useEffect(() => {
    if (!employee) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusDrawer = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab' || !drawerRef.current) return

      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), details summary, [tabindex]:not([tabindex="-1"])'
      )).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1)

      if (focusable.length === 0) {
        event.preventDefault()
        drawerRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusDrawer)
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [employee, onClose])

  if (!employee) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-xl font-bold text-primary-dark">{employee.full_name}</h2>
              <p className="mt-1 text-sm text-text-muted">
                {employee.total_hours.toFixed(2)}h total · {employee.regular_hours.toFixed(2)}h regular · {employee.overtime_hours.toFixed(2)}h OT
              </p>
            </div>
            <button ref={closeButtonRef} type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            Cornerstone OT is allocated when a day exceeds {dailyThreshold.toFixed(2)}h or a Sunday–Saturday week exceeds {weeklyThreshold.toFixed(2)}h. The breakdown below shows which day/week created the OT.
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ReportMetric label="Regular" value={employee.regular_hours.toFixed(2)} />
            <ReportMetric label="Overtime" value={employee.overtime_hours.toFixed(2)} tone={employee.overtime_hours > 0 ? 'warning' : 'normal'} />
            <ReportMetric label="Total" value={employee.total_hours.toFixed(2)} emphasize />
            <ReportMetric label="Breaks" value={employee.break_hours.toFixed(2)} />
          </div>

          {employee.weeks.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <h3 className="font-semibold text-primary-dark">Weekly overtime context</h3>
              <div className="mt-3 space-y-2">
                {employee.weeks.map((week) => {
                  const weeklyThresholdTriggered = week.weekly_total_hours > weeklyThreshold
                  const dailyThresholdTriggered = employee.days.some((day) => (
                    day.work_date >= week.week_start &&
                    day.work_date <= week.week_end &&
                    day.overtime_hours > 0 &&
                    day.total_hours > dailyThreshold
                  ))
                  const thresholdDescription = weeklyThresholdTriggered && dailyThresholdTriggered
                    ? `the ${dailyThreshold.toFixed(2)}h daily and ${weeklyThreshold.toFixed(2)}h weekly thresholds`
                    : weeklyThresholdTriggered
                      ? `the ${weeklyThreshold.toFixed(2)}h weekly threshold`
                      : dailyThresholdTriggered
                        ? `the ${dailyThreshold.toFixed(2)}h daily threshold`
                        : 'the configured overtime thresholds'

                  return (
                    <div key={week.week_start} className={`rounded-xl border px-4 py-3 text-sm ${week.overtime_hours > 0 ? 'border-orange-200 bg-orange-50/70' : 'border-slate-200 bg-white'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-primary-dark">{formatDate(week.week_start)} – {formatDate(week.week_end)}</span>
                        <span className="text-text-muted">Week {week.weekly_total_hours.toFixed(2)}h · Period {week.period_hours.toFixed(2)}h · OT {week.overtime_hours.toFixed(2)}h</span>
                      </div>
                      {week.overtime_hours > 0 && (
                        <p className="mt-2 text-xs font-medium text-orange-800">
                          OT reason: {week.overtime_hours.toFixed(2)}h was classified as overtime after applying {thresholdDescription}.
                        </p>
                      )}
                      {week.context_note && <p className="mt-2 text-xs text-cyan-800">{week.context_note}</p>}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3"><h3 className="font-semibold text-primary-dark">Hours per day</h3></div>
            <div className="divide-y divide-slate-200">
              {employee.days.length === 0 ? (
                <div className="p-4 text-sm text-text-muted">No approved hours in this period.</div>
              ) : employee.days.map((day) => (
                <details key={day.work_date} className="group">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                    <div className="font-medium text-primary-dark">{formatDate(day.work_date)}</div>
                    <div className="text-sm text-text-muted">Regular {day.regular_hours.toFixed(2)}h · OT {day.overtime_hours.toFixed(2)}h · Total {day.total_hours.toFixed(2)}h</div>
                  </summary>
                  <div className="space-y-2 bg-slate-50/60 px-4 pb-4">
                    {day.entries.map((entry) => (
                      <div key={entry.id} className={`rounded-xl border px-4 py-3 text-sm ${entry.overtime_hours > 0 ? 'border-orange-200 bg-orange-50/60' : 'border-slate-200 bg-white'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-primary-dark">{entry.formatted_start_time || entry.start_time || '—'} – {entry.formatted_end_time || entry.end_time || '—'}</span>
                          <span className="font-semibold text-primary">{entry.total_hours.toFixed(2)}h</span>
                        </div>
                        <div className="mt-1 text-xs text-text-muted">
                          {workSummary(entry)} · {entry.entry_method}
                        </div>
                        {entry.overtime_hours > 0 && <p className="mt-2 text-xs font-semibold text-orange-800">{entry.overtime_hours.toFixed(2)}h of this entry is overtime.</p>}
                        {entry.breaks.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {entry.breaks.map((brk, index) => <span key={`${entry.id}-${index}`} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">Break {brk.start_time}–{brk.end_time} ({brk.duration_minutes}m)</span>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
