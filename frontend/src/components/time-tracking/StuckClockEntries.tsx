import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { TimeEntry } from '../../lib/api'

function formatDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Admin "needs attention" card for clock entries left clocked in with an end
 * time. They don't count toward hours and keep the person clocked in, so an
 * admin marks each one completed: it keeps its recorded times and goes to
 * the approval queue. Renders nothing when there are none.
 */
export default function StuckClockEntries({ onResolved }: { onResolved?: () => void }) {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  // A failed list request is shown, not treated as "nothing stuck".
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await api.getStuckClockEntries()
      if (response.data) {
        setEntries(response.data.time_entries)
        setLoadError(null)
      } else {
        setLoadError(response.error || 'Could not check for clock entries that need attention.')
      }
    } catch {
      setLoadError('Could not check for clock entries that need attention.')
    }
  }, [])

  const retry = async () => {
    setReloading(true)
    try {
      await load()
    } finally {
      setReloading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  const markCompleted = async (entry: TimeEntry) => {
    const name = entry.user?.full_name || 'this person'
    const times = `${entry.formatted_start_time || '?'}–${entry.formatted_end_time || '?'}`
    if (!window.confirm(`Mark ${name}'s entry on ${formatDate(entry.work_date)} (${times}, ${entry.hours.toFixed(2)}h) completed? It keeps these times and goes to Pending Approvals.`)) return

    setBusyId(entry.id)
    setError(null)
    setMessage(null)
    try {
      const response = await api.markTimeEntryCompleted(entry.id, entry.version)
      if (response.error || !response.data) {
        setError(response.error || 'Could not mark the entry completed. Please try again.')
        await load()
        return
      }
      setEntries((previous) => previous.filter((row) => row.id !== entry.id))
      setMessage(`Marked ${name}'s entry completed. It's now in Pending Approvals.`)
      onResolved?.()
    } finally {
      setBusyId(null)
    }
  }

  // Hidden only after a successful, empty list.
  if (entries.length === 0 && !message && !error && !loadError) return null

  return (
    <section aria-labelledby="stuck-clock-heading" className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 id="stuck-clock-heading" className="text-base font-semibold text-primary-dark">Needs attention</h2>
      {entries.length > 0 && (
        <p className="mt-1 text-sm text-text-muted">
          {entries.length === 1 ? 'This clock entry was' : 'These clock entries were'} left clocked in with an end time, so the hours don’t count
          and the person can’t clock in. Mark it completed to keep its times and send it for approval.
        </p>
      )}
      {loadError && (
        <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{loadError}</span>
          <button type="button" onClick={() => void retry()} disabled={reloading} className="min-h-11 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
            {reloading ? 'Checking…' : 'Try again'}
          </button>
        </div>
      )}
      {error && <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>}
      {entries.length > 0 && (
        <ul className="mt-3 divide-y divide-neutral-warm rounded-xl border border-neutral-warm" aria-label="Entries left clocked in">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-primary-dark">{entry.user?.full_name || 'Unknown'} · {formatDate(entry.work_date)}</p>
                <p className="text-sm text-text-muted">
                  {entry.formatted_start_time}–{entry.formatted_end_time} · {entry.hours.toFixed(2)}h · still clocked in
                </p>
              </div>
              <button
                type="button"
                onClick={() => void markCompleted(entry)}
                disabled={busyId !== null}
                aria-label={`Mark ${entry.user?.full_name || 'entry'} on ${formatDate(entry.work_date)} completed`}
                className="min-h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {busyId === entry.id ? 'Marking…' : 'Mark completed'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
