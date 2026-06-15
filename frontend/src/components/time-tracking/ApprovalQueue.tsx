import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '../../lib/api'
import type { ApprovalReason, PendingApprovalsParams, PendingApprovalsSummary, TimeCategory, TimeEntry } from '../../lib/api'
import { formatDateISO, formatWorkDate } from '../../lib/dateUtils'
import EditTimeEntryModal from './EditTimeEntryModal'

interface ClientOption {
  id: number
  first_name?: string
  last_name?: string
  name?: string
}

interface ApprovalQueueProps {
  onUpdate?: () => void
  canDeleteEntry?: (entry: TimeEntry) => boolean
  clients?: ClientOption[]
}

type DateMode = 'all' | 'exact' | 'range' | 'through' | 'since'
type SortField = NonNullable<PendingApprovalsParams['sort']>
type SortDirection = NonNullable<PendingApprovalsParams['direction']>

interface ReviewFilters {
  dateMode: DateMode
  date: string
  startDate: string
  endDate: string
  throughDate: string
  sinceDate: string
  userId: string
  categoryId: string
  clientId: string
  approvalType: '' | 'time_entry' | 'overtime' | 'both'
  entryMethod: '' | 'clock' | 'manual'
  sort: SortField
  direction: SortDirection
  groupByDate: boolean
}

const defaultReviewFilters: ReviewFilters = {
  dateMode: 'all',
  date: '',
  startDate: '',
  endDate: '',
  throughDate: '',
  sinceDate: '',
  userId: '',
  categoryId: '',
  clientId: '',
  approvalType: '',
  entryMethod: '',
  sort: 'work_date',
  direction: 'asc',
  groupByDate: true,
}

function buildPendingApprovalParams(filters: ReviewFilters): PendingApprovalsParams {
  const params: PendingApprovalsParams = { sort: filters.sort, direction: filters.direction, per_page: 500 }

  if (filters.dateMode === 'exact' && filters.date) params.date = filters.date
  if (filters.dateMode === 'range') {
    if (filters.startDate) params.start_date = filters.startDate
    if (filters.endDate) params.end_date = filters.endDate
  }
  if (filters.dateMode === 'through' && filters.throughDate) params.through_date = filters.throughDate
  if (filters.dateMode === 'since' && filters.sinceDate) params.since_date = filters.sinceDate
  if (filters.userId) params.user_id = Number(filters.userId)
  if (filters.categoryId) params.time_category_id = Number(filters.categoryId)
  if (filters.clientId) params.client_id = Number(filters.clientId)
  if (filters.approvalType) params.approval_type = filters.approvalType
  if (filters.entryMethod) params.entry_method = filters.entryMethod

  return params
}

function hasActiveReviewFilters(filters: ReviewFilters) {
  return Boolean(filters.dateMode !== 'all' || filters.userId || filters.categoryId || filters.clientId || filters.approvalType || filters.entryMethod)
}

function parseLocalDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`)
}

function formatCompactDate(dateString: string | null | undefined) {
  if (!dateString) return '—'
  return parseLocalDate(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getWeekBounds(date: Date) {
  const start = new Date(date)
  start.setDate(start.getDate() - start.getDay())
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: formatDateISO(start), end: formatDateISO(end) }
}

function fallbackApprovalReasons(entry: TimeEntry): ApprovalReason[] {
  const reasons: ApprovalReason[] = []
  const note = (entry.approval_note ?? '').toLowerCase()

  if (entry.approval_status === 'pending') {
    if (note.includes('corrected clock-out')) reasons.push({ key: 'corrected_clock_out', label: 'Corrected clock-out' })
    if (note.includes('employee edited')) reasons.push({ key: 'employee_edited', label: 'Employee edited' })
    if (entry.entry_method === 'manual') reasons.push({ key: 'manual_entry', label: 'Manual entry' })
    if (entry.entry_method === 'clock' && (!entry.schedule || note.includes('without a schedule'))) reasons.push({ key: 'unscheduled_clock', label: 'Unscheduled clock' })
    if (reasons.length === 0) reasons.push({ key: 'time_review', label: 'Needs review' })
  }
  if (entry.overtime_status === 'pending') reasons.push({ key: 'overtime', label: 'Overtime' })
  if (entry.admin_override) reasons.push({ key: 'admin_override', label: 'Admin override' })

  return reasons.filter((reason, index, list) => list.findIndex((item) => item.key === reason.key) === index)
}

function approvalReasonsFor(entry: TimeEntry) {
  return entry.approval_reasons?.length ? entry.approval_reasons : fallbackApprovalReasons(entry)
}

function reasonTone(key: string) {
  if (key === 'overtime') return 'border-orange-200 bg-orange-50 text-orange-700'
  if (key === 'unscheduled_clock' || key === 'corrected_clock_out') return 'border-sky-200 bg-sky-50 text-sky-700'
  if (key === 'employee_edited') return 'border-violet-200 bg-violet-50 text-violet-700'
  if (key === 'admin_override') return 'border-slate-200 bg-slate-50 text-slate-600'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function entryDisplayName(entry: TimeEntry) {
  return entry.user?.full_name || entry.user?.display_name || entry.user?.email?.split('@')[0] || 'Unknown team member'
}

function entryTimeLabel(entry: TimeEntry) {
  if (entry.formatted_start_time && entry.formatted_end_time) return `${entry.formatted_start_time} – ${entry.formatted_end_time}`
  return `${entry.hours}h`
}

function summarizeSelectedEntries(entries: TimeEntry[]) {
  const dates = entries.map((entry) => entry.work_date).sort()
  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0)
  const firstDate = dates[0]
  const lastDate = dates[dates.length - 1]
  const dateLabel = firstDate === lastDate ? formatWorkDate(firstDate) : `${formatWorkDate(firstDate)} through ${formatWorkDate(lastDate)}`
  return { totalHours, dateLabel }
}

function clientLabel(client: ClientOption) {
  return client.name || [client.first_name, client.last_name].filter(Boolean).join(' ') || `Client #${client.id}`
}

function SummaryMetric({ label, value, sublabel, tone = 'default' }: { label: string; value: string; sublabel?: string; tone?: 'default' | 'warning' | 'success' }) {
  const toneClass = tone === 'warning' ? 'text-amber-700' : tone === 'success' ? 'text-emerald-700' : 'text-primary-dark'
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
      {sublabel && <p className="mt-1 text-xs text-text-muted">{sublabel}</p>}
    </div>
  )
}

export default function ApprovalQueue({ onUpdate, canDeleteEntry, clients = [] }: ApprovalQueueProps) {
  const [allEntries, setAllEntries] = useState<TimeEntry[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [categories, setCategories] = useState<TimeCategory[]>([])
  const [summary, setSummary] = useState<PendingApprovalsSummary | null>(null)
  const [reviewFilters, setReviewFilters] = useState<ReviewFilters>(defaultReviewFilters)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [refreshingFilter, setRefreshingFilter] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState<{ id: number; note: string } | null>(null)
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set())
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('cornerstone_pending_approvals_collapsed') === 'true')
  const fetchGenerationRef = useRef(0)

  const fetchPending = useCallback(async () => {
    const requestId = ++fetchGenerationRef.current
    try {
      const result = await api.getPendingApprovals(buildPendingApprovalParams(reviewFilters))
      if (requestId !== fetchGenerationRef.current) return

      if (result.data) {
        const visibleEntries = result.data.pending_entries ?? []
        setAllEntries(visibleEntries)
        setEntries(visibleEntries)
        setSummary(result.data.summary ?? null)
        setExpandedDescriptions((previous) => {
          const ids = new Set(visibleEntries.map((entry) => entry.id))
          const next = new Set<number>()
          previous.forEach((id) => { if (ids.has(id)) next.add(id) })
          return next
        })
        setFetchError(false)
      } else {
        setFetchError(true)
      }
    } catch {
      if (requestId === fetchGenerationRef.current) setFetchError(true)
    } finally {
      if (requestId === fetchGenerationRef.current) {
        setLoading(false)
        setRefreshingFilter(false)
      }
    }
  }, [reviewFilters])

  useEffect(() => {
    void fetchPending()
    const interval = setInterval(() => void fetchPending(), 30000)
    return () => clearInterval(interval)
  }, [fetchPending])

  useEffect(() => {
    api.getTimeCategories().then((result) => {
      if (result.data?.time_categories) setCategories(result.data.time_categories)
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    const visibleIds = new Set(entries.map((entry) => entry.id))
    setSelectedIds((previous) => {
      const next = new Set<number>()
      previous.forEach((id) => { if (visibleIds.has(id)) next.add(id) })
      return next
    })
  }, [entries])

  const userOptions = useMemo(() => {
    const usersById = new Map<number, { id: number; label: string }>()
    allEntries.forEach((entry) => {
      if (entry.user) usersById.set(entry.user.id, { id: entry.user.id, label: entryDisplayName(entry) })
    })
    return Array.from(usersById.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [allEntries])

  const selectedEntries = useMemo(() => entries.filter((entry) => selectedIds.has(entry.id)), [entries, selectedIds])
  const allVisibleSelected = entries.length > 0 && entries.every((entry) => selectedIds.has(entry.id))
  const activeReviewFilters = hasActiveReviewFilters(reviewFilters)

  const groupedEntries = useMemo(() => {
    const groups = entries.reduce((acc, entry) => {
      if (!acc[entry.work_date]) acc[entry.work_date] = []
      acc[entry.work_date].push(entry)
      return acc
    }, {} as Record<string, TimeEntry[]>)
    return Object.entries(groups)
      .sort(([left], [right]) => reviewFilters.direction === 'desc' ? right.localeCompare(left) : left.localeCompare(right))
      .map(([date, groupEntries]) => ({
        date,
        entries: groupEntries,
        totalHours: groupEntries.reduce((sum, entry) => sum + entry.hours, 0),
      }))
  }, [entries, reviewFilters.direction])

  const updateReviewFilters = (updates: Partial<ReviewFilters>) => {
    setReviewFilters((previous) => ({ ...previous, ...updates }))
    setRefreshingFilter(true)
  }

  const clearReviewFilters = () => {
    setReviewFilters((previous) => ({ ...defaultReviewFilters, sort: previous.sort, direction: previous.direction, groupByDate: previous.groupByDate }))
    setRefreshingFilter(true)
  }

  const applyQuickDateFilter = (kind: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'through_today') => {
    const today = new Date()
    if (kind === 'today') return updateReviewFilters({ dateMode: 'exact', date: formatDateISO(today) })
    if (kind === 'yesterday') {
      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 1)
      return updateReviewFilters({ dateMode: 'exact', date: formatDateISO(yesterday) })
    }
    if (kind === 'this_week') {
      const bounds = getWeekBounds(today)
      return updateReviewFilters({ dateMode: 'range', startDate: bounds.start, endDate: bounds.end })
    }
    if (kind === 'last_week') {
      const lastWeek = new Date(today)
      lastWeek.setDate(lastWeek.getDate() - 7)
      const bounds = getWeekBounds(lastWeek)
      return updateReviewFilters({ dateMode: 'range', startDate: bounds.start, endDate: bounds.end })
    }
    updateReviewFilters({ dateMode: 'through', throughDate: formatDateISO(today) })
  }

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous
      localStorage.setItem('cornerstone_pending_approvals_collapsed', String(next))
      return next
    })
  }

  const toggleEntrySelection = (entryId: number) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  const toggleSelectAllVisible = () => {
    setSelectedIds((previous) => {
      if (allVisibleSelected) return new Set()
      const next = new Set(previous)
      entries.forEach((entry) => next.add(entry.id))
      return next
    })
  }

  const toggleGroupSelection = (groupEntries: TimeEntry[]) => {
    const groupSelected = groupEntries.every((entry) => selectedIds.has(entry.id))
    setSelectedIds((previous) => {
      const next = new Set(previous)
      groupEntries.forEach((entry) => {
        if (groupSelected) next.delete(entry.id)
        else next.add(entry.id)
      })
      return next
    })
  }

  const handleApprove = async (entry: TimeEntry, note?: string) => {
    setActionLoading(entry.id)
    setActionError(null)
    try {
      const overtimeOnly = entry.approval_status !== 'pending' && entry.overtime_status === 'pending'
      const result = overtimeOnly ? await api.approveOvertime(entry.id, note) : await api.approveTimeEntry(entry.id, note)
      if (result.error) setActionError(result.error)
      else {
        await fetchPending()
        setNoteInput(null)
        onUpdate?.()
      }
    } catch {
      setActionError('Failed to approve entry. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeny = async (entry: TimeEntry, note?: string) => {
    setActionLoading(entry.id)
    setActionError(null)
    try {
      const overtimeOnly = entry.approval_status !== 'pending' && entry.overtime_status === 'pending'
      const result = overtimeOnly ? await api.denyOvertime(entry.id, note) : await api.denyTimeEntry(entry.id, note)
      if (result.error) setActionError(result.error)
      else {
        await fetchPending()
        setNoteInput(null)
        onUpdate?.()
      }
    } catch {
      setActionError('Failed to deny entry. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkApproveSelected = async () => {
    if (selectedEntries.length === 0) return
    if (selectedEntries.length > 100) {
      setActionError('Approve at most 100 entries at a time. Narrow the filters or select fewer entries.')
      return
    }

    const selectedSummary = summarizeSelectedEntries(selectedEntries)
    if (!confirm(`Approve ${selectedEntries.length} selected entr${selectedEntries.length === 1 ? 'y' : 'ies'}?\n\nDate range: ${selectedSummary.dateLabel}\nTotal hours: ${selectedSummary.totalHours.toFixed(2)}h`)) return

    setBulkActionLoading(true)
    setActionError(null)
    try {
      const result = await api.bulkApproveTimeEntries(selectedEntries.map((entry) => entry.id))
      if (result.error) {
        setActionError(result.error)
        return
      }
      setSelectedIds(new Set())
      await fetchPending()
      onUpdate?.()
    } catch {
      setActionError('Failed to approve selected entries. Please try again.')
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleEditSaved = async () => {
    setEditingEntry(null)
    await fetchPending()
    onUpdate?.()
  }

  const displaySummary = summary ?? {
    total_hours: entries.reduce((sum, entry) => sum + entry.hours, 0),
    entry_count: entries.length,
    oldest_work_date: entries.map((entry) => entry.work_date).sort()[0] ?? null,
    newest_work_date: entries.map((entry) => entry.work_date).sort().at(-1) ?? null,
    pending_time_entry_count: entries.filter((entry) => entry.approval_status === 'pending').length,
    pending_overtime_count: entries.filter((entry) => entry.overtime_status === 'pending').length,
    manual_count: entries.filter((entry) => entry.entry_method === 'manual').length,
    clock_count: entries.filter((entry) => entry.entry_method === 'clock').length,
    counts_by_date: [],
    counts_by_client: [],
  }

  const renderEntryCard = (entry: TimeEntry) => {
    const selected = selectedIds.has(entry.id)
    const canAct = entry.approval_status === 'pending' || entry.overtime_status === 'pending'

    return (
      <motion.div key={entry.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -80 }} className={`rounded-2xl border p-4 transition-colors ${selected ? 'border-primary bg-cyan-50/60' : 'border-neutral-warm bg-white'}`}>
        <div className="flex items-start gap-3">
          <label className="mt-0.5 flex min-h-[44px] min-w-[44px] cursor-pointer items-start justify-center rounded-xl border border-slate-200 bg-white pt-3 hover:border-primary/50">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={selected} onChange={() => toggleEntrySelection(entry.id)} aria-label={`Select ${entryDisplayName(entry)}`} />
          </label>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-primary-dark">{entryDisplayName(entry)}</span>
                  {approvalReasonsFor(entry).map((reason) => <span key={reason.key} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${reasonTone(reason.key)}`}>{reason.label}</span>)}
                </div>
                <p className="mt-1 text-xs text-text-muted">{formatWorkDate(entry.work_date)} · {entryTimeLabel(entry)}</p>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-[0.12em] text-text-muted">
                  <span>{entry.time_category?.name || 'Uncategorized'}</span>
                  {entry.client && <><span>·</span><span>{entry.client.name}</span></>}
                  {entry.service_type && <><span>·</span><span>{entry.service_type.name}</span></>}
                  <span>·</span><span>{entry.entry_method}</span>
                </div>
                {entry.description && (
                  <div className="mt-2">
                    <p className={`text-xs text-text-muted ${!expandedDescriptions.has(entry.id) && entry.description.length > 72 ? 'line-clamp-1' : ''}`}>{entry.description}</p>
                    {entry.description.length > 72 && <button type="button" onClick={() => setExpandedDescriptions((previous) => { const next = new Set(previous); if (next.has(entry.id)) next.delete(entry.id); else next.add(entry.id); return next })} className="mt-0.5 text-[11px] font-semibold text-primary hover:underline">{expandedDescriptions.has(entry.id) ? 'Show less' : 'Show more'}</button>}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold text-primary-dark">{entry.hours}h</p>
                {(entry.overtime_hours ?? 0) > 0 && <p className="text-[10px] font-semibold uppercase text-orange-600">{entry.overtime_hours}h OT</p>}
              </div>
            </div>

            {noteInput?.id === entry.id && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3">
                <input type="text" value={noteInput.note} onChange={(event) => setNoteInput({ ...noteInput, note: event.target.value })} placeholder="Add a note (optional)..." className="w-full rounded-xl border border-neutral-warm bg-white px-3 py-2 text-sm text-primary-dark placeholder:text-text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </motion.div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void handleApprove(entry, noteInput?.id === entry.id ? noteInput.note : undefined)} disabled={actionLoading === entry.id || !canAct} className="min-h-[44px] flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-50">{actionLoading === entry.id ? 'Processing…' : 'Approve'}</button>
              <button type="button" onClick={() => void handleDeny(entry, noteInput?.id === entry.id ? noteInput.note : undefined)} disabled={actionLoading === entry.id || !canAct} className="min-h-[44px] flex-1 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50">Deny</button>
              <button type="button" onClick={() => setEditingEntry(entry)} className="min-h-[44px] rounded-xl border border-neutral-warm bg-white px-3 py-2 text-sm font-semibold text-text-muted transition hover:bg-secondary">Edit</button>
              <button type="button" onClick={() => setNoteInput(noteInput?.id === entry.id ? null : { id: entry.id, note: '' })} className="min-h-[44px] rounded-xl border border-neutral-warm bg-white px-3 py-2 text-sm font-semibold text-text-muted transition hover:bg-secondary">Note</button>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  if (loading) {
    return <div className="animate-pulse rounded-2xl border border-neutral-warm bg-white p-5 shadow-sm"><div className="mb-4 h-5 w-36 rounded bg-neutral-warm" /><div className="space-y-3"><div className="h-16 rounded-xl bg-neutral-warm/60" /><div className="h-16 rounded-xl bg-neutral-warm/60" /></div></div>
  }

  if (fetchError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-red-700">Could not load pending approvals</h3>
        <p className="mb-3 text-xs text-text-muted">There may be entries awaiting your review.</p>
        <button type="button" onClick={() => { setLoading(true); void fetchPending() }} className="min-h-[44px] rounded-xl border border-neutral-warm bg-white px-4 py-2 text-sm font-semibold text-primary-dark transition hover:bg-secondary">Retry</button>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
        <div className="h-1 bg-amber-400" />
        <div className="p-5">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <button type="button" onClick={toggleCollapsed} className="flex min-h-[44px] items-center gap-2.5 text-left">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 bg-amber-50"><span className="text-xs font-bold text-amber-600">{displaySummary.entry_count}</span></div>
              <div>
                <h3 className="text-base font-semibold text-primary-dark">Pending Approvals</h3>
                <p className="text-xs text-text-muted">{collapsed ? 'Collapsed — expand to review, filter, edit, or approve entries.' : 'Review oldest unapproved hours first, then clear date ranges with confidence.'}</p>
              </div>
              <svg className={`h-4 w-4 text-text-muted transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {!collapsed && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={toggleSelectAllVisible} disabled={entries.length === 0} className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-primary-dark transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">{allVisibleSelected ? 'Clear selection' : `Select filtered (${entries.length})`}</button>
                <button type="button" onClick={() => void handleBulkApproveSelected()} disabled={bulkActionLoading || selectedEntries.length === 0 || selectedEntries.length > 100} className="min-h-[44px] rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">{bulkActionLoading ? 'Approving…' : `Approve Selected (${selectedEntries.length})`}</button>
              </div>
            )}
          </div>

          {collapsed ? (
            <div className="flex flex-wrap gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-xs text-amber-900">
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold">Total: {displaySummary.entry_count}</span>
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold">Hours: {displaySummary.total_hours.toFixed(2)}</span>
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold">Oldest: {formatCompactDate(displaySummary.oldest_work_date)}</span>
            </div>
          ) : (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryMetric label="Filtered pending" value={`${displaySummary.entry_count}`} sublabel={`${displaySummary.total_hours.toFixed(2)}h awaiting review`} tone={displaySummary.entry_count > 0 ? 'warning' : 'success'} />
                <SummaryMetric label="Oldest" value={formatCompactDate(displaySummary.oldest_work_date)} sublabel="Default queue starts here" />
                <SummaryMetric label="Newest" value={formatCompactDate(displaySummary.newest_work_date)} sublabel="Latest pending work date" />
                <SummaryMetric label="Review types" value={`${displaySummary.pending_time_entry_count}/${displaySummary.pending_overtime_count}`} sublabel="Time entries / overtime" />
              </div>

              {reviewFilters.dateMode === 'through' && reviewFilters.throughDate && <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${entries.length === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{entries.length === 0 ? `No pending approvals through ${formatWorkDate(reviewFilters.throughDate)} in this view.` : `${entries.length} pending entr${entries.length === 1 ? 'y' : 'ies'} still need review through ${formatWorkDate(reviewFilters.throughDate)}.`}</div>}

              <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Date filter</label>
                    <select value={reviewFilters.dateMode} onChange={(event) => updateReviewFilters({ dateMode: event.target.value as DateMode })} className="w-full rounded-xl border border-neutral-warm bg-white px-3 py-2 text-sm text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="all">All dates</option><option value="exact">Exact date</option><option value="through">On or before</option><option value="since">On or after</option><option value="range">Date range</option>
                    </select>
                  </div>

                  {reviewFilters.dateMode === 'exact' && <DateField label="Work date" value={reviewFilters.date} onChange={(date) => updateReviewFilters({ date })} />}
                  {reviewFilters.dateMode === 'through' && <DateField label="Through date" value={reviewFilters.throughDate} onChange={(throughDate) => updateReviewFilters({ throughDate })} />}
                  {reviewFilters.dateMode === 'since' && <DateField label="Starting date" value={reviewFilters.sinceDate} onChange={(sinceDate) => updateReviewFilters({ sinceDate })} />}
                  {reviewFilters.dateMode === 'range' && <><DateField label="Start" value={reviewFilters.startDate} onChange={(startDate) => updateReviewFilters({ startDate })} /><DateField label="End" value={reviewFilters.endDate} onChange={(endDate) => updateReviewFilters({ endDate })} /></>}

                  <SelectField label="Employee" value={reviewFilters.userId} onChange={(userId) => updateReviewFilters({ userId })} options={[{ value: '', label: 'All employees' }, ...userOptions.map((user) => ({ value: String(user.id), label: user.label }))]} />
                  <SelectField label="Category" value={reviewFilters.categoryId} onChange={(categoryId) => updateReviewFilters({ categoryId })} options={[{ value: '', label: 'All categories' }, ...categories.map((category) => ({ value: String(category.id), label: category.name }))]} />
                  <SelectField label="Client" value={reviewFilters.clientId} onChange={(clientId) => updateReviewFilters({ clientId })} options={[{ value: '', label: 'All clients' }, ...clients.map((client) => ({ value: String(client.id), label: clientLabel(client) }))]} />
                  <SelectField label="Review type" value={reviewFilters.approvalType} onChange={(approvalType) => updateReviewFilters({ approvalType: approvalType as ReviewFilters['approvalType'] })} options={[{ value: '', label: 'Any review type' }, { value: 'time_entry', label: 'Time entries only' }, { value: 'overtime', label: 'Overtime only' }, { value: 'both', label: 'Time + overtime' }]} />
                  <SelectField label="Entry method" value={reviewFilters.entryMethod} onChange={(entryMethod) => updateReviewFilters({ entryMethod: entryMethod as ReviewFilters['entryMethod'] })} options={[{ value: '', label: 'Any method' }, { value: 'clock', label: 'Clock' }, { value: 'manual', label: 'Manual' }]} />
                  <SelectField label="Sort by" value={reviewFilters.sort} onChange={(sort) => updateReviewFilters({ sort: sort as SortField })} options={[{ value: 'work_date', label: 'Work date' }, { value: 'created_at', label: 'Created' }, { value: 'employee', label: 'Employee' }, { value: 'hours', label: 'Hours' }, { value: 'approval_type', label: 'Review type' }, { value: 'category', label: 'Category' }, { value: 'client', label: 'Client' }]} />
                  <SelectField label="Direction" value={reviewFilters.direction} onChange={(direction) => updateReviewFilters({ direction: direction as SortDirection })} options={[{ value: 'asc', label: 'Oldest / A-Z first' }, { value: 'desc', label: 'Newest / Z-A first' }]} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => applyQuickDateFilter('today')} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-dark hover:bg-secondary">Today</button>
                  <button type="button" onClick={() => applyQuickDateFilter('yesterday')} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-dark hover:bg-secondary">Yesterday</button>
                  <button type="button" onClick={() => applyQuickDateFilter('this_week')} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-dark hover:bg-secondary">This week</button>
                  <button type="button" onClick={() => applyQuickDateFilter('last_week')} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-dark hover:bg-secondary">Last week</button>
                  <button type="button" onClick={() => applyQuickDateFilter('through_today')} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100">Through today</button>
                  <button type="button" onClick={() => updateReviewFilters({ groupByDate: !reviewFilters.groupByDate })} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-dark hover:bg-secondary">{reviewFilters.groupByDate ? 'Ungroup' : 'Group by date'}</button>
                  {activeReviewFilters && <button type="button" onClick={clearReviewFilters} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-secondary">Clear filters</button>}
                  {refreshingFilter && <span className="text-xs font-medium text-text-muted">Refreshing…</span>}
                </div>
              </div>

              {actionError && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</div>}

              {entries.length === 0 ? (
                <div className="rounded-xl border border-neutral-warm bg-secondary/30 p-6 text-center">
                  <p className="font-semibold text-primary-dark">No pending approvals</p>
                  <p className="mt-1 text-sm text-text-muted">{activeReviewFilters ? 'Try clearing filters to see the full queue.' : 'All caught up.'}</p>
                </div>
              ) : reviewFilters.groupByDate ? (
                <div className="space-y-4">
                  {groupedEntries.map((group) => {
                    const groupSelected = group.entries.every((entry) => selectedIds.has(entry.id))
                    return (
                      <section key={group.date} className="rounded-2xl border border-neutral-warm bg-secondary/20 p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div><h4 className="text-sm font-bold text-primary-dark">{formatWorkDate(group.date)}</h4><p className="text-xs text-text-muted">{group.entries.length} entr{group.entries.length === 1 ? 'y' : 'ies'} · {group.totalHours.toFixed(2)}h</p></div>
                          <button type="button" onClick={() => toggleGroupSelection(group.entries)} className="min-h-[36px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-dark hover:bg-secondary">{groupSelected ? 'Clear day' : 'Select day'}</button>
                        </div>
                        <AnimatePresence mode="popLayout"><div className="space-y-3">{group.entries.map(renderEntryCard)}</div></AnimatePresence>
                      </section>
                    )
                  })}
                </div>
              ) : (
                <AnimatePresence mode="popLayout"><div className="space-y-3">{entries.map(renderEntryCard)}</div></AnimatePresence>
              )}
            </>
          )}
        </div>
      </div>

      <EditTimeEntryModal
        isOpen={!!editingEntry}
        entry={editingEntry}
        categories={categories}
        clients={clients}
        canDelete={!!editingEntry && (canDeleteEntry?.(editingEntry) ?? false)}
        onClose={() => setEditingEntry(null)}
        onSaved={handleEditSaved}
        onDeleted={handleEditSaved}
        onError={setActionError}
      />
    </>
  )
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</label>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-neutral-warm bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
    </div>
  )
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-neutral-warm bg-white px-3 py-2 text-sm text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/30">
        {options.map((option) => <option key={`${label}-${option.value}`} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  )
}
