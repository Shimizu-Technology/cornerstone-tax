import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { PayPeriods, WorkSummaryResponse } from '../../lib/api'
import { formatMinutes } from '../../lib/workDuration'

interface UserOption { id: number; full_name?: string; display_name?: string; email?: string }

const fieldClass = 'min-h-11 w-full rounded-lg border border-neutral-warm bg-white px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary'

function guamToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Guam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function weekStart(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return addDays(iso, -new Date(Date.UTC(year, month - 1, day)).getUTCDay())
}

function dayLabel(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

type Preset = 'this_pay_period' | 'last_pay_period' | 'two_weeks' | 'this_week' | 'last_week' | 'custom'

function shortDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function presetRange(preset: Preset, payPeriods: PayPeriods | null = null): { start: string; end: string } | null {
  const today = guamToday()
  if (preset === 'this_pay_period' || preset === 'last_pay_period') {
    const period = payPeriods?.[preset === 'this_pay_period' ? 'current' : 'previous']
    return period ? { start: period.start_date, end: period.end_date } : null
  }
  if (preset === 'two_weeks') return { start: addDays(today, -13), end: today }
  if (preset === 'this_week') return { start: weekStart(today), end: today }
  if (preset === 'last_week') {
    const start = addDays(weekStart(today), -7)
    return { start, end: addDays(start, 6) }
  }
  return null
}

/**
 * A person's work for a pay period: each day's lines, then totals per client
 * in hours and minutes, with CSV and PDF downloads. Staff see their own;
 * admins can pick anyone. Replaces the emailed "summary of hours" sheets.
 */
export default function WorkSummary({ currentUserId, isAdmin, users }: { currentUserId: number | null; isAdmin: boolean; users: UserOption[] }) {
  // Opens on this pay period (Settings > Pay schedule). The dates fill in
  // once the periods load; if they can't load, the last two weeks are used.
  const [preset, setPreset] = useState<Preset>('this_pay_period')
  const [payPeriods, setPayPeriods] = useState<PayPeriods | null>(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  // Set once the person picks a period or a date; the starting period is
  // applied only if they haven't, and then as a whole (preset and both dates).
  const touched = useRef(false)
  const presetPick = useRef(0)

  useEffect(() => {
    let cancelled = false
    void api.getPayPeriods().then((response) => {
      if (cancelled) return
      const periods = response.data ?? null
      setPayPeriods(periods)
      if (touched.current) return
      const initial: Preset = periods ? 'this_pay_period' : 'two_weeks'
      const range = presetRange(initial, periods)!
      setPreset(initial)
      setStart(range.start)
      setEnd(range.end)
    })
    return () => { cancelled = true }
  }, [])
  const [userId, setUserId] = useState<string>('')
  const [downloading, setDownloading] = useState<'csv' | 'pdf' | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const targetUser = isAdmin && userId ? Number(userId) : undefined
  const requestKey = `${start}:${end}:${targetUser ?? 'me'}`
  const [result, setResult] = useState<{ key: string; data: WorkSummaryResponse | null; error: string | null } | null>(null)
  const loading = result?.key !== requestKey

  useEffect(() => {
    if (!currentUserId || !start || !end) return
    let cancelled = false
    void api.getWorkSummary({ start_date: start, end_date: end, user_id: targetUser }).then((response) => {
      if (!cancelled) setResult({ key: requestKey, data: response.data ?? null, error: response.error ?? null })
    })
    return () => { cancelled = true }
  }, [currentUserId, start, end, targetUser, requestKey])

  const choosePreset = async (next: Preset) => {
    touched.current = true
    const pick = ++presetPick.current
    setPreset(next)
    let periods = payPeriods
    // Loaded before a period boundary passed (the page stayed open): ask
    // again so "This pay period" is today's.
    if ((next === 'this_pay_period' || next === 'last_pay_period') && periods && guamToday() > periods.current.end_date) {
      const response = await api.getPayPeriods()
      if (pick !== presetPick.current) return // a newer choice was made meanwhile
      if (response.data) {
        periods = response.data
        setPayPeriods(periods)
      }
    }
    const range = presetRange(next, periods)
    if (range) {
      setStart(range.start)
      setEnd(range.end)
    }
  }

  const download = async (type: 'csv' | 'pdf') => {
    setDownloading(type)
    setDownloadError(null)
    const response = await api.downloadWorkSummary(type, { start_date: start, end_date: end, user_id: targetUser })
    setDownloading(null)
    if (response.error || !response.blob) {
      setDownloadError(response.error || 'Download failed')
      return
    }
    const url = URL.createObjectURL(response.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = response.filename || `Work_Summary.${type}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const summary = result?.data ?? null
  if (!currentUserId) return null

  return (
    <section aria-labelledby="work-summary-heading" className="space-y-4">
      <div className="rounded-2xl border border-neutral-warm bg-white p-4 shadow-sm">
        <h2 id="work-summary-heading" className="text-lg font-bold text-primary-dark">Work summary</h2>
        <p className="mt-1 text-sm text-text-muted">Each day's work by client, then totals per client. Download it instead of sending a spreadsheet.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isAdmin && (
            <div>
              <label htmlFor="work-summary-person" className="mb-1 block text-sm font-medium text-primary-dark">Person</label>
              <select id="work-summary-person" value={userId} onChange={(e) => setUserId(e.target.value)} className={fieldClass}>
                <option value="">Me</option>
                {users.filter((user) => user.id !== currentUserId).map((user) => (
                  <option key={user.id} value={user.id}>{user.full_name || user.display_name || user.email}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="work-summary-preset" className="mb-1 block text-sm font-medium text-primary-dark">Period</label>
            <select id="work-summary-preset" value={preset} onChange={(e) => void choosePreset(e.target.value as Preset)} className={fieldClass} aria-describedby={payPeriods ? 'work-summary-schedule' : undefined}>
              {!payPeriods && preset === 'this_pay_period' && <option value="this_pay_period">This pay period</option>}
              {payPeriods && (
                <>
                  <option value="this_pay_period">This pay period ({shortDate(payPeriods.current.start_date)} – {shortDate(payPeriods.current.end_date)})</option>
                  <option value="last_pay_period">Last pay period ({shortDate(payPeriods.previous.start_date)} – {shortDate(payPeriods.previous.end_date)})</option>
                </>
              )}
              <option value="two_weeks">Last 2 weeks</option>
              <option value="this_week">This week</option>
              <option value="last_week">Last week</option>
              <option value="custom">Custom dates</option>
            </select>
          </div>
          <div>
            <label htmlFor="work-summary-start" className="mb-1 block text-sm font-medium text-primary-dark">From</label>
            <input id="work-summary-start" type="date" value={start} max={end} onChange={(e) => { touched.current = true; presetPick.current += 1; setPreset('custom'); setStart(e.target.value) }} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="work-summary-end" className="mb-1 block text-sm font-medium text-primary-dark">To</label>
            <input id="work-summary-end" type="date" value={end} min={start} onChange={(e) => { touched.current = true; presetPick.current += 1; setPreset('custom'); setEnd(e.target.value) }} className={fieldClass} />
          </div>
        </div>
        {payPeriods && (
          <p id="work-summary-schedule" className="mt-2 text-xs text-text-muted">
            Pay schedule: {payPeriods.label}.{isAdmin && ' Change it in Settings → System → Time tracking.'}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void download('pdf')} disabled={!summary || downloading !== null} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
            {downloading === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
          </button>
          <button type="button" onClick={() => void download('csv')} disabled={!summary || downloading !== null} className="min-h-11 rounded-lg border border-neutral-warm px-4 text-sm font-semibold text-primary-dark hover:bg-secondary disabled:opacity-50">
            {downloading === 'csv' ? 'Preparing CSV…' : 'Download CSV'}
          </button>
        </div>
        {downloadError && <p role="alert" className="mt-2 text-sm text-red-700">{downloadError}</p>}
      </div>

      {result?.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{result.error}</div>}
      {loading && !summary && <p className="text-sm text-text-muted">Loading…</p>}

      {summary && (
        <>
          <div className="flex flex-wrap gap-2 text-sm" aria-live="polite">
            <span className="rounded-full bg-secondary px-3 py-1 font-semibold text-primary-dark">{summary.user.full_name}: {summary.total_label} ({summary.total_hours.toFixed(2)}h)</span>
            {summary.counts.pending_entries > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">{summary.counts.pending_entries} pending approval</span>}
            {summary.counts.unassigned_minutes > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">{formatMinutes(summary.counts.unassigned_minutes)} without a client</span>}
            {summary.counts.denied_entries > 0 && <span className="rounded-full bg-neutral-warm/50 px-3 py-1 text-text-muted">{summary.counts.denied_entries} denied, not included</span>}
          </div>

          <div className="rounded-2xl border border-neutral-warm bg-white p-4 shadow-sm">
            <h3 className="text-base font-bold text-primary-dark">By day</h3>
            {summary.days.length === 0 ? (
              <p className="mt-2 text-sm text-text-muted">No work logged in this period.</p>
            ) : (
              <div className="mt-3 space-y-4">
                {summary.days.map((day) => (
                  <section key={day.work_date} aria-label={dayLabel(day.work_date)}>
                    <div className="flex items-baseline justify-between border-b border-neutral-warm pb-1">
                      <h4 className="font-semibold text-primary-dark">{dayLabel(day.work_date)}</h4>
                      <span className="text-sm font-semibold tabular-nums text-primary-dark">{day.total_label}</span>
                    </div>
                    <ul className="mt-1 divide-y divide-neutral-warm/60">
                      {day.lines.map((line, index) => (
                        <li key={`${line.entry_id}-${index}`} className="grid grid-cols-[1fr_auto] gap-x-3 py-2 text-sm md:grid-cols-[12rem_1fr_auto]">
                          <span className="font-medium text-primary-dark">{line.client_name}</span>
                          <span className="tabular-nums text-right text-primary-dark md:order-last">
                            {formatMinutes(line.minutes)}{line.approval_state === 'pending' && <span className="ml-1 text-xs text-amber-700">pending</span>}
                          </span>
                          <span className="col-span-2 text-text-muted md:col-span-1">
                            {line.description || <em>No description</em>}
                            {[line.category, line.task, line.period].filter(Boolean).length > 0 && ` · ${[line.category, line.task, line.period].filter(Boolean).join(' / ')}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-warm bg-white p-4 shadow-sm">
            <h3 className="text-base font-bold text-primary-dark">Totals by client</h3>
            {/* Columns get real spacing; on a phone the minutes column is
                left out (hours and h:m stay; the CSV and PDF keep all three). */}
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
                  <th scope="col" className="py-2 pr-3">Client</th>
                  <th scope="col" className="hidden py-2 pl-4 text-right sm:table-cell">Minutes</th>
                  <th scope="col" className="py-2 pl-4 text-right">Hours</th>
                  <th scope="col" className="py-2 pl-4 text-right">h:m</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-warm/60">
                {summary.clients.map((client) => (
                  <tr key={client.client_id ?? 'unassigned'}>
                    <th scope="row" className="break-words py-2 pr-3 text-left font-medium text-primary-dark">{client.client_name}</th>
                    <td className="hidden whitespace-nowrap py-2 pl-4 text-right tabular-nums sm:table-cell">{client.minutes}</td>
                    <td className="whitespace-nowrap py-2 pl-4 text-right tabular-nums">{client.hours.toFixed(2)}</td>
                    <td className="whitespace-nowrap py-2 pl-4 text-right tabular-nums">{client.label}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-warm font-semibold text-primary-dark">
                  <th scope="row" className="py-2 pr-3 text-left">Total</th>
                  <td className="hidden whitespace-nowrap py-2 pl-4 text-right tabular-nums sm:table-cell">{summary.total_minutes}</td>
                  <td className="whitespace-nowrap py-2 pl-4 text-right tabular-nums">{summary.total_hours.toFixed(2)}</td>
                  <td className="whitespace-nowrap py-2 pl-4 text-right tabular-nums">{summary.total_label}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
