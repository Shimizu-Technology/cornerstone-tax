import { Fragment, useMemo, useState } from 'react'
import type {
  HoursReportDownloadType,
  HoursReportEmployee,
  HoursReportResponse,
  HoursReportReviewFlag,
  TimeEntry,
} from '../../lib/api'
import { reportPeriodForPreset, type ReportPeriodPreset } from '../../lib/reportPeriods'
import ReportExportActions from './ReportExportActions'

export interface HoursReportFilters {
  start_date: string
  end_date: string
  user_id: string
  time_category_id: string
  client_id: string
  status: string
  entry_method: string
  overtime_status: string
}

interface Option { id: number; name: string }
interface EmployeeOption { id: number; email: string; display_name?: string; employment_status: 'active' | 'terminated' }

export type ReportView = 'overview' | 'people' | 'daily' | 'review'
type ReviewFilter = HoursReportReviewFlag | 'unresolved' | 'all'

const REVIEW_LABELS: Record<HoursReportReviewFlag, string> = {
  uncategorized: 'Uncategorized',
  missing_client: 'No client assigned',
  missing_description: 'Missing description',
  long_shift: 'Long shift',
  overlap: 'Overlapping time',
}

function formatHours(value: number) {
  return `${value.toFixed(2)}h`
}

function formatWorkDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatGeneratedAt(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 9 6 6 6-6" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 9v4m0 4h.01M10.3 3.8 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
    </svg>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-warm bg-white px-5 py-12 text-center">
      <p className="font-semibold text-primary-dark">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-text-muted">{detail}</p>
    </div>
  )
}

function MetricCard({ label, value, detail, tone = 'default' }: { label: string; value: string; detail?: string; tone?: 'default' | 'overtime' }) {
  return (
    <div className="min-w-0 rounded-2xl border border-neutral-warm bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <p className={`mt-2 truncate text-2xl font-bold tracking-tight sm:text-3xl ${tone === 'overtime' ? 'text-orange-700' : 'text-primary-dark'}`}>{value}</p>
      {detail && <p className="mt-1 text-xs text-text-muted">{detail}</p>}
    </div>
  )
}

export default function HoursReportWorkspace({
  filters,
  onFiltersChange,
  report,
  entries,
  loading,
  error,
  users,
  categories,
  clients,
  exporting,
  onExport,
  onOpenEmployee,
  onEditEntry,
  view,
  onViewChange,
}: {
  filters: HoursReportFilters
  onFiltersChange: (filters: HoursReportFilters) => void
  report: HoursReportResponse | null
  entries: TimeEntry[]
  loading: boolean
  error: string | null
  users: EmployeeOption[]
  categories: Option[]
  clients: Option[]
  exporting: HoursReportDownloadType | null
  onExport: (type: HoursReportDownloadType) => void
  onOpenEmployee: (employee: HoursReportEmployee) => void
  onEditEntry: (entry: TimeEntry) => void
  view: ReportView
  onViewChange: (view: ReportView) => void
}) {
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [visibleGroups, setVisibleGroups] = useState(40)
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')

  const updateView = (next: ReportView) => {
    onViewChange(next)
  }

  const updateFilter = (key: keyof HoursReportFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const applyPreset = (preset: ReportPeriodPreset) => {
    const period = reportPeriodForPreset(preset)
    onFiltersChange({ ...filters, start_date: period.start, end_date: period.end })
  }

  const categoryRows = useMemo(() => {
    const rows = new Map<string, { name: string; hours: number; entries: number }>()
    report?.employees.forEach(employee => employee.categories.forEach(category => {
      const key = `${category.id ?? 'none'}:${category.name}`
      const current = rows.get(key) || { name: category.name, hours: 0, entries: 0 }
      current.hours += category.total_hours
      current.entries += category.entries_count
      rows.set(key, current)
    }))
    return [...rows.values()].sort((a, b) => b.hours - a.hours)
  }, [report])

  const clientRows = useMemo(() => {
    const rows = new Map<string, { name: string; hours: number; entries: number }>()
    report?.employees.forEach(employee => employee.clients.forEach(client => {
      const key = `${client.id ?? 'none'}:${client.name}`
      const current = rows.get(key) || { name: client.name, hours: 0, entries: 0 }
      current.hours += client.total_hours
      current.entries += client.entries_count
      rows.set(key, current)
    }))
    return [...rows.values()].sort((a, b) => b.hours - a.hours)
  }, [report])

  const dailyGroups = useMemo(() => {
    const groups = new Map<string, { key: string; date: string; employee: string; entries: TimeEntry[] }>()
    entries.forEach(entry => {
      const employee = entry.user?.full_name || entry.user?.display_name || entry.user?.email?.split('@')[0] || 'Former employee'
      const key = `${entry.work_date}:${entry.user?.id ?? 'former'}`
      const group = groups.get(key) || { key, date: entry.work_date, employee, entries: [] }
      group.entries.push(entry)
      groups.set(key, group)
    })
    return [...groups.values()]
      .map(group => ({ ...group, entries: group.entries.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')) }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.employee.localeCompare(b.employee))
  }, [entries])

  const flaggedEntries = useMemo(() => entries.filter(entry => (entry.review_flags?.length || 0) > 0), [entries])
  const unresolvedEntries = useMemo(() => report?.employees.flatMap(employee => (
    employee.excluded_entries.map(entry => ({ entry, employee }))
  )) || [], [report])
  const visibleFlaggedEntries = reviewFilter === 'all'
    ? flaggedEntries
    : reviewFilter === 'unresolved'
      ? []
      : flaggedEntries.filter(entry => entry.review_flags?.includes(reviewFilter))

  const issueCards: Array<{ filter: ReviewFilter; label: string; count: number; note: string }> = report ? [
    { filter: 'uncategorized', label: 'Uncategorized', count: report.quality.uncategorized_count, note: 'Assign a work category' },
    { filter: 'missing_client', label: 'No client assigned', count: report.quality.missing_client_count, note: 'May be valid for internal work' },
    { filter: 'missing_description', label: 'Missing description', count: report.quality.missing_description_count, note: 'Add context for the work' },
    { filter: 'long_shift', label: `Long shifts (${report.quality.long_shift_threshold_hours}h+)`, count: report.quality.long_shift_count, note: 'Verify unusually long entries' },
    { filter: 'overlap', label: 'Overlapping time', count: report.quality.overlapping_entry_count, note: 'Two entries cover the same time' },
    { filter: 'unresolved', label: 'Excluded / unresolved', count: unresolvedEntries.length, note: 'Pending, denied, or open time' },
  ] : []

  const openReview = (filter: ReviewFilter) => {
    setReviewFilter(filter)
    updateView('review')
  }

  const toggleGroup = (key: string) => {
    setExpandedGroups(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-neutral-warm bg-white shadow-sm">
        <div className="border-b border-neutral-warm bg-[linear-gradient(135deg,rgba(236,253,245,0.9),rgba(236,254,255,0.75))] px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Payroll reporting</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-primary-dark">See who worked, when, and what needs attention</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">Approved work stays in the totals. Review flags identify missing context or unusual entries without deleting or changing anyone's time.</p>
            </div>
            <ReportExportActions
              employeeSelected={Boolean(filters.user_id)}
              hasResults={Boolean(report?.employees.length)}
              loading={loading}
              exporting={exporting}
              onExport={onExport}
            />
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Quick period</p>
            <div className="flex flex-wrap gap-2">
              {([
                ['current_period', 'Current half-month'],
                ['previous_period', 'Previous half-month'],
                ['this_month', 'This month'],
                ['last_month', 'Last month'],
                ['year_to_date', 'Year to date'],
              ] as Array<[ReportPeriodPreset, string]>).map(([preset, label]) => (
                <button key={preset} type="button" onClick={() => applyPreset(preset)} className="min-h-11 rounded-full border border-neutral-warm bg-white px-4 py-2 text-sm font-semibold text-primary-dark transition hover:border-primary/40 hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium text-primary-dark">
              <span className="mb-1.5 block text-text-muted">Start date</span>
              <input aria-label="Start Date" type="date" value={filters.start_date} onChange={event => updateFilter('start_date', event.target.value)} className="min-h-11 w-full rounded-xl border border-neutral-warm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </label>
            <label className="text-sm font-medium text-primary-dark">
              <span className="mb-1.5 block text-text-muted">End date</span>
              <input aria-label="End Date" type="date" value={filters.end_date} onChange={event => updateFilter('end_date', event.target.value)} className="min-h-11 w-full rounded-xl border border-neutral-warm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </label>
            <label className="text-sm font-medium text-primary-dark">
              <span className="mb-1.5 block text-text-muted">Employee</span>
              <select aria-label="Employee" value={filters.user_id} onChange={event => updateFilter('user_id', event.target.value)} className="min-h-11 w-full rounded-xl border border-neutral-warm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option value="">All employees</option>
                {users.map(user => <option key={user.id} value={user.id}>{user.display_name || user.email.split('@')[0]}{user.employment_status === 'terminated' ? ' (terminated)' : ''}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-primary-dark">
              <span className="mb-1.5 block text-text-muted">Employee status</span>
              <select aria-label="Employee Status" value={filters.status} onChange={event => updateFilter('status', event.target.value)} className="min-h-11 w-full rounded-xl border border-neutral-warm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="terminated">Terminated</option>
                <option value="pending">Pending invitation</option>
              </select>
            </label>
          </div>

          <button type="button" onClick={() => setShowMoreFilters(value => !value)} className="flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <ChevronIcon open={showMoreFilters} />
            {showMoreFilters ? 'Hide additional filters' : 'More filters'}
          </button>

          {showMoreFilters && (
            <div className="grid grid-cols-1 gap-4 rounded-2xl bg-neutral-warm/25 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-medium text-primary-dark"><span className="mb-1.5 block text-text-muted">Category</span><select aria-label="Category" value={filters.time_category_id} onChange={event => updateFilter('time_category_id', event.target.value)} className="min-h-11 w-full rounded-xl border border-neutral-warm bg-white px-3 py-2"><option value="">All categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="text-sm font-medium text-primary-dark"><span className="mb-1.5 block text-text-muted">Client</span><select aria-label="Client" value={filters.client_id} onChange={event => updateFilter('client_id', event.target.value)} className="min-h-11 w-full rounded-xl border border-neutral-warm bg-white px-3 py-2"><option value="">All clients</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
              <label className="text-sm font-medium text-primary-dark"><span className="mb-1.5 block text-text-muted">Entry method</span><select aria-label="Entry Method" value={filters.entry_method} onChange={event => updateFilter('entry_method', event.target.value)} className="min-h-11 w-full rounded-xl border border-neutral-warm bg-white px-3 py-2"><option value="">Clock and manual</option><option value="clock">Clock entries</option><option value="manual">Manual entries</option></select></label>
              <label className="text-sm font-medium text-primary-dark"><span className="mb-1.5 block text-text-muted">Overtime status</span><select aria-label="Overtime Status" value={filters.overtime_status} onChange={event => updateFilter('overtime_status', event.target.value)} className="min-h-11 w-full rounded-xl border border-neutral-warm bg-white px-3 py-2"><option value="">All overtime statuses</option><option value="none">No overtime review</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="denied">Denied</option></select></label>
            </div>
          )}
        </div>
      </section>

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}</div>}

      <nav aria-label="Report sections" className="flex gap-1 overflow-x-auto rounded-2xl border border-neutral-warm bg-white p-1.5 shadow-sm">
        {([
          ['overview', 'Overview'],
          ['people', `People${report ? ` (${report.summary.employee_count})` : ''}`],
          ['daily', `Daily detail${report ? ` (${dailyGroups.length})` : ''}`],
          ['review', `Needs review${report?.quality.flagged_entries_count || unresolvedEntries.length ? ` (${(report?.quality.flagged_entries_count || 0) + unresolvedEntries.length})` : ''}`],
        ] as Array<[ReportView, string]>).map(([id, label]) => (
          <button key={id} type="button" aria-current={view === id ? 'page' : undefined} onClick={() => updateView(id)} className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${view === id ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:bg-secondary/40 hover:text-primary-dark'}`}>{label}</button>
        ))}
      </nav>

      {loading && !report ? <div role="status" className="rounded-2xl border border-neutral-warm bg-white p-10 text-center text-sm text-text-muted">Building report…</div> : null}

      {report && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricCard label="Work hours" value={formatHours(report.summary.total_hours)} detail={`${report.summary.entries_count} entries`} />
            <MetricCard label="Regular" value={formatHours(report.summary.regular_hours)} />
            <MetricCard label="Overtime" value={formatHours(report.summary.overtime_hours)} tone="overtime" detail={`${report.overtime_policy.daily_threshold_hours.toFixed(2)}h daily threshold`} />
            <MetricCard label="Breaks" value={formatHours(report.summary.break_hours)} />
            <MetricCard label="People" value={String(report.summary.employee_count)} detail={`${report.employees.reduce((sum, employee) => sum + employee.days_worked, 0)} person-days`} />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className={`rounded-2xl border p-4 ${report.ready ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>
              <p className="text-xs font-bold uppercase tracking-[0.12em]">Approval status</p>
              <p className="mt-1 font-semibold">{report.ready ? 'Approval review complete' : 'Approval review needed'}</p>
              <p className="mt-1 text-sm opacity-80">{report.ready ? 'No pending approvals or open clocks affect this period.' : `${report.summary.pending_count + report.summary.pending_overtime_count} pending review · ${report.summary.open_clock_count} open clocks`}</p>
            </div>
            <button type="button" onClick={() => openReview('all')} className={`rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${report.quality.status === 'clear' ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-300'}`}>
              <p className="text-xs font-bold uppercase tracking-[0.12em]">Data quality</p>
              <p className="mt-1 font-semibold">{report.quality.status === 'clear' ? 'No review flags' : `${report.quality.flagged_entries_count} entries need a look`}</p>
              <p className="mt-1 text-sm opacity-80">Flags do not remove hours from payroll totals.</p>
            </button>
            <div className="rounded-2xl border border-neutral-warm bg-secondary/30 p-4 text-primary-dark">
              <p className="text-xs font-bold uppercase tracking-[0.12em]">Finalization</p>
              <p className="mt-1 font-semibold">{report.finalization.label}</p>
              <p className="mt-1 text-sm text-text-muted">Generated {formatGeneratedAt(report.generated_at)}</p>
            </div>
          </div>
        </>
      )}

      {report && view === 'overview' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {[
            { title: 'Hours by category', rows: categoryRows, empty: 'No category totals in this period.' },
            { title: 'Hours by client', rows: clientRows, empty: 'No client totals in this period.' },
          ].map(section => (
            <section key={section.title} className="overflow-hidden rounded-2xl border border-neutral-warm bg-white shadow-sm">
              <div className="border-b border-neutral-warm bg-neutral-warm/25 px-4 py-3"><h3 className="font-semibold text-primary-dark">{section.title}</h3></div>
              {section.rows.length === 0 ? <p className="p-5 text-sm text-text-muted">{section.empty}</p> : (
                <div className="divide-y divide-neutral-warm">
                  {section.rows.slice(0, 10).map(row => (
                    <div key={row.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3">
                      <div className="min-w-0"><p className="truncate font-medium text-primary-dark">{row.name}</p><p className="text-xs text-text-muted">{row.entries} {row.entries === 1 ? 'entry' : 'entries'}</p></div>
                      <p className="font-bold tabular-nums text-primary">{formatHours(row.hours)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {report && view === 'people' && (
        report.employees.length === 0 ? <EmptyState title="No people in this report" detail="Try a different date range or clear one of the employee filters." /> : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {[...report.employees].sort((a, b) => b.total_hours - a.total_hours).map(employee => (
              <button key={employee.id} type="button" onClick={() => onOpenEmployee(employee)} className="group rounded-2xl border border-neutral-warm bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-lg font-bold text-primary-dark">{employee.full_name || employee.display_name || employee.email}</h3>{employee.status === 'terminated' && <span className="rounded-full border border-stone-300 bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-700">Terminated</span>}</div>
                    <p className="mt-1 text-sm text-text-muted">{employee.days_worked} days · {employee.entries_count} entries{employee.first_work_date && employee.last_work_date ? ` · ${formatWorkDate(employee.first_work_date)}–${formatWorkDate(employee.last_work_date)}` : ''}</p>
                  </div>
                  <span className="shrink-0 text-xl font-bold tabular-nums text-primary">{formatHours(employee.total_hours)}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-neutral-warm/25 p-3 text-sm"><div><p className="text-xs text-text-muted">Regular</p><p className="font-semibold text-primary-dark">{formatHours(employee.regular_hours)}</p></div><div><p className="text-xs text-text-muted">Overtime</p><p className="font-semibold text-orange-700">{formatHours(employee.overtime_hours)}</p></div><div><p className="text-xs text-text-muted">Breaks</p><p className="font-semibold text-primary-dark">{formatHours(employee.break_hours)}</p></div></div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted"><span className="rounded-full bg-secondary/55 px-2.5 py-1">Top category: {[...employee.categories].sort((a, b) => b.total_hours - a.total_hours)[0]?.name || 'None'}</span><span className="rounded-full bg-secondary/55 px-2.5 py-1">Top client: {[...employee.clients].sort((a, b) => b.total_hours - a.total_hours)[0]?.name || 'None'}</span>{employee.quality.flagged_entries_count > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">{employee.quality.flagged_entries_count} flagged</span>}</div>
                <p className="mt-4 text-sm font-semibold text-primary">Open daily and overtime breakdown</p>
              </button>
            ))}
          </div>
        )
      )}

      {report && view === 'daily' && (
        dailyGroups.length === 0 ? <EmptyState title="No approved daily entries" detail="Pending, denied, and open entries appear under Needs review instead of approved totals." /> : (
          <section className="overflow-hidden rounded-2xl border border-neutral-warm bg-white shadow-sm">
            <div className="border-b border-neutral-warm bg-neutral-warm/25 px-4 py-3"><h3 className="font-semibold text-primary-dark">Daily detail</h3><p className="mt-0.5 text-xs text-text-muted">Newest days first. Expand a person-day to inspect and edit its entries.</p></div>
            <div className="divide-y divide-neutral-warm">
              {dailyGroups.slice(0, visibleGroups).map(group => {
                const expanded = expandedGroups.has(group.key)
                const total = group.entries.reduce((sum, entry) => sum + entry.hours, 0)
                const breaks = group.entries.reduce((sum, entry) => sum + (entry.break_minutes || 0), 0)
                const categories = [...new Set(group.entries.map(entry => entry.time_category?.name || 'Uncategorized'))]
                const clientsForDay = [...new Set(group.entries.map(entry => entry.client?.name || 'No client'))]
                const first = group.entries[0]
                const last = group.entries[group.entries.length - 1]
                return (
                  <Fragment key={group.key}>
                    <button type="button" aria-expanded={expanded} onClick={() => toggleGroup(group.key)} className="grid min-h-16 w-full grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 text-left transition hover:bg-secondary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
                      <div><p className="font-semibold text-primary-dark">{formatWorkDate(group.date)}</p><p className="text-xs text-text-muted sm:hidden">{group.employee}</p></div>
                      <div className="hidden min-w-0 sm:block"><p className="truncate font-medium text-primary-dark">{group.employee}</p><p className="truncate text-xs text-text-muted">{first.formatted_start_time || '—'}–{last.formatted_end_time || '—'} · {categories.join(', ')} · {clientsForDay.join(', ')}</p></div>
                      <div className="flex items-center gap-3"><div className="text-right"><p className="font-bold tabular-nums text-primary">{formatHours(total)}</p><p className="text-xs text-text-muted">{group.entries.length} entries{breaks ? ` · ${breaks}m breaks` : ''}</p></div><ChevronIcon open={expanded} /></div>
                    </button>
                    {expanded && <div className="space-y-2 bg-secondary/20 px-4 py-4 sm:pl-[196px]">{group.entries.map(entry => <EntryCard key={entry.id} entry={entry} onEdit={() => onEditEntry(entry)} />)}</div>}
                  </Fragment>
                )
              })}
            </div>
            {visibleGroups < dailyGroups.length && <div className="border-t border-neutral-warm p-4 text-center"><button type="button" onClick={() => setVisibleGroups(count => count + 40)} className="min-h-11 rounded-xl border border-primary/25 px-5 py-2 text-sm font-semibold text-primary transition hover:bg-secondary/40">Show 40 more <span className="font-normal text-text-muted">({dailyGroups.length - visibleGroups} remaining)</span></button></div>}
          </section>
        )
      )}

      {report && view === 'review' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {issueCards.map(issue => <button key={issue.filter} type="button" onClick={() => setReviewFilter(issue.filter)} className={`rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${reviewFilter === issue.filter ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-neutral-warm bg-white hover:border-amber-300'}`}><div className="flex items-center justify-between gap-2 text-amber-800"><WarningIcon /><span className="text-2xl font-bold tabular-nums">{issue.count}</span></div><p className="mt-3 text-sm font-semibold text-primary-dark">{issue.label}</p><p className="mt-1 text-xs leading-relaxed text-text-muted">{issue.note}</p></button>)}
          </div>

          {reviewFilter !== 'unresolved' && visibleFlaggedEntries.length > 0 && <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white"><div className="border-b border-amber-200 bg-amber-50 px-4 py-3"><h3 className="font-semibold text-amber-950">Approved entries with review flags</h3><p className="mt-1 text-xs text-amber-800">These hours remain included in the totals.</p></div><div className="space-y-2 p-4">{visibleFlaggedEntries.map(entry => <EntryCard key={entry.id} entry={entry} onEdit={() => onEditEntry(entry)} showFlags />)}</div></section>}

          {(reviewFilter === 'all' || reviewFilter === 'unresolved') && unresolvedEntries.length > 0 && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><h3 className="font-semibold text-primary-dark">Excluded or unresolved time</h3><p className="mt-1 text-xs text-text-muted">These entries are documented but are not included in approved-hour totals.</p></div><div className="space-y-2 p-4">{unresolvedEntries.map(({ entry, employee }) => <div key={entry.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-primary-dark">{employee.full_name} · {formatWorkDate(entry.work_date)}</p><p className="mt-1 text-sm text-text-muted">{entry.formatted_start_time || '—'}–{entry.formatted_end_time || '—'} · {formatHours(entry.total_hours)}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-700">{entry.approval_status || entry.entry_method}</span></div></div>)}</div></section>}

          {visibleFlaggedEntries.length === 0 && unresolvedEntries.length === 0 && <EmptyState title="Nothing needs review" detail="This period has no missing details, long shifts, overlaps, pending approvals, denied entries, or open clocks." />}
          {reviewFilter !== 'all' && reviewFilter !== 'unresolved' && visibleFlaggedEntries.length === 0 && <EmptyState title={`No ${REVIEW_LABELS[reviewFilter].toLowerCase()} entries`} detail="Choose another review category or change the report period." />}
        </div>
      )}
    </div>
  )
}

function EntryCard({ entry, onEdit, showFlags = false }: { entry: TimeEntry; onEdit: () => void; showFlags?: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-warm bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-primary-dark">{entry.formatted_start_time || entry.start_time || '—'}–{entry.formatted_end_time || entry.end_time || '—'} · {formatHours(entry.hours)}</p>
          <p className="mt-1 text-sm text-text-muted">{entry.time_category?.name || 'Uncategorized'} · {entry.client?.name || 'No client assigned'} · {entry.entry_method}</p>
          <p className="mt-1 text-sm text-primary-dark">{entry.description || 'No description'}</p>
          {showFlags && entry.review_flags && <div className="mt-3 flex flex-wrap gap-1.5">{entry.review_flags.map(flag => <span key={flag} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{REVIEW_LABELS[flag]}</span>)}</div>}
        </div>
        <button type="button" onClick={onEdit} className="min-h-11 shrink-0 rounded-xl border border-primary/25 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Edit entry</button>
      </div>
    </div>
  )
}
