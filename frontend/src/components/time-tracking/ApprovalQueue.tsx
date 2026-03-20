import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../lib/api'
import type { TimeEntry } from '../../lib/api'

interface ApprovalQueueProps {
  onUpdate?: () => void
}

export default function ApprovalQueue({ onUpdate }: ApprovalQueueProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [noteInput, setNoteInput] = useState<{ id: number; note: string } | null>(null)

  const fetchPending = useCallback(async () => {
    try {
      const result = await api.getPendingApprovals()
      if (result.data) {
        setEntries(result.data.pending_entries)
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [fetchPending])

  const handleApprove = async (entry: TimeEntry, note?: string) => {
    setActionLoading(entry.id)
    try {
      const isOvertimeOnly = entry.approval_status !== 'pending' && entry.overtime_status === 'pending'
      const result = isOvertimeOnly
        ? await api.approveOvertime(entry.id, note)
        : await api.approveTimeEntry(entry.id, note)

      if (!result.error) {
        const stillHasOvertimePending = !isOvertimeOnly && entry.overtime_status === 'pending'
        if (stillHasOvertimePending) {
          await fetchPending()
        } else {
          setEntries(prev => prev.filter(e => e.id !== entry.id))
        }
        setNoteInput(null)
        onUpdate?.()
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeny = async (entry: TimeEntry, note?: string) => {
    setActionLoading(entry.id)
    try {
      const isOvertimeOnly = entry.approval_status !== 'pending' && entry.overtime_status === 'pending'
      const result = isOvertimeOnly
        ? await api.denyOvertime(entry.id, note)
        : await api.denyTimeEntry(entry.id, note)

      if (!result.error) {
        const stillHasOvertimePending = !isOvertimeOnly && entry.overtime_status === 'pending'
        if (stillHasOvertimePending) {
          await fetchPending()
        } else {
          setEntries(prev => prev.filter(e => e.id !== entry.id))
        }
        setNoteInput(null)
        onUpdate?.()
      }
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-warm p-5 animate-pulse">
        <div className="h-5 bg-neutral-warm rounded w-36 mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-neutral-warm/60 rounded-xl" />
          <div className="h-16 bg-neutral-warm/60 rounded-xl" />
        </div>
      </div>
    )
  }

  if (entries.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-amber-200/70 overflow-hidden hover:shadow-md transition-shadow duration-300">
      <div className="h-1 bg-amber-400" />
      <div className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-6 h-6 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center">
            <span className="text-amber-600 text-xs font-bold">{entries.length}</span>
          </div>
          <h3 className="font-semibold text-primary-dark text-base">Pending Approvals</h3>
        </div>

        <div className="space-y-3">
          <AnimatePresence>
            {entries.map(entry => {
              const isPendingApproval = entry.approval_status === 'pending'
              const isPendingOvertime = entry.overtime_status === 'pending'

              return (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="border border-neutral-warm rounded-xl p-3.5 bg-secondary/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-primary-dark text-sm">
                          {entry.user.full_name || entry.user.display_name}
                        </span>
                        {isPendingApproval && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full uppercase tracking-wider">
                            Manual
                          </span>
                        )}
                        {isPendingOvertime && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 rounded-full uppercase tracking-wider">
                            Overtime
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-muted mt-1">
                        {new Date(entry.work_date + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric'
                        })}
                        {' · '}
                        {entry.formatted_start_time && entry.formatted_end_time
                          ? `${entry.formatted_start_time} – ${entry.formatted_end_time}`
                          : `${entry.hours}h`
                        }
                      </div>
                      {entry.description && (
                        <div className="text-xs text-text-muted mt-1 truncate">{entry.description}</div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-primary-dark">{entry.hours}h</div>
                      <div className="text-[10px] text-text-muted uppercase">{entry.entry_method}</div>
                    </div>
                  </div>

                  {/* Note Input */}
                  {noteInput?.id === entry.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3"
                    >
                      <input
                        type="text"
                        value={noteInput.note}
                        onChange={e => setNoteInput({ ...noteInput, note: e.target.value })}
                        placeholder="Add a note (optional)..."
                        className="w-full px-3 py-2 text-sm border border-neutral-warm rounded-xl bg-white text-primary-dark placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </motion.div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => handleApprove(entry, noteInput?.id === entry.id ? noteInput.note : undefined)}
                      disabled={actionLoading === entry.id}
                      className="flex-1 min-h-[44px] py-2 px-3 bg-primary hover:bg-primary-dark active:bg-primary-dark disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                    >
                      {actionLoading === entry.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleDeny(entry, noteInput?.id === entry.id ? noteInput.note : undefined)}
                      disabled={actionLoading === entry.id}
                      className="flex-1 min-h-[44px] py-2 px-3 bg-white hover:bg-secondary active:bg-secondary-dark disabled:opacity-50 text-red-600 text-sm font-medium rounded-xl transition-colors border border-red-200"
                    >
                      Deny
                    </button>
                    <button
                      onClick={() => setNoteInput(noteInput?.id === entry.id ? null : { id: entry.id, note: '' })}
                      className="min-h-[44px] min-w-[44px] py-2 px-3 bg-white hover:bg-secondary border border-neutral-warm text-text-muted text-sm rounded-xl transition-colors flex items-center justify-center"
                      title="Add note"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
