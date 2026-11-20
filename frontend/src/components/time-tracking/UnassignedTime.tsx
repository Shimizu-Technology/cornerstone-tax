import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { TimeEntry, UnassignedTimeEntry, UnassignedTimeResponse } from '../../lib/api'
import { formatMinutes } from '../../lib/workDuration'

interface UserOption { id: number; full_name?: string; display_name?: string; email?: string }

const fieldClass = 'min-h-11 w-full rounded-lg border border-neutral-warm bg-white px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary'

const MISSING_LABEL: Record<string, string> = {
  client: 'no client',
  description: 'no description',
  category: 'no category',
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Admin clean-up list for time that isn't attributed to a client (or, with
 * "Anything missing", that misses what the cutover rule asks for). Each row
 * opens the regular entry editor; fixing only work lines keeps an approved
 * entry approved.
 */
export default function UnassignedTime({
  users,
  onEditEntry,
  refreshKey = 0,
}: {
  users: UserOption[]
  onEditEntry: (entry: TimeEntry) => void
  /** Bump after an edit so the list reloads. */
  refreshKey?: number
}) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [userId, setUserId] = useState('')
  const [issue, setIssue] = useState<'client' | 'any'>('client')
  const [page, setPage] = useState(1)
  // Each response is tagged with the request it answers, so "loading" is
  // simply "the latest result is for an older request".
  const requestKey = JSON.stringify({ startDate, endDate, userId, issue, page, refreshKey })
  const [result, setResult] = useState<{ key: string; data: UnassignedTimeResponse | null; error: string | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    void api.getUnassignedTime({
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      user_id: userId ? Number(userId) : undefined,
      issue,
      page,
    }).then((response) => {
      if (cancelled) return
      setResult((previous) => ({
        key: requestKey,
        data: response.error ? previous?.data ?? null : response.data ?? null,
        error: response.error ?? null,
      }))
    })
    return () => { cancelled = true }
  }, [requestKey, startDate, endDate, userId, issue, page])

  const data = result?.data ?? null
  const error = result?.error ?? null
  const loading = result?.key !== requestKey

  const entries: UnassignedTimeEntry[] = data?.time_entries ?? []
  const summary = data?.summary

  return (
    <section aria-labelledby="unassigned-heading" className="space-y-4">
      <div className="rounded-2xl border border-neutral-warm bg-white p-4 shadow-sm">
        <h2 id="unassigned-heading" className="text-lg font-bold text-primary-dark">Unassigned time</h2>
        <p className="mt-1 text-sm text-text-muted">
          Hours that aren't attributed to a client. Open an entry to add the client and what was done; changing only the work
          lines keeps an approved entry approved.
          {summary?.cutover_date && <> Client and description are required from {formatDate(summary.cutover_date)}.</>}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="unassigned-start" className="mb-1 block text-sm font-medium text-primary-dark">From</label>
            <input id="unassigned-start" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1) }} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="unassigned-end" className="mb-1 block text-sm font-medium text-primary-dark">To</label>
            <input id="unassigned-end" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1) }} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="unassigned-user" className="mb-1 block text-sm font-medium text-primary-dark">Person</label>
            <select id="unassigned-user" value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1) }} className={fieldClass}>
              <option value="">Everyone</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.full_name || user.display_name || user.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="unassigned-issue" className="mb-1 block text-sm font-medium text-primary-dark">Show</label>
            <select id="unassigned-issue" value={issue} onChange={(e) => { setIssue(e.target.value as 'client' | 'any'); setPage(1) }} className={fieldClass}>
              <option value="client">No client</option>
              <option value="any">Anything missing</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {summary && (
        <div className="flex flex-wrap gap-2" aria-live="polite">
          <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">
            {summary.hours.toFixed(2)}h in {summary.entry_count} {summary.entry_count === 1 ? 'entry' : 'entries'}
          </span>
          {summary.by_user.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => { setUserId(String(row.id)); setPage(1) }}
              className="min-h-11 rounded-full border border-neutral-warm bg-white px-3 text-sm text-primary-dark hover:bg-secondary"
            >
              {row.name}: {row.hours.toFixed(2)}h
            </button>
          ))}
        </div>
      )}

      {loading && !data ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-warm bg-white p-6 text-center text-sm text-text-muted">
          Nothing to fix for these filters.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const issuesByLine = new Map(entry.line_issues.map((row) => [row.id, row.missing]))
            return (
              <li key={entry.id} className="rounded-2xl border border-neutral-warm bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-primary-dark">
                      {entry.user?.full_name || 'Unknown'} · {formatDate(entry.work_date)}
                    </p>
                    <p className="text-sm text-text-muted">
                      {entry.formatted_start_time && entry.formatted_end_time ? `${entry.formatted_start_time}–${entry.formatted_end_time} · ` : ''}
                      {entry.hours.toFixed(2)}h · {entry.entry_method === 'clock' ? 'Clock' : 'Manual'}
                      {entry.approval_status ? ` · ${entry.approval_status}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEditEntry(entry)}
                    disabled={Boolean(entry.locked_at)}
                    className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                    aria-label={`Fix ${entry.user?.full_name || 'entry'} on ${formatDate(entry.work_date)}`}
                  >
                    {entry.locked_at ? 'Locked' : 'Fix'}
                  </button>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {(entry.work_lines || []).map((line) => {
                    const missing = (line.id && issuesByLine.get(line.id)) || []
                    return (
                      <li key={line.id ?? line.position} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-secondary/40 px-3 py-2">
                        <span className="min-w-0">
                          <span className="font-medium text-primary-dark">{line.client_label}</span>
                          {line.description ? <span className="text-text-muted"> — {line.description}</span> : null}
                          {missing.length > 0 && (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              {missing.map((key) => MISSING_LABEL[key] || key).join(', ')}
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums text-text-muted">{formatMinutes(line.minutes)}</span>
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      )}

      {data && data.pagination.total_pages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Unassigned time pages">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="min-h-11 rounded-lg border border-neutral-warm px-4 text-sm disabled:opacity-50">Previous</button>
          <span className="text-sm text-text-muted">Page {page} of {data.pagination.total_pages}</span>
          <button type="button" disabled={page >= data.pagination.total_pages} onClick={() => setPage(page + 1)} className="min-h-11 rounded-lg border border-neutral-warm px-4 text-sm disabled:opacity-50">Next</button>
        </nav>
      )}
    </section>
  )
}
