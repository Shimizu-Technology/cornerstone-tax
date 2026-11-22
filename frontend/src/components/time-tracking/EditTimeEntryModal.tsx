import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '../../lib/api'
import type { ServiceType, TimeEntry, WorkLine } from '../../lib/api'
import type { ClientOption } from '../../lib/timeEntryWork'
import TimeEntryWorkFields from './TimeEntryWorkFields'
import WorkLinesEditor from './WorkLinesEditor'
import VersionConflictPanel from './VersionConflictPanel'
import { EMPTY_WORK_FIELDS, changedWorkFieldsPayload, workFieldsFromEntry, type WorkFieldsValue } from './timeEntryWorkForm'
import { attendanceChanges, checkLines, detailsRequired, draftsFromEntry, lineProblemSummary, linesPayload, useWorkLineSuggestions, type WorkLineDraft } from './workLinesModel'

interface EditableTimeEntry {
  id: number
  work_date: string
  start_time: string | null
  end_time: string | null
  break_minutes: number | null
  description: string | null
  approval_status?: 'pending' | 'approved' | 'denied' | null
  approval_note?: string | null
  approved_by?: { id: number; full_name: string } | null
  entry_method?: 'clock' | 'manual'
  status?: 'clocked_in' | 'on_break' | 'completed'
  locked_at: string | null
  user: {
    id: number
    email: string
    display_name?: string
    full_name?: string
  } | null
  time_category: {
    id: number
    name: string
  } | null
  client?: {
    id: number
    name: string
  } | null
  service_type?: { id: number; name: string } | null
  service_task?: { id: number; name: string } | null
  period_type?: string | null
  period_start?: string | null
  hours?: number
  version?: number
  duration_only?: boolean
  work_lines?: WorkLine[]
  breaks?: Array<{
    id?: number
    start_time: string | null
    end_time: string | null
    duration_minutes?: number | null
    active?: boolean
  }>
}

interface EditTimeEntryModalProps {
  isOpen: boolean
  entry: EditableTimeEntry | null
  serviceTypes?: ServiceType[]
  clients?: ClientOption[]
  catalogError?: string | null
  onRetryCatalog?: () => void
  canDelete: boolean
  onClose: () => void
  onSaved: () => void | Promise<void>
  onDeleted: () => void | Promise<void>
  onError?: (message: string | null) => void
  /** Called as soon as a save hits a version conflict, so the caller can refetch. */
  onConflict?: () => void
}

const BUSINESS_TIME_ZONE = 'Pacific/Guam'

const BREAK_PRESETS = [
  { label: 'None', minutes: null },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: 'Custom', minutes: -1 },
]

function timeInputValue(value: string | null | undefined) {
  if (!value) return ''

  const plainTime = value.match(/^(\d{1,2}):(\d{2})$/)
  if (plainTime) return `${plainTime[1].padStart(2, '0')}:${plainTime[2]}`

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const hour = parts.find((part) => part.type === 'hour')?.value
  const minute = parts.find((part) => part.type === 'minute')?.value

  return hour && minute ? `${hour}:${minute}` : ''
}

export default function EditTimeEntryModal({
  isOpen,
  entry,
  serviceTypes = [],
  clients = [],
  catalogError,
  onRetryCatalog,
  canDelete,
  onClose,
  onSaved,
  onDeleted,
  onError,
  onConflict,
}: EditTimeEntryModalProps) {
  const [formData, setFormData] = useState({
    work_date: '',
    start_time: '08:00',
    end_time: '17:00',
    break_minutes: null as number | null,
  })
  const [workFields, setWorkFields] = useState<WorkFieldsValue>(EMPTY_WORK_FIELDS)
  const [lines, setLines] = useState<WorkLineDraft[]>(() => draftsFromEntry(null))
  const [initialLines, setInitialLines] = useState<WorkLineDraft[]>(() => draftsFromEntry(null))
  const suggestions = useWorkLineSuggestions(isOpen, entry?.user?.id)
  const [breakRows, setBreakRows] = useState<Array<{ id?: number; start_time: string; end_time: string }>>([])
  const [initialBreakRows, setInitialBreakRows] = useState<Array<{ id?: number; start_time: string; end_time: string }>>([])
  const breakRowsUntouched = JSON.stringify(breakRows) === JSON.stringify(initialBreakRows)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [correctionReason, setCorrectionReason] = useState('')
  const [correctionReferences, setCorrectionReferences] = useState<string[]>([])
  const [requiresCorrectionReason, setRequiresCorrectionReason] = useState(false)
  // Set when the server refused the save because the entry changed elsewhere.
  const [versionConflict, setVersionConflict] = useState(false)
  const [conflictEntry, setConflictEntry] = useState<TimeEntry | null>(null)
  const [savingSeparately, setSavingSeparately] = useState(false)

  useEffect(() => {
    if (!isOpen || !entry) return

    setFormData({
      work_date: entry.work_date,
      start_time: entry.start_time || '08:00',
      end_time: entry.end_time || '17:00',
      break_minutes: entry.break_minutes,
    })
    setWorkFields(workFieldsFromEntry(entry))
    const drafts = draftsFromEntry(entry)
    setLines(drafts)
    setInitialLines(drafts)
    const rows = (entry.breaks || [])
      .filter((row) => row.start_time && row.end_time)
      .map((row) => ({
        id: row.id,
        start_time: timeInputValue(row.start_time),
        end_time: timeInputValue(row.end_time),
      }))
      .filter((row) => row.start_time && row.end_time)
    setBreakRows(rows)
    setInitialBreakRows(rows)
    setError(null)
    setVersionConflict(false)
    setConflictEntry(null)
    setCorrectionReason('')
    setCorrectionReferences([])
    setRequiresCorrectionReason(false)
  }, [entry, isOpen])

  const calculatedHours = useMemo(() => {
    if (!formData.start_time || !formData.end_time) return 0

    const [startH, startM] = formData.start_time.split(':').map(Number)
    const [endH, endM] = formData.end_time.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    let durationMinutes = endMinutes - startMinutes
    if (durationMinutes < 0) durationMinutes += 24 * 60
    if (formData.break_minutes) durationMinutes -= formData.break_minutes

    return Math.max(0, durationMinutes / 60)
  }, [formData.break_minutes, formData.end_time, formData.start_time])

  const ownerName = entry?.user?.full_name || entry?.user?.display_name || entry?.user?.email?.split('@')[0] || 'Unknown team member'
  const isLocked = !!entry?.locked_at
  const isActiveClockEntry = entry?.entry_method === 'clock' && (entry.status === 'clocked_in' || entry.status === 'on_break')
  const isDayLog = Boolean(entry?.duration_only)
  // While the times are untouched, the stored hours are the target (a clock
  // entry's seconds can make them a minute off what the HH:MM fields give).
  const timesUntouched = Boolean(entry) && formData.start_time === (entry?.start_time || '08:00') &&
    formData.end_time === (entry?.end_time || '17:00') && formData.break_minutes === entry?.break_minutes && breakRowsUntouched
  const targetMinutes = isDayLog
    ? null
    : timesUntouched && entry?.hours !== undefined ? Math.round(entry.hours * 60) : Math.round(calculatedHours * 60)
  const linesRequired = detailsRequired(suggestions.requiredFrom, formData.work_date)
  const lineCheck = checkLines(lines, { targetMinutes, required: linesRequired, serviceTypes, taskRequired: linesRequired && suggestions.taskRequired })
  const linesChanged = JSON.stringify(linesPayload(lines, targetMinutes)) !== JSON.stringify(linesPayload(initialLines, targetMinutes))
  const hoursChanged = !isDayLog && entry?.hours !== undefined && Math.round(entry.hours * 60) !== targetMinutes

  // What a save would send, built once for the Update gate and the request.
  // Work lines are sent when they changed, or when the hours changed and the
  // entry is split (its lines must be re-balanced to the new hours).
  const sendLines = !isActiveClockEntry && (isDayLog ? linesChanged : linesChanged || (hoursChanged && lines.length > 1))
  const buildPayload = () => {
    if (!entry) return {}
    const shouldSubmitDetailedBreaks = breakRows.length > 0 || (entry.breaks?.length ?? 0) > 0
    // Only attendance fields the user actually changed are sent. Resending
    // an unchanged HH:MM would drop a clock entry's seconds, change its
    // hours and send an approved entry back for review.
    const attendance = attendanceChanges({
      workDate: [formData.work_date, entry.work_date],
      startTime: [formData.start_time, entry.start_time || '08:00'],
      endTime: isActiveClockEntry ? null : [formData.end_time, entry.end_time || '17:00'],
      breakMinutes: isActiveClockEntry ? null : [formData.break_minutes, entry.break_minutes],
    })
    const breaksChanged = !isActiveClockEntry && shouldSubmitDetailedBreaks && !breakRowsUntouched
    return isDayLog ? {
      ...attendance,
      ...(linesChanged ? { work_lines: linesPayload(lines, null) } : {}),
    } : {
      ...attendance,
      // Only what the user changed, so concurrent edits are not overwritten.
      ...(isActiveClockEntry ? changedWorkFieldsPayload(workFieldsFromEntry(entry), workFields) : {}),
      ...(breaksChanged ? { breaks: breakRows } : {}),
      ...(sendLines ? { work_lines: linesPayload(lines, targetMinutes) } : {}),
    }
  }
  const hasChanges = Object.keys(buildPayload()).length > 0
  // Any save of a finished entry is checked against the work-details rule
  // (the server re-checks it), even one that only moves the date across the
  // cutover or only changes the end time. Lines that are sent must also add
  // up. An unchanged form can still close.
  const linesBlockSave = !isActiveClockEntry && hasChanges &&
    ((sendLines && !lineCheck.canSubmit) || (linesRequired && Object.keys(lineCheck.problems).length > 0))
  const linesBlockMessage = linesBlockSave ? lineProblemSummary(lines, lineCheck) : null

  const setLocalError = (message: string | null) => {
    setError(message)
    onError?.(message)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!entry) return
    setSaving(true)
    setLocalError(null)

    try {
      const payload = buildPayload()

      // Nothing changed: close without a request (an empty update is an error).
      if (Object.keys(payload).length === 0) {
        await onSaved()
        return
      }

      const response = await api.updateTimeEntry(entry.id, payload, correctionReason, { expectedVersion: entry.version })

      if (response.status === 409) {
        // Refetch at once so the panel (and the list behind) show what is
        // saved now, not what this modal opened with.
        setVersionConflict(true)
        setConflictEntry(response.current_entry ?? null)
        onConflict?.()
        const fresh = await api.getTimeEntry(entry.id)
        if (fresh.data?.time_entry) setConflictEntry(fresh.data.time_entry)
        return
      }

      if (response.error) {
        if (response.code === 'correction_reason_required') {
          setRequiresCorrectionReason(true)
          setCorrectionReferences(response.export_references || [])
        }
        setLocalError(response.error)
        return
      }

      await onSaved()
    } catch {
      setLocalError('Failed to save time entry')
    } finally {
      setSaving(false)
    }
  }

  // Keep the lines as their own day log instead of overwriting the entry.
  const saveSeparately = async () => {
    if (!entry) return
    setSavingSeparately(true)
    const response = await api.createTimeEntry({
      work_date: formData.work_date,
      work_lines: linesPayload(lines, null),
      additional_day_log: true,
      ...(entry.user ? { user_id: entry.user.id } : {}),
    })
    setSavingSeparately(false)
    if (response.error) {
      setLocalError(response.error)
      return
    }
    await onSaved()
  }

  const handleDelete = async () => {
    if (!entry || !canDelete) return
    if (!confirm('Are you sure you want to delete this time entry?')) return

    setDeleting(true)
    setLocalError(null)

    try {
      const response = await api.deleteTimeEntry(entry.id, correctionReason)
      if (response.error) {
        if (response.code === 'correction_reason_required') {
          setRequiresCorrectionReason(true)
          setCorrectionReferences(response.export_references || [])
        }
        setLocalError(response.error)
        return
      }

      await onDeleted()
    } catch {
      setLocalError('Failed to delete time entry')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && entry && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-time-entry-title"
            className="h-[100dvh] w-full overflow-y-auto overscroll-contain bg-white shadow-xl md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-2xl xl:max-w-5xl"
          >
            <div className="p-4 md:p-6">
              <h2 id="edit-time-entry-title" className="mb-1 text-xl font-bold text-primary-dark">Edit Time Entry</h2>
              <div className="mb-4">
                <p className="text-sm text-primary-dark/70">
                  Entry for: <span className="font-medium text-primary-dark">{ownerName}</span>
                </p>
                {isLocked && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    <LockIcon />
                    <span>This entry is locked and cannot be edited.</span>
                  </div>
                )}
                {entry.approved_by && (
                  <div className={`mt-2 rounded-lg border px-3 py-2 text-sm ${
                    entry.approval_status === 'approved'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}>
                    <span className="font-medium">
                      {entry.approval_status === 'approved' ? 'Approved' : 'Denied'}
                    </span>{' '}
                    by {entry.approved_by.full_name}
                    {entry.approval_note && <p className="mt-1 text-xs italic opacity-80">&quot;{entry.approval_note}&quot;</p>}
                  </div>
                )}
                {isActiveClockEntry && (
                  <div className="mt-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-800">
                    This person is still clocked in. Updating the start time corrects their live clock-in time; final hours are calculated when they clock out.
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <fieldset disabled={isLocked || saving || deleting} className={isLocked ? 'opacity-60' : ''}>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-primary-dark">Date *</label>
                    <input
                      type="date"
                      value={formData.work_date}
                      onChange={(event) => setFormData({ ...formData, work_date: event.target.value })}
                      className="w-full rounded-lg border border-neutral-warm px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>

                  {isDayLog ? (
                    <p className="mt-4 rounded-lg bg-neutral-warm/30 p-3 text-sm text-primary-dark">
                      Day log without clock times: its hours are the total of the work lines below.
                    </p>
                  ) : (<>
                  <div className={`mt-4 grid gap-4 ${isActiveClockEntry ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary-dark">{isActiveClockEntry ? 'Clock-in Time *' : 'Start Time *'}</label>
                      <input
                        type="time"
                        value={formData.start_time}
                        onChange={(event) => setFormData({ ...formData, start_time: event.target.value })}
                        className="w-full rounded-lg border border-neutral-warm px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                      />
                    </div>
                    {!isActiveClockEntry && (
                      <div>
                        <label className="mb-1 block text-sm font-medium text-primary-dark">End Time *</label>
                        <input
                          type="time"
                          value={formData.end_time}
                          onChange={(event) => setFormData({ ...formData, end_time: event.target.value })}
                          className="w-full rounded-lg border border-neutral-warm px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                          required
                        />
                      </div>
                    )}
                  </div>

                  {isActiveClockEntry ? (
                    <div className="mt-4 rounded-lg bg-neutral-warm/30 p-3 text-sm text-primary-dark">Final hours will be calculated after clock-out.</div>
                  ) : (
                    <div className="mt-4 flex items-center justify-between rounded-lg bg-neutral-warm/30 p-3">
                      <span className="text-sm text-primary-dark">Calculated Hours:</span>
                      <span className="text-lg font-bold text-primary">{calculatedHours.toFixed(2)}h</span>
                    </div>
                  )}

                  {!isActiveClockEntry && (
                    <div className="mt-4">
                      <div className="mb-3 rounded-xl border border-cyan-100 bg-cyan-50/60 px-3 py-2 text-xs text-cyan-900">
                        Add detailed break start/end times when a break needs correction. Detailed breaks replace the total break duration and recalculate hours.
                      </div>
                      <label className="mb-1 block text-sm font-medium text-primary-dark">Break Duration</label>
                      <div className="mb-2 flex flex-wrap gap-2">
                        {BREAK_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              if (preset.minutes === -1) setFormData({ ...formData, break_minutes: formData.break_minutes || 0 })
                              else setFormData({ ...formData, break_minutes: preset.minutes })
                            }}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                              (preset.minutes === null && formData.break_minutes === null) ||
                              (preset.minutes === formData.break_minutes) ||
                              (preset.minutes === -1 &&
                                formData.break_minutes !== null &&
                                !BREAK_PRESETS.slice(0, -1).some((item) => item.minutes === formData.break_minutes))
                                ? 'bg-primary text-white'
                                : 'bg-neutral-warm text-primary-dark hover:bg-primary/20'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      {formData.break_minutes !== null &&
                        !BREAK_PRESETS.slice(0, -1).some((preset) => preset.minutes === formData.break_minutes) && (
                          <input
                            type="number"
                            min="0"
                            max="480"
                            value={formData.break_minutes || ''}
                            onChange={(event) => setFormData({ ...formData, break_minutes: event.target.value ? parseInt(event.target.value, 10) : null })}
                            placeholder="Minutes"
                            className="w-full rounded-lg border border-neutral-warm px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        )}
                      <p className="mt-1 text-xs text-text-muted">Break time is not counted toward work hours</p>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-primary-dark">Detailed breaks</h3>
                          <button
                            type="button"
                            onClick={() => setBreakRows([...breakRows, { start_time: '12:00', end_time: '12:30' }])}
                            className="rounded-lg border border-cyan-200 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
                          >
                            Add break
                          </button>
                        </div>
                        {breakRows.length === 0 ? (
                          <p className="text-xs text-text-muted">No detailed breaks logged.</p>
                        ) : breakRows.map((row, index) => (
                          <div key={`${row.id || 'new'}-${index}`} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-xl border border-neutral-warm bg-white p-2">
                            <label className="block">
                              <span className="mb-1 block text-[11px] font-medium text-text-muted">Start</span>
                              <input type="time" value={row.start_time} onChange={(event) => setBreakRows(breakRows.map((item, i) => i === index ? { ...item, start_time: event.target.value } : item))} className="w-full rounded-lg border border-neutral-warm px-2 py-1.5 text-sm" />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-[11px] font-medium text-text-muted">End</span>
                              <input type="time" value={row.end_time} onChange={(event) => setBreakRows(breakRows.map((item, i) => i === index ? { ...item, end_time: event.target.value } : item))} className="w-full rounded-lg border border-neutral-warm px-2 py-1.5 text-sm" />
                            </label>
                            <button type="button" onClick={() => setBreakRows(breakRows.filter((_, i) => i !== index))} className="rounded-lg px-2 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Remove</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  </>)}

                  <div className="mt-4 border-t border-neutral-warm pt-4">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-text-muted">Work details</h3>
                    {isActiveClockEntry ? (
                      <TimeEntryWorkFields
                        idPrefix={`edit-entry-${entry.id}`}
                        value={workFields}
                        onChange={setWorkFields}
                        clients={clients}
                        serviceTypes={serviceTypes}
                        current={entry}
                        referenceDate={formData.work_date}
                        loadError={catalogError}
                        onRetry={onRetryCatalog}
                      />
                    ) : (
                      <>
                        {catalogError && (
                          <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                            <span>{catalogError}</span>
                            {onRetryCatalog && <button type="button" onClick={onRetryCatalog} className="min-h-11 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-700">Try again</button>}
                          </div>
                        )}
                        {entry.time_category && !entry.service_type && (
                          <p className="mb-3 rounded-lg bg-secondary/40 px-3 py-2 text-sm text-primary-dark">
                            Legacy category: <span className="font-semibold">{entry.time_category.name}</span>. It stays on this entry.
                          </p>
                        )}
                        <WorkLinesEditor
                          idPrefix={`edit-entry-${entry.id}`}
                          lines={lines}
                          onChange={setLines}
                          targetMinutes={targetMinutes}
                          clients={clients}
                          serviceTypes={serviceTypes}
                          suggestions={suggestions}
                          required={linesRequired}
                          referenceDate={formData.work_date}
                          mode={isDayLog ? 'day' : 'session'}
                        />
                      </>
                    )}
                  </div>

                  {requiresCorrectionReason && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <label htmlFor="approval-entry-correction-reason" className="block text-sm font-semibold text-amber-900">
                        Correction reason *
                      </label>
                      <p className="mt-1 text-xs leading-relaxed text-amber-800">
                        This entry appears in a previously exported report. Explain the correction so the earlier export can be marked stale with a clear audit trail.
                      </p>
                      {correctionReferences.length > 0 && (
                        <p className="mt-2 break-all text-xs font-medium text-amber-900">Affected: {correctionReferences.join(', ')}</p>
                      )}
                      <textarea
                        id="approval-entry-correction-reason"
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

                {versionConflict ? (
                  <VersionConflictPanel
                    title="This entry was changed elsewhere after you opened it."
                    detail="Nothing was saved, so that change isn’t overwritten."
                    busy={savingSeparately}
                    canSaveSeparately={lineCheck.problems && Object.keys(lineCheck.problems).length === 0}
                    onSaveSeparately={() => void saveSeparately()}
                    onDiscard={() => void onSaved()}
                    current={conflictEntry}
                  />
                ) : error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

                {linesBlockMessage && !versionConflict && (
                  <p id="edit-entry-lines-block" role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Fix the work lines before saving: {linesBlockMessage}
                  </p>
                )}

                <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-neutral-warm bg-white px-4 py-3 md:static md:mx-0 md:border-0 md:px-0 md:pt-4">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={!canDelete || deleting || saving}
                    className={`rounded-lg px-4 py-2 transition-colors ${canDelete ? 'text-red-600 hover:bg-red-50' : 'cursor-not-allowed text-gray-300'}`}
                    title={canDelete ? 'Delete this time entry' : 'This entry is locked or cannot be deleted'}
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>

                  <div className="flex gap-3">
                    <button type="button" onClick={onClose} className="min-h-11 rounded-lg px-4 py-2 font-medium text-primary-dark transition-colors hover:bg-neutral-warm">Cancel</button>
                    {!isLocked && <button type="submit" disabled={saving || deleting || linesBlockSave} aria-describedby={linesBlockMessage ? 'edit-entry-lines-block' : undefined} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary-dark disabled:opacity-50">{saving ? 'Saving...' : 'Update'}</button>}
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function LockIcon() {
  return (
    <svg className="h-3 w-3" fill="none" aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}
