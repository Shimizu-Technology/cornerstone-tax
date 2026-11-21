import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import type { ServiceType, TimeEntry } from '../../lib/api'
import type { ClientOption } from '../../lib/timeEntryWork'
import { formatMinutes, minutesToHoursText } from '../../lib/workDuration'
import WorkLinesEditor from './WorkLinesEditor'
import { readDrafts, writeDrafts, type DayDraft } from './logMyDayDrafts'
import { checkLines, detailsRequired, draftMinutes, draftsFromEntry, linesPayload, newDraft, useWorkLineSuggestions, type WorkLineDraft } from './workLinesModel'

const DAY_LOG = 'day-log'

function guamToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Guam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function longDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

/** Unsaved drafts for one person, mirrored to sessionStorage (best effort). */
function useDayDrafts(userId: number | null): [Record<string, DayDraft>, (next: Record<string, DayDraft>) => void] {
  const [state, setState] = useState<{ userId: number | null; drafts: Record<string, DayDraft> }>(() => ({ userId, drafts: readDrafts(userId) }))
  const drafts = state.userId === userId ? state.drafts : readDrafts(userId)
  const update = (next: Record<string, DayDraft>) => {
    setState({ userId, drafts: next })
    writeDrafts(userId, next)
  }
  return [drafts, update]
}

function draftLabel(date: string, session: TimeEntry | null): string {
  const [year, month, day] = date.split('-').map(Number)
  const dayText = new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return session ? `${dayText}, clock ${session.formatted_start_time}–${session.formatted_end_time}` : `${dayText}, day log`
}

const entryMinutes = (entry: TimeEntry) => Math.round(entry.hours * 60)
const assignedMinutes = (entry: TimeEntry) =>
  (entry.work_lines || []).filter((line) => line.client).reduce((sum, line) => sum + line.minutes, 0)

/**
 * "Log my day": a quick grid for one day's work, filled in after the fact.
 * With clock sessions, each session's time is split across clients (the
 * remaining counter shows what is still unassigned). Work done off the clock
 * goes in a day log: a manual entry with no times whose hours are the total
 * of its lines.
 */
export default function LogMyDay({
  userId,
  userName,
  clients,
  serviceTypes,
  catalogError,
  onRetryCatalog,
  onSaved,
}: {
  userId: number | null
  userName?: string
  clients: ClientOption[]
  serviceTypes: ServiceType[]
  catalogError?: string | null
  onRetryCatalog?: () => void
  onSaved?: () => void
}) {
  const [date, setDate] = useState(guamToday)
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState<{ key: string; entries: TimeEntry[]; error: string | null } | null>(null)
  const requestKey = `${userId}:${date}:${reload}`
  const loading = result?.key !== requestKey
  const entries = useMemo(() => result?.entries ?? [], [result])
  const suggestions = useWorkLineSuggestions(Boolean(userId), userId)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void api.getTimeEntries({ date, user_id: userId, per_page: 100 }).then((response) => {
      if (cancelled) return
      setResult({ key: requestKey, entries: response.data?.time_entries ?? [], error: response.error ?? null })
    })
    return () => { cancelled = true }
  }, [date, userId, requestKey])

  const sessions = useMemo(
    () => entries.filter((entry) => entry.entry_method === 'clock' && entry.status === 'completed' && entry.hours > 0)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
    [entries],
  )
  const activeClock = entries.find((entry) => entry.status !== 'completed')
  const dayLog = entries.find((entry) => entry.duration_only)
  const timedManual = entries.filter((entry) => entry.entry_method === 'manual' && !entry.duration_only && entry.approval_status !== 'denied')

  // Which record the grid edits: a clock session (by id) or the day log.
  // Kept per day (not per reload), so saving doesn't jump to another session.
  const dayKey = `${userId}:${date}`
  const [selection, setSelection] = useState<{ key: string; target: string } | null>(null)
  const [drafts, setDrafts] = useDayDrafts(userId)
  // Reopening a day lands on the session (or day log) that has unsaved lines.
  const draftTargetForDay = Object.keys(drafts).find((key) => key.startsWith(`${dayKey}:`))?.split(':')[2]
  const defaultTarget = draftTargetForDay ?? sessions.find((entry) => assignedMinutes(entry) < entryMinutes(entry))?.id ?? sessions[0]?.id
  const target = selection?.key === dayKey ? selection.target : String(defaultTarget ?? DAY_LOG)
  const session = sessions.find((entry) => String(entry.id) === target) ?? null
  // The record this grid saves to. A session target never falls back to the
  // day log: if the session is gone, saving is blocked (see draftConflict).
  const editing = target === DAY_LOG ? dayLog ?? null : session

  // Unsaved lines are kept per day and session (and in sessionStorage), so
  // switching dates, sessions or tabs never drops or overwrites them.
  const draftKey = `${dayKey}:${target}`
  const draft = drafts[draftKey]
  const lines = draft ? draft.lines : editing ? draftsFromEntry(editing) : [newDraft()]
  const setLines = (next: WorkLineDraft[]) =>
    setDrafts({
      ...drafts,
      [draftKey]: {
        lines: next,
        baseEntryId: draft ? draft.baseEntryId ?? null : editing?.id ?? null,
        baseUpdatedAt: draft ? draft.baseUpdatedAt : editing?.updated_at ?? null,
        label: draftLabel(date, session),
      },
    })
  const discardDraft = () => {
    const rest = { ...drafts }
    delete rest[draftKey]
    setDrafts(rest)
  }
  const otherDrafts = Object.entries(drafts).filter(([key]) => key !== draftKey)
  // Saving is blocked when the record the lines were for is gone, or changed
  // on the server since the draft started, so a draft never overwrites (or
  // silently lands on) another record.
  const draftConflict: 'missing' | 'changed' | null = (() => {
    if (loading) return null
    if (target !== DAY_LOG) {
      if (!session) return 'missing'
      return draft?.baseUpdatedAt && session.updated_at !== draft.baseUpdatedAt ? 'changed' : null
    }
    if (!draft) return null
    if (draft.baseEntryId) {
      if (!dayLog || dayLog.id !== draft.baseEntryId) return 'missing'
      return dayLog.updated_at !== draft.baseUpdatedAt ? 'changed' : null
    }
    // A new day log was started here, but one has been saved since.
    return dayLog ? 'changed' : null
  })()

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const targetMinutes = session ? entryMinutes(session) : null
  const required = detailsRequired(suggestions.requiredFrom, date)
  const check = checkLines(lines, { targetMinutes, required, clients, singleCoversTarget: false })
  const dirty = Boolean(draft)

  // Warn before leaving the page while anything is unsaved.
  const hasUnsaved = Object.keys(drafts).length > 0
  useEffect(() => {
    if (!hasUnsaved) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasUnsaved])

  const clockMinutes = sessions.reduce((sum, entry) => sum + entryMinutes(entry), 0)
  const clockAssigned = sessions.reduce((sum, entry) => {
    if (session && entry.id === session.id) {
      return sum + lines.filter((line) => line.client_id).reduce((acc, line) => acc + (draftMinutes(line) ?? 0), 0)
    }
    return sum + assignedMinutes(entry)
  }, 0)
  // The grid only stands in for the day log when the day log is the target.
  const dayLogMinutes = target !== DAY_LOG
    ? (dayLog ? entryMinutes(dayLog) : 0)
    : lines.reduce((sum, line) => sum + (draftMinutes(line) ?? 0), 0)
  const manualMinutes = timedManual.filter((entry) => !entry.duration_only).reduce((sum, entry) => sum + entryMinutes(entry), 0)
  const totalLogged = clockMinutes + dayLogMinutes + manualMinutes
  const unallocated = Math.max(0, clockMinutes - clockAssigned)

  const changeDate = (next: string) => {
    if (saving) return
    setDate(next)
    setMessage(null)
  }

  const openDraft = (key: string) => {
    if (saving) return
    const [, draftDate, draftTarget] = key.split(':')
    setDate(draftDate)
    setSelection({ key: `${userId}:${draftDate}`, target: draftTarget })
    setMessage(null)
  }

  const save = async () => {
    if (!userId || !check.canSubmit || draftConflict) return
    setSaving(true)
    setMessage(null)
    // Each target saves only to its own record (never falls back to another).
    const response = target !== DAY_LOG
      ? await api.updateTimeEntry(session!.id, { work_lines: linesPayload(lines, targetMinutes, false) })
      : dayLog
        ? await api.updateTimeEntry(dayLog.id, { work_date: date, work_lines: linesPayload(lines, null) })
        : await api.createTimeEntry({ work_date: date, work_lines: linesPayload(lines, null) })
    setSaving(false)
    if (response.error) {
      setMessage({ tone: 'error', text: response.error })
      return
    }
    const saved = response.data?.time_entry
    setMessage({ tone: 'ok', text: saved?.approval_status === 'pending' ? 'Saved. It will show as pending until an admin approves it.' : 'Saved.' })
    discardDraft()
    setReload((value) => value + 1)
    onSaved?.()
  }

  // Deliberate way out of a conflict: keep the lines as their own day log.
  const saveAsNewDayLog = async () => {
    if (!userId || saving) return
    setSaving(true)
    setMessage(null)
    const response = await api.createTimeEntry({ work_date: date, work_lines: linesPayload(lines, null) })
    setSaving(false)
    if (response.error) {
      setMessage({ tone: 'error', text: response.error })
      return
    }
    discardDraft()
    setSelection({ key: dayKey, target: DAY_LOG })
    setMessage({ tone: 'ok', text: 'Saved as a separate day log.' })
    setReload((value) => value + 1)
    onSaved?.()
  }

  if (!userId) return null

  return (
    <section aria-labelledby="log-my-day-heading" className="space-y-4">
      <div className="rounded-2xl border border-neutral-warm bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="log-my-day-heading" className="text-lg font-bold text-primary-dark">Log my day</h2>
            <p className="text-sm text-text-muted">
              {userName ? `${userName} · ` : ''}List each client and what you did, in minutes or hours. Enter on a time adds a row.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => changeDate(shiftDate(date, -1))} disabled={saving} className="min-h-11 min-w-11 rounded-lg border border-neutral-warm text-lg" aria-label="Previous day">‹</button>
            <label htmlFor="log-my-day-date" className="sr-only">Day</label>
            <input
              id="log-my-day-date"
              type="date"
              value={date}
              max={guamToday()}
              onChange={(event) => event.target.value && changeDate(event.target.value)}
              disabled={saving}
              className="min-h-11 rounded-lg border border-neutral-warm px-3 text-base md:text-sm"
            />
            <button type="button" onClick={() => changeDate(shiftDate(date, 1))} disabled={saving || date >= guamToday()} className="min-h-11 min-w-11 rounded-lg border border-neutral-warm text-lg disabled:opacity-40" aria-label="Next day">›</button>
          </div>
        </div>
        <p className="mt-2 text-sm font-medium text-primary-dark">{longDate(date)}</p>

        <dl className="mt-3 grid grid-cols-3 gap-2 text-center" aria-live="polite">
          <div className="rounded-xl bg-secondary/40 p-2">
            <dt className="text-xs text-text-muted">On the clock</dt>
            <dd className="font-semibold tabular-nums text-primary-dark">{formatMinutes(clockMinutes)}</dd>
          </div>
          <div className="rounded-xl bg-secondary/40 p-2">
            <dt className="text-xs text-text-muted">Total logged</dt>
            <dd className="font-semibold tabular-nums text-primary-dark">{formatMinutes(totalLogged)}</dd>
          </div>
          <div className={`rounded-xl p-2 ${unallocated ? 'bg-amber-50' : 'bg-emerald-50'}`}>
            <dt className="text-xs text-text-muted">Clock time without a client</dt>
            <dd className={`font-semibold tabular-nums ${unallocated ? 'text-amber-800' : 'text-emerald-800'}`}>{formatMinutes(unallocated)}</dd>
          </div>
        </dl>
      </div>

      {result?.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{result.error}</div>}
      {catalogError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{catalogError}</span>
          {onRetryCatalog && <button type="button" onClick={onRetryCatalog} className="min-h-11 rounded-lg border border-red-300 bg-white px-3 font-semibold">Try again</button>}
        </div>
      )}
      {activeClock && (
        <p className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
          You're clocked in. Split the current session when you clock out; finished sessions show here.
        </p>
      )}

      <div className="rounded-2xl border border-neutral-warm bg-white p-4 shadow-sm">
        <div role="radiogroup" aria-label="What to fill in" className="mb-4 flex flex-wrap gap-2">
          {sessions.map((entry) => {
            const left = entryMinutes(entry) - assignedMinutes(entry)
            return (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={target === String(entry.id)}
                onClick={() => setSelection({ key: dayKey, target: String(entry.id) })}
                disabled={saving}
                className={`min-h-11 rounded-xl border px-3 text-left text-sm disabled:opacity-50 ${target === String(entry.id) ? 'border-primary bg-primary/5 font-semibold text-primary' : 'border-neutral-warm text-primary-dark'}`}
              >
                Clock {entry.formatted_start_time}–{entry.formatted_end_time} · {formatMinutes(entryMinutes(entry))}
                {left > 0 && <span className="ml-1 text-amber-700">({formatMinutes(left)} unassigned)</span>}
                {drafts[`${dayKey}:${entry.id}`] && <span className="ml-1 text-amber-700">· unsaved</span>}
              </button>
            )
          })}
          <button
            type="button"
            role="radio"
            aria-checked={target === DAY_LOG}
            onClick={() => setSelection({ key: dayKey, target: DAY_LOG })}
            disabled={saving}
            className={`min-h-11 rounded-xl border px-3 text-sm disabled:opacity-50 ${target === DAY_LOG ? 'border-primary bg-primary/5 font-semibold text-primary' : 'border-neutral-warm text-primary-dark'}`}
          >
            {sessions.length ? 'Work off the clock' : 'My day'}{dayLog ? ` · ${formatMinutes(entryMinutes(dayLog))}` : ''}
            {drafts[`${dayKey}:${DAY_LOG}`] && <span className="ml-1 text-amber-700">· unsaved</span>}
          </button>
        </div>

        {dirty && (
          <p role="status" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Unsaved changes. They stay here if you switch days, sessions or tabs; save or undo them.
          </p>
        )}
        {draftConflict && (
          <div role="alert" className="mb-3 space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900">
            <p className="font-semibold">
              {draftConflict === 'missing'
                ? (target === DAY_LOG ? 'The day log these lines were for no longer exists.' : 'The clock session these lines were for no longer exists.')
                : (target === DAY_LOG && !draft?.baseEntryId ? 'A day log was saved for this day after you started these lines.' : 'This entry was changed elsewhere after you started these lines.')}
            </p>
            <p>
              {draftConflict === 'missing'
                ? 'An admin may have deleted or moved it. Nothing was saved, and these lines won’t be added to another entry on their own.'
                : 'Saving now would overwrite that change, so it’s blocked.'}
              {dirty ? ' You can keep your lines as a separate day log, or discard them.' : ''}
            </p>
            {dirty && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void saveAsNewDayLog()} disabled={saving || !check.canSubmit} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-white disabled:opacity-50">
                  Save my lines as a separate day log
                </button>
                <button type="button" onClick={discardDraft} disabled={saving} className="min-h-11 rounded-lg border border-red-300 bg-white px-4 font-semibold text-red-800">
                  Discard my lines
                </button>
              </div>
            )}
          </div>
        )}
        {otherDrafts.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-amber-900" aria-label="Other unsaved work">
            <span>Also unsaved:</span>
            {otherDrafts.map(([key, other]) => (
              <button key={key} type="button" onClick={() => openDraft(key)} disabled={saving} className="min-h-11 rounded-full border border-amber-300 bg-white px-3 hover:bg-amber-50 disabled:opacity-50">
                {other.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : editing?.locked_at ? (
          <p className="text-sm text-text-muted">This entry is locked and can't be changed.</p>
        ) : (
          <WorkLinesEditor
            idPrefix={`day-${target}`}
            lines={lines}
            onChange={setLines}
            targetMinutes={targetMinutes}
            clients={clients}
            serviceTypes={serviceTypes}
            suggestions={suggestions}
            required={required}
            referenceDate={date}
            mode="day"
            disabled={saving}
          />
        )}

        {timedManual.length > 0 && (
          <p className="mt-3 text-sm text-text-muted">
            Also on this day: {timedManual.map((entry) => `${entry.formatted_start_time}–${entry.formatted_end_time} (${minutesToHoursText(entryMinutes(entry))}h)`).join(', ')}. Edit those from Time Entries.
          </p>
        )}

        <div className="sticky bottom-0 -mx-4 mt-4 flex flex-col gap-2 border-t border-neutral-warm bg-white px-4 pt-3 md:static md:flex-row md:items-center md:justify-end" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {message && (
            <p role={message.tone === 'error' ? 'alert' : 'status'} className={`text-sm md:mr-auto ${message.tone === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{message.text}</p>
          )}
          {dirty && (
            <button type="button" onClick={discardDraft} disabled={saving} className="min-h-11 rounded-xl border border-neutral-warm px-4 text-sm font-medium text-primary-dark">
              Undo changes
            </button>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !check.canSubmit || !dirty || Boolean(editing?.locked_at) || Boolean(draftConflict)}
            className="min-h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? 'Saving…' : target !== DAY_LOG ? 'Save session' : dayLog ? 'Save day' : 'Log day'}
          </button>
        </div>
      </div>
    </section>
  )
}
