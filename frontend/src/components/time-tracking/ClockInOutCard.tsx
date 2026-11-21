import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../lib/api'
import type { ClockStatus } from '../../lib/api'
import WorkLinesEditor from './WorkLinesEditor'
import WorkLinesSheet from './WorkLinesSheet'
import { useTimeEntryWorkOptions } from './timeEntryWorkForm'
import { checkLines, detailsRequired, draftsFromEntry, linesPayload, requirementHint, useWorkLineSuggestions, type WorkLineDraft } from './workLinesModel'

interface ClockInOutCardProps {
  onStatusChange?: () => void
}

function Spinner({ className = 'border-white/30 border-t-white' }: { className?: string }) {
  return <span className={`w-5 h-5 border-2 rounded-full animate-spin ${className}`} />
}

export default function ClockInOutCard({ onStatusChange }: ClockInOutCardProps) {
  const [status, setStatus] = useState<ClockStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [breakElapsed, setBreakElapsed] = useState(0)
  const [showClockOutModal, setShowClockOutModal] = useState(false)
  const [correctionTime, setCorrectionTime] = useState('')
  const [clockOutLines, setClockOutLines] = useState<WorkLineDraft[]>(() => draftsFromEntry(null))
  // Worked minutes when the sheet opened. The server scales lines that are a
  // few minutes off, so the clock running on does not block the submit.
  const [sessionMinutesAtOpen, setSessionMinutesAtOpen] = useState(0)
  // Which clock-in the draft belongs to; a failed clock-out keeps the draft
  // for a retry on the same entry.
  const [clockOutDraftEntryId, setClockOutDraftEntryId] = useState<number | null>(null)
  const workOptions = useTimeEntryWorkOptions(showClockOutModal)
  const suggestions = useWorkLineSuggestions(showClockOutModal)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const isOnBreakRef = useRef(false)

  const fetchStatus = useCallback(async () => {
    try {
      const result = await api.getClockStatus()
      if (result.data) {
        setStatus(result.data)
        if (result.data.clock_in_at) {
          const start = new Date(result.data.clock_in_at).getTime()
          setElapsedSeconds(Math.floor((Date.now() - start) / 1000))
        }
        if (result.data.active_break && result.data.active_break_started_at) {
          const breakStart = new Date(result.data.active_break_started_at).getTime()
          setBreakElapsed(Math.floor((Date.now() - breakStart) / 1000))
        }
      }
    } catch {
      setError('Failed to load clock status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  // Auto-poll every 30s when not clocked in (waiting for shift to start)
  useEffect(() => {
    if (!status?.clocked_in && !loading) {
      pollRef.current = setInterval(() => fetchStatus(), 30_000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [status?.clocked_in, loading, fetchStatus])

  // Keep ref in sync so the single interval callback reads fresh state
  isOnBreakRef.current = status?.active_break ?? false

  // Single interval ticks both elapsed and break counters in sync
  useEffect(() => {
    if (status?.clocked_in) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
        if (isOnBreakRef.current) {
          setBreakElapsed(prev => prev + 1)
        }
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status?.clocked_in])

  // Re-sync with server every 60s while clocked in to prevent drift
  useEffect(() => {
    if (!status?.clocked_in) return
    const syncInterval = setInterval(() => fetchStatus(), 60_000)
    return () => clearInterval(syncInterval)
  }, [status?.clocked_in, fetchStatus])

  // Reset break elapsed when break state changes
  useEffect(() => {
    if (!status?.active_break) {
      setBreakElapsed(0)
    }
  }, [status?.active_break])

  const fmt = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const fmtTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const fmt12 = (time24: string) => {
    if (!time24) return '—'
    const [h, m] = time24.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`
  }

  const guamNow = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Pacific/Guam',
      hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(new Date())
    const h = parseInt(parts.find(p => p.type === 'hour')!.value)
    const m = parseInt(parts.find(p => p.type === 'minute')!.value)
    return { hours: h, minutes: m, totalMin: h * 60 + m }
  }

  const guamHHMM = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Pacific/Guam',
      hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(date)
    const h = parts.find(p => p.type === 'hour')!.value.padStart(2, '0')
    const m = parts.find(p => p.type === 'minute')!.value.padStart(2, '0')
    return `${h}:${m}`
  }

  const isPastSchedule = () => {
    if (!status?.schedule || !status?.clocked_in) return false
    const endParts = status.schedule.end_time.match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (!endParts) return false
    let hours = parseInt(endParts[1])
    const minutes = parseInt(endParts[2])
    const period = endParts[3].toUpperCase()
    if (period === 'PM' && hours !== 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0
    const schedEnd = hours * 60 + minutes
    const { totalMin: currentMin } = guamNow()
    return currentMin > schedEnd + 30
  }

  const correctionBeforeClockIn = (() => {
    if (!correctionTime || !status?.clock_in_at) return false
    const clockInHHMM = guamHHMM(new Date(status.clock_in_at))
    return correctionTime <= clockInHHMM
  })()

  const handleClockOut = () => {
    const pastSchedule = isPastSchedule()
    if (pastSchedule) {
      const { hours: h, minutes: m } = guamNow()
      const hh = h.toString().padStart(2, '0')
      const mm = m.toString().padStart(2, '0')
      setCorrectionTime(`${hh}:${mm}`)
    } else {
      setCorrectionTime('')
    }
    if (!status?.entry_id || status.entry_id !== clockOutDraftEntryId) {
      setClockOutLines(draftsFromEntry(status?.work_details ?? null))
      setClockOutDraftEntryId(status?.entry_id ?? null)
    }
    const breakSecondsSoFar = (status?.break_minutes || 0) * 60 + (status?.active_break ? breakElapsed : 0)
    setSessionMinutesAtOpen(Math.max(0, Math.floor((elapsedSeconds - breakSecondsSoFar) / 60)))
    setShowClockOutModal(true)
  }

  // With a corrected end time the session ends then, not now.
  const sessionMinutes = (() => {
    if (!correctionTime || !status?.clock_in_at) return sessionMinutesAtOpen
    const [inH, inM] = guamHHMM(new Date(status.clock_in_at)).split(':').map(Number)
    const [outH, outM] = correctionTime.split(':').map(Number)
    let minutes = outH * 60 + outM - (inH * 60 + inM)
    if (minutes < 0) minutes += 24 * 60
    const breakMinutes = (status.break_minutes || 0) + (status.active_break ? Math.floor(breakElapsed / 60) : 0)
    return Math.max(0, minutes - breakMinutes)
  })()
  // The suggestions are fetched when the sheet opens, so once they arrive
  // they are newer than the clock status; until then the status decides.
  const requiredFrom = suggestions.loaded ? suggestions.requiredFrom : status?.work_details_required_from
  const linesRequired = detailsRequired(requiredFrom, status?.work_date)
  const taskRequired = linesRequired && (suggestions.loaded ? suggestions.taskRequired : Boolean(status?.work_task_required))
  const lineCheck = checkLines(clockOutLines, { targetMinutes: sessionMinutes, required: linesRequired, clients: workOptions.clients, serviceTypes: workOptions.serviceTypes, taskRequired })

  const handleClockOutSubmit = async () => {
    setShowClockOutModal(false)
    setActionLoading(true)
    setError(null)
    try {
      const correctedEnd = correctionTime ? (() => {
        const guamDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Guam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
        return `${guamDate}T${correctionTime}:00`
      })() : undefined
      const result = await api.clockOut(correctedEnd, undefined, undefined, status?.entry_id, sessionMinutes > 0 ? linesPayload(clockOutLines, sessionMinutes) : undefined)
      if (result?.error) {
        setError(result.error)
        await fetchStatus()
      } else {
        setClockOutLines(draftsFromEntry(null))
        setClockOutDraftEntryId(null)
        await fetchStatus()
        onStatusChange?.()
      }
    } catch {
      setError('Action failed. Please try again.')
      await fetchStatus()
    } finally {
      setActionLoading(false)
    }
  }

  const handleAction = async (action: 'clock_in' | 'start_break' | 'end_break', adminOverride = false) => {
    setActionLoading(true)
    setError(null)
    try {
      const fn = {
        clock_in: () => api.clockIn(undefined, adminOverride),
        start_break: () => api.startBreak(),
        end_break: () => api.endBreak(),
      }
      const result = await fn[action]()
      if (result?.error) {
        setError(result.error)
        await fetchStatus()
      } else {
        await fetchStatus()
        onStatusChange?.()
      }
    } catch {
      setError('Action failed. Please try again.')
      await fetchStatus()
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-warm p-5 animate-pulse">
        <div className="md:flex md:items-center md:gap-8">
          <div className="h-5 bg-neutral-warm rounded w-28 mb-4 md:mb-0" />
          <div className="h-10 bg-neutral-warm/60 rounded-xl flex-1" />
        </div>
      </div>
    )
  }

  const isClockedIn = status?.clocked_in
  const isOnBreak = status?.status === 'on_break'
  const isAdmin = status?.is_admin ?? false
  const blockedReason = status?.clock_in_blocked_reason
  const isAdminOverridable = isAdmin && (blockedReason === 'too_early' || blockedReason === 'shift_ended')
  const canClockIn = status?.can_clock_in || isAdminOverridable
  const isUnscheduled = !isClockedIn && !status?.schedule && blockedReason === 'no_schedule'
  const netWorkSeconds = isClockedIn ? elapsedSeconds - (status?.break_minutes || 0) * 60 - (isOnBreak ? breakElapsed : 0) : 0

  const stripeColor = isOnBreak ? 'bg-amber-400' : isClockedIn ? 'bg-emerald-500' : 'bg-neutral-warm'
  const borderColor = isOnBreak ? 'border-amber-300/60' : isClockedIn ? 'border-emerald-300/60' : 'border-neutral-warm'
  const dotColor = isOnBreak ? 'bg-amber-400 animate-pulse' : isClockedIn ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-warm'
  const statusLabel = isOnBreak ? 'On Break' : isClockedIn ? 'Clocked In' : 'Not Clocked In'

  // Shared button styles
  const btnPrimary = 'min-h-[48px] py-3 px-5 bg-primary hover:bg-primary-dark active:bg-primary-dark disabled:bg-neutral-warm disabled:text-text-muted text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-sm'
  const btnSecondary = 'min-h-[48px] py-3 px-5 bg-secondary-dark hover:bg-neutral-warm active:bg-neutral-warm text-primary-dark font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm border border-neutral-warm'
  const btnBreak = 'min-h-[48px] py-3 px-5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-sm'

  return (
    <div className={`rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-md overflow-hidden bg-white ${borderColor}`}>
      <div className={`h-1 ${stripeColor}`} />

      {/* ─── Mobile / Tablet layout (stacked) ─── */}
      <div className="p-5 md:hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
            <h3 className="font-semibold text-primary-dark text-base">{statusLabel}</h3>
          </div>
          {status?.schedule && !isClockedIn && (
            <span className="text-xs text-text-muted bg-secondary rounded-full px-2.5 py-1">
              {status.schedule.start_time} – {status.schedule.end_time}
            </span>
          )}
        </div>

        {/* Timer (mobile) */}
        {isClockedIn && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
            <div className={`text-center py-3 rounded-xl ${isOnBreak ? 'bg-amber-50 border border-amber-200/60' : 'bg-secondary/60'}`}>
              <div className={`font-mono text-3xl font-bold tabular-nums tracking-tight ${isOnBreak ? 'text-amber-600' : 'text-primary-dark'}`}>
                {isOnBreak ? fmt(breakElapsed) : fmt(Math.max(netWorkSeconds, 0))}
              </div>
              <div className={`text-[10px] mt-1 font-medium uppercase tracking-wider ${isOnBreak ? 'text-amber-500' : 'text-text-muted'}`}>
                {isOnBreak ? 'Break time' : 'Time worked'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <div className="text-center bg-secondary/40 rounded-xl py-2 px-2">
                <div className="text-sm font-semibold text-primary-dark tabular-nums font-mono">
                  {fmt(elapsedSeconds)}
                </div>
                <div className="text-[10px] text-text-muted font-medium uppercase tracking-wider mt-0.5">
                  Total time
                </div>
              </div>
              <div className="text-center bg-secondary/40 rounded-xl py-2 px-2">
                <div className="text-sm font-semibold tabular-nums font-mono text-text-muted">
                  {isOnBreak ? fmt(Math.max(netWorkSeconds, 0)) : `${status?.break_minutes || 0}m`}
                </div>
                <div className="text-[10px] text-text-muted font-medium uppercase tracking-wider mt-0.5">
                  {isOnBreak ? 'Time worked' : 'Breaks'}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Timeline (mobile) */}
        {isClockedIn && status?.clock_in_at && (
          <TimelineSection clockInAt={status.clock_in_at} breaks={status.breaks || []} fmtTime={fmtTime} />
        )}

        {/* Schedule / no-schedule (mobile) */}
        {!isClockedIn && status?.schedule && (
          <div className="mb-4 p-3.5 bg-secondary/60 rounded-xl border border-neutral-warm/50">
            <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Today's Shift</div>
            <div className="text-lg font-semibold text-primary-dark mt-1">{status.schedule.start_time} – {status.schedule.end_time}</div>
            <div className="text-xs text-text-muted mt-0.5">{status.schedule.hours} hours</div>
          </div>
        )}
        {isUnscheduled && <UnscheduledMsg flexible={Boolean(status?.flexible_hours)} />}
        {!isClockedIn && blockedReason === 'too_early' && <TooEarlyMsg isAdmin={isAdmin} minutesUntil={status?.minutes_until} />}
        {!isClockedIn && blockedReason === 'shift_ended' && <ShiftEndedMsg isAdmin={isAdmin} />}

        <ErrorMsg error={error} />

        {/* Buttons (mobile - stacked) */}
        <div className="space-y-2">
          {!isClockedIn ? (
            <button
              onClick={() => handleAction('clock_in', isAdminOverridable)}
              disabled={actionLoading || !canClockIn}
              className={`w-full ${btnPrimary}`}
            >
              {actionLoading ? <Spinner /> : <><ClockIcon /> {isAdminOverridable ? 'Clock In (Override)' : 'Clock In'}</>}
            </button>
          ) : (
            <>
              {isOnBreak ? (
                <button onClick={() => handleAction('end_break')} disabled={actionLoading} className={`w-full ${btnBreak}`}>
                  {actionLoading ? <Spinner /> : <><PlayIcon /> End Break</>}
                </button>
              ) : (
                <button onClick={() => handleAction('start_break')} disabled={actionLoading} className={`w-full ${btnSecondary}`}>
                  {actionLoading ? <Spinner className="border-primary-dark/30 border-t-primary-dark" /> : <><PauseIcon /> Start Break</>}
                </button>
              )}
              <button onClick={handleClockOut} disabled={actionLoading} className={`w-full ${btnPrimary}`}>
                {actionLoading ? <Spinner /> : <><StopIcon /> Clock Out</>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Desktop layout ─── */}
      <div className="hidden md:block p-5">
        {/* Top row: status + buttons */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-3 h-3 rounded-full shrink-0 ${dotColor}`} />
            <div>
              <h3 className="font-semibold text-primary-dark text-base leading-tight">{statusLabel}</h3>
              {status?.schedule && (
                <span className="text-xs text-text-muted">
                  Shift: {status.schedule.start_time} – {status.schedule.end_time} ({status.schedule.hours}h)
                </span>
              )}
              {!status?.schedule && !isClockedIn && (
                status?.flexible_hours
                  ? <span className="text-xs text-text-muted">No shift scheduled — flexible hours, no approval needed</span>
                  : <span className="text-xs text-amber-600">No shift scheduled — time will need approval</span>
              )}
            </div>
          </div>

          {!isClockedIn && blockedReason && blockedReason !== 'already_clocked_in' && blockedReason !== 'no_schedule' && (
            <div className="flex-1 text-center">
              <span className="text-xs text-amber-600 font-medium">
                {blockedReason === 'too_early' && (status?.minutes_until != null ? `Clock in available in ~${status.minutes_until}m` : 'Shift hasn\'t started yet')}
                {blockedReason === 'shift_ended' && 'Shift has ended'}
                {isAdmin && ' — admin override available'}
              </span>
            </div>
          )}

          {!isClockedIn && (!blockedReason || blockedReason === 'no_schedule') && <div className="flex-1" />}

          <div className="flex items-center gap-2 shrink-0">
            {!isClockedIn ? (
              <button
                onClick={() => handleAction('clock_in', isAdminOverridable)}
                disabled={actionLoading || !canClockIn}
                className={btnPrimary}
              >
                {actionLoading ? <Spinner /> : <><ClockIcon /> {isAdminOverridable ? 'Clock In (Override)' : 'Clock In'}</>}
              </button>
            ) : (
              <>
                {isOnBreak ? (
                  <button onClick={() => handleAction('end_break')} disabled={actionLoading} className={btnBreak}>
                    {actionLoading ? <Spinner /> : <><PlayIcon /> End Break</>}
                  </button>
                ) : (
                  <button onClick={() => handleAction('start_break')} disabled={actionLoading} className={btnSecondary}>
                    {actionLoading ? <Spinner className="border-primary-dark/30 border-t-primary-dark" /> : <><PauseIcon /> Start Break</>}
                  </button>
                )}
                <button onClick={handleClockOut} disabled={actionLoading} className={btnPrimary}>
                  {actionLoading ? <Spinner /> : <><StopIcon /> Clock Out</>}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Timer row (only when clocked in) */}
        {isClockedIn && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 pt-4 border-t border-neutral-warm/50"
          >
            <div className="flex items-center gap-6 lg:gap-8">
              <div className="text-center">
                <div className={`font-mono text-3xl lg:text-4xl font-bold tabular-nums tracking-tight ${isOnBreak ? 'text-amber-600' : 'text-primary-dark'}`}>
                  {isOnBreak ? fmt(breakElapsed) : fmt(Math.max(netWorkSeconds, 0))}
                </div>
                <div className={`text-[10px] font-medium uppercase tracking-wider mt-1 ${isOnBreak ? 'text-amber-500' : 'text-text-muted'}`}>
                  {isOnBreak ? 'Break time' : 'Time worked'}
                </div>
              </div>
              <div className="w-px h-12 bg-neutral-warm/60" />
              <div className="text-center">
                <div className="font-mono text-xl lg:text-2xl font-semibold text-primary-dark tabular-nums">
                  {fmt(elapsedSeconds)}
                </div>
                <div className="text-[10px] text-text-muted font-medium uppercase tracking-wider mt-1">
                  Total time
                </div>
              </div>
              <div className="w-px h-12 bg-neutral-warm/60" />
              <div className="text-center">
                <div className="font-mono text-xl lg:text-2xl font-semibold tabular-nums text-text-muted">
                  {isOnBreak ? fmt(Math.max(netWorkSeconds, 0)) : `${status?.break_minutes || 0}m`}
                </div>
                <div className="text-[10px] text-text-muted font-medium uppercase tracking-wider mt-1">
                  {isOnBreak ? 'Time worked' : 'Breaks'}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <ErrorMsg error={error} />

        {/* Timeline (desktop) */}
        {isClockedIn && status?.clock_in_at && (
          <TimelineSection clockInAt={status.clock_in_at} breaks={status.breaks || []} fmtTime={fmtTime} compact />
        )}
      </div>

      {/* Clock-out: split the session across clients, optional time correction */}
      <WorkLinesSheet
        open={showClockOutModal}
        title="Clock out"
        subtitle={status?.clock_in_at ? `You've been working since ${fmtTime(status.clock_in_at)}` : undefined}
        onClose={() => setShowClockOutModal(false)}
        footer={
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
            {!lineCheck.canSubmit && (
              <p className="text-sm text-amber-800 md:mr-auto" id="clock-out-blocked">
                {lineCheck.remainingMinutes !== 0 ? lineCheck.summary : 'Finish the highlighted lines to clock out.'}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowClockOutModal(false); setClockOutDraftEntryId(null) }}
                className="min-h-11 flex-1 rounded-xl border border-gray-300 px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 md:flex-none"
              >
                Cancel
              </button>
              <button
                onClick={handleClockOutSubmit}
                disabled={!lineCheck.canSubmit || (correctionTime !== '' && (!correctionTime || correctionBeforeClockIn))}
                aria-describedby={!lineCheck.canSubmit ? 'clock-out-blocked' : undefined}
                className="flex min-h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50 md:flex-none"
              >
                <StopIcon />
                {correctionTime ? `Clock Out at ${fmt12(correctionTime)}` : 'Clock Out'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700">What did you work on?</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {linesRequired
                ? `${requirementHint(taskRequired)} Use Internal – Cornerstone for office work and errands.`
                : 'Pick the client and say what you did; category and task are optional. Split the session if you worked for more than one client.'}
            </p>
          </div>

          {workOptions.error && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <span>{workOptions.error}</span>
              <button type="button" onClick={workOptions.retry} className="min-h-11 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-700">Try again</button>
            </div>
          )}

          {correctionTime && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-700">Past scheduled shift end</p>
              <p className="mt-0.5 text-xs text-amber-600">
                Your shift was scheduled to end at {status?.schedule?.end_time}. What time did you actually stop?
              </p>
              <label htmlFor="clock-out-correction" className="sr-only">Actual stop time</label>
              <input
                id="clock-out-correction"
                type="time"
                value={correctionTime}
                onChange={e => setCorrectionTime(e.target.value)}
                className={`mt-3 min-h-11 w-full rounded-xl border bg-white px-4 py-2.5 text-base focus:border-primary focus:ring-2 focus:ring-primary/30 md:text-sm ${
                  correctionBeforeClockIn ? 'border-red-300 bg-red-50' : 'border-amber-300'
                }`}
              />
              {correctionBeforeClockIn && (
                <p className="mt-1.5 text-xs text-red-500">Time must be after your clock-in ({fmtTime(status!.clock_in_at!)})</p>
              )}
              <button
                type="button"
                onClick={() => setCorrectionTime('')}
                className="mt-2 min-h-11 text-sm font-medium text-amber-700 hover:text-amber-900 hover:underline"
              >
                I worked until now instead
              </button>
            </div>
          )}

          <WorkLinesEditor
            idPrefix="clock-out"
            lines={clockOutLines}
            onChange={setClockOutLines}
            targetMinutes={sessionMinutes}
            clients={workOptions.clients}
            serviceTypes={workOptions.serviceTypes}
            suggestions={suggestions}
            required={linesRequired}
            taskRequired={taskRequired}
            referenceDate={status?.work_date || undefined}
          />
        </div>
      </WorkLinesSheet>
    </div>
  )
}

function TimelineSection({ clockInAt, breaks, fmtTime, compact }: {
  clockInAt: string
  breaks: Array<{ start_time: string; end_time: string | null; duration_minutes: number | null; active: boolean }>
  fmtTime: (iso: string) => string
  compact?: boolean
}) {
  if (!breaks.length && !compact) {
    return (
      <div className="mb-4 text-xs text-text-muted bg-secondary/40 rounded-lg px-3 py-2">
        Clocked in at <span className="font-medium text-primary-dark">{fmtTime(clockInAt)}</span>
      </div>
    )
  }

  return (
    <div className={compact ? 'mt-3 pt-3 border-t border-neutral-warm/50' : 'mb-4'}>
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted ${compact ? '' : 'bg-secondary/40 rounded-lg px-3 py-2'}`}>
        <span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 align-middle" />
          In <span className="font-medium text-primary-dark">{fmtTime(clockInAt)}</span>
        </span>
        {breaks.map((b, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-neutral-warm">→</span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-0.5 align-middle" />
            Break {fmtTime(b.start_time)}
            {b.end_time ? (
              <>
                <span className="text-neutral-warm">–</span>
                {fmtTime(b.end_time)}
                <span className="text-text-muted">({b.duration_minutes}m)</span>
              </>
            ) : (
              <span className="text-amber-600 font-medium">(active)</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

function ErrorMsg({ error }: { error: string | null }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600"
        >
          {error}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function UnscheduledMsg({ flexible }: { flexible: boolean }) {
  if (flexible) {
    return (
      <div className="mb-4 rounded-xl border border-neutral-warm bg-secondary/40 p-3.5">
        <div className="text-sm font-medium text-primary-dark">No shift scheduled today</div>
        <div className="mt-0.5 text-xs text-text-muted">You’re on flexible hours, so this time won’t need approval.</div>
      </div>
    )
  }
  return (
    <div className="mb-4 p-3.5 bg-amber-50 rounded-xl border border-amber-200">
      <div className="flex items-start gap-2">
        <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <div className="text-sm font-medium text-amber-700">No shift scheduled today</div>
          <div className="text-xs text-amber-600 mt-0.5">
            You can still clock in — your time will be sent for manager approval.
          </div>
        </div>
      </div>
    </div>
  )
}

function ShiftEndedMsg({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="mb-4 p-3.5 bg-amber-50 rounded-xl border border-amber-200">
      <div className="flex items-start gap-2">
        <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <div className="text-sm font-medium text-amber-700">Shift has ended</div>
          <div className="text-xs text-amber-600 mt-0.5">
            {isAdmin
              ? 'Your shift has ended, but you can use admin override.'
              : 'Your shift has ended. Please submit a manual entry if you need to log time.'}
          </div>
        </div>
      </div>
    </div>
  )
}

function TooEarlyMsg({ isAdmin, minutesUntil }: { isAdmin: boolean; minutesUntil?: number }) {
  return (
    <div className="mb-4 p-3.5 bg-amber-50 rounded-xl border border-amber-200">
      <div className="flex items-start gap-2">
        <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <div className="text-sm font-medium text-amber-700">Too early to clock in</div>
          <div className="text-xs text-amber-600 mt-0.5">
            {isAdmin
              ? 'Your shift hasn\'t started yet, but you can use admin override.'
              : `You can clock in ${minutesUntil != null ? `in ~${minutesUntil} minutes` : 'shortly before your shift'}. This will update automatically.`}
          </div>
        </div>
      </div>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  )
}
