import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { PayrollChecklistBoardResponse, PayrollChecklistPeriodDetailResponse } from '../../lib/api'
import { formatDate } from '../../lib/dateUtils'

interface SelectedCell {
  clientId: number
  clientName: string
  periodStart: string
  periodEnd: string
  periodId: number | null
}

type ChecklistItem = PayrollChecklistPeriodDetailResponse['items'][0]

export default function OperationsPage() {
  useEffect(() => {
    document.title = 'Payroll Checklist Board | Cornerstone Admin'
  }, [])

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [board, setBoard] = useState<PayrollChecklistBoardResponse | null>(null)
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerError, setDrawerError] = useState<string | null>(null)
  const [periodDetail, setPeriodDetail] = useState<PayrollChecklistPeriodDetailResponse | null>(null)
  const [savingItemId, setSavingItemId] = useState<number | null>(null)
  const [creatingPeriod, setCreatingPeriod] = useState(false)
  const [completingPeriod, setCompletingPeriod] = useState(false)
  const [reopeningPeriod, setReopeningPeriod] = useState(false)
  const [expandedItemDetails, setExpandedItemDetails] = useState<Record<number, boolean>>({})

  const [itemDrafts, setItemDrafts] = useState<Record<number, { note: string; proof_url: string }>>({})

  useEffect(() => {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    setStartDate(start.toISOString().slice(0, 10))
    setEndDate(end.toISOString().slice(0, 10))
  }, [])

  const loadBoard = useCallback(async () => {
    if (!startDate || !endDate) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.getPayrollChecklistBoard({ start: startDate, end: endDate })
      if (result.data) {
        setBoard(result.data)
      } else if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      console.error('Failed to load payroll checklist board:', err)
      setError('Failed to load payroll checklist board')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    loadBoard()
  }, [loadBoard])

  const loadPeriodDetail = useCallback(async (periodId: number) => {
    setDrawerLoading(true)
    setDrawerError(null)
    try {
      const result = await api.getPayrollChecklistPeriod(periodId)
      if (result.data) {
        setPeriodDetail(result.data)
        setExpandedItemDetails({})
        setItemDrafts(
          result.data.items.reduce((acc, item) => {
            acc[item.id] = { note: item.note || '', proof_url: item.proof_url || '' }
            return acc
          }, {} as Record<number, { note: string; proof_url: string }>)
        )
      } else if (result.error) {
        setDrawerError(result.error)
      }
    } catch (err) {
      console.error('Failed to load payroll period detail:', err)
      setDrawerError('Failed to load payroll period detail')
    } finally {
      setDrawerLoading(false)
    }
  }, [])

  const createPeriodForCell = useCallback(async (cell: SelectedCell) => {
    setCreatingPeriod(true)
    setDrawerError(null)
    try {
      const result = await api.createPayrollChecklistPeriod({
        client_id: cell.clientId,
        start: cell.periodStart,
        end: cell.periodEnd,
      })
      if (result.data) {
        await loadBoard()
        return result.data.period.id
      }
      if (result.error) {
        setDrawerError(result.error)
      }
      return null
    } catch (err) {
      console.error('Failed to create payroll period:', err)
      setDrawerError('Failed to create payroll period')
      return null
    } finally {
      setCreatingPeriod(false)
    }
  }, [loadBoard])

  const openCell = async (cell: SelectedCell) => {
    setSelectedCell(cell)
    setPeriodDetail(null)
    setDrawerError(null)
    const periodId = cell.periodId || await createPeriodForCell(cell)
    if (periodId) {
      setSelectedCell(prev => prev ? { ...prev, periodId } : prev)
      await loadPeriodDetail(periodId)
    }
  }

  const closeDrawer = () => {
    setSelectedCell(null)
    setPeriodDetail(null)
    setDrawerError(null)
  }

  const handleToggleItem = async (item: ChecklistItem, done: boolean) => {
    setSavingItemId(item.id)
    setDrawerError(null)
    try {
      const result = await api.togglePayrollChecklistItem(item.id, done)
      if (result.error) {
        setDrawerError(result.error)
      } else if (selectedCell?.periodId) {
        await loadPeriodDetail(selectedCell.periodId)
        await loadBoard()
      }
    } catch (err) {
      console.error('Failed to toggle checklist step:', err)
      setDrawerError('Failed to toggle checklist step')
    } finally {
      setSavingItemId(null)
    }
  }

  const handleItemDraftChange = (itemId: number, patch: Partial<{ note: string; proof_url: string }>) => {
    setItemDrafts(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        ...patch,
      },
    }))
  }

  const toggleItemDetails = (itemId: number) => {
    setExpandedItemDetails(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }))
  }

  const handleSaveItem = async (itemId: number) => {
    const draft = itemDrafts[itemId]
    if (!draft) return

    setSavingItemId(itemId)
    setDrawerError(null)
    try {
      const result = await api.updatePayrollChecklistItem(itemId, {
        note: draft.note,
        proof_url: draft.proof_url || undefined,
      })
      if (result.error) {
        setDrawerError(result.error)
      } else if (selectedCell?.periodId) {
        await loadPeriodDetail(selectedCell.periodId)
      }
    } catch (err) {
      console.error('Failed to save checklist step:', err)
      setDrawerError('Failed to save checklist step')
    } finally {
      setSavingItemId(null)
    }
  }

  const handleCompletePeriod = async () => {
    if (!selectedCell?.periodId) return
    setCompletingPeriod(true)
    setDrawerError(null)
    try {
      const result = await api.completePayrollChecklistPeriod(selectedCell.periodId)
      if (result.error) {
        setDrawerError(result.error)
      } else {
        await loadPeriodDetail(selectedCell.periodId)
        await loadBoard()
      }
    } catch (err) {
      console.error('Failed to complete payroll period:', err)
      setDrawerError('Failed to complete payroll period')
    } finally {
      setCompletingPeriod(false)
    }
  }

  const handleReopenPeriod = async () => {
    if (!selectedCell?.periodId) return
    setReopeningPeriod(true)
    setDrawerError(null)
    try {
      const result = await api.reopenPayrollChecklistPeriod(selectedCell.periodId)
      if (result.error) {
        setDrawerError(result.error)
      } else {
        await loadPeriodDetail(selectedCell.periodId)
        await loadBoard()
      }
    } catch (err) {
      console.error('Failed to reopen payroll period:', err)
      setDrawerError('Failed to reopen payroll period')
    } finally {
      setReopeningPeriod(false)
    }
  }

  const handleRetryCreatePeriod = async () => {
    if (!selectedCell) return
    if (selectedCell.periodId) {
      await loadPeriodDetail(selectedCell.periodId)
      return
    }
    const periodId = await createPeriodForCell(selectedCell)
    if (periodId) {
      setSelectedCell(prev => prev ? { ...prev, periodId } : prev)
      await loadPeriodDetail(periodId)
    }
  }

  const rows = useMemo(() => board?.rows || [], [board])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary-dark tracking-tight">Payroll Checklist Board</h1>
        <p className="text-text-muted mt-1">Rows are clients, columns are payroll periods. Click any cell to check off steps.</p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-warm shadow-sm p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="min-h-11 px-3 py-2 border border-neutral-warm rounded-xl text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="min-h-11 px-3 py-2 border border-neutral-warm rounded-xl text-sm"
          />
          <button
            type="button"
            onClick={loadBoard}
            className="min-h-11 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark"
          >
            Refresh Board
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : !board || rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-warm shadow-sm p-8 text-center text-text-muted">
          No payroll checklist rows found in this period range.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-warm shadow-sm overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left p-3 font-semibold text-primary-dark sticky left-0 bg-secondary z-10">Client</th>
                {board.periods.map(period => (
                  <th key={`${period.start}-${period.end}`} className="text-left p-3 font-semibold text-primary-dark min-w-[170px]">
                    {period.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.client_id} className="border-t border-neutral-warm">
                  <td className="p-3 font-medium text-primary-dark sticky left-0 bg-white z-10">{row.client_name}</td>
                  {row.cells.map(cell => (
                    <td key={`${row.client_id}-${cell.period_start}`} className="p-3">
                      {(() => {
                        const isCompleted = cell.status === 'completed'
                        const isInProgress = !isCompleted && cell.done_count > 0
                        const cellClasses = isCompleted
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : isInProgress
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                        return (
                      <button
                        type="button"
                        onClick={() => openCell({
                          clientId: row.client_id,
                          clientName: row.client_name,
                          periodStart: cell.period_start,
                          periodEnd: cell.period_end,
                          periodId: cell.checklist_period_id,
                        })}
                        className={`w-full min-h-14 px-3 py-2 rounded-lg border text-left ${cellClasses}`}
                      >
                        <div className="text-lg font-semibold leading-tight">
                          {cell.done_count}/{cell.total_count}
                        </div>
                        <div className="text-xs opacity-80">
                          {cell.status === 'completed' ? 'Done' : 'Open'}
                        </div>
                      </button>
                        )
                      })()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedCell && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="w-full max-w-xl h-full bg-white shadow-xl overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-primary-dark">{selectedCell.clientName}</h2>
                <p className="text-sm text-text-muted">
                  Period: {formatDate(selectedCell.periodStart)} - {formatDate(selectedCell.periodEnd)}
                </p>
              </div>
              <button type="button" onClick={closeDrawer} className="text-sm text-primary hover:text-primary-dark">Close</button>
            </div>

            {drawerError && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm">
                {drawerError}
              </div>
            )}

            {creatingPeriod ? (
              <div className="space-y-3">
                <p className="text-sm text-text-muted">Creating payroll period...</p>
              </div>
            ) : drawerLoading ? (
              <div className="py-10 flex justify-center">
                <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : periodDetail ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded font-medium ${periodDetail.period.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {periodDetail.period.status}
                  </span>
                  <span className="text-xs text-text-muted">{periodDetail.period.done_count}/{periodDetail.period.total_count} done</span>
                </div>

                <div className="space-y-3">
                  {periodDetail.items.map(item => {
                    const draft = itemDrafts[item.id] || { note: '', proof_url: '' }
                    const saving = savingItemId === item.id
                    const detailsExpanded = !!expandedItemDetails[item.id]
                    return (
                      <div key={item.id} className="border border-neutral-warm rounded-lg p-3 space-y-2">
                        <label className="min-h-11 flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={(e) => handleToggleItem(item, e.target.checked)}
                            disabled={saving}
                            className="mt-1 h-5 w-5"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-primary-dark">{item.position}. {item.label}</p>
                            {item.completed_by && item.completed_at && (
                              <p className="text-xs text-text-muted">
                                Completed by {item.completed_by.name} on {formatDate(item.completed_at)}
                              </p>
                            )}
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={() => toggleItemDetails(item.id)}
                          className="text-sm text-primary hover:text-primary-dark underline"
                        >
                          {detailsExpanded ? 'Hide note/proof' : 'Add note/proof'}
                        </button>
                        {detailsExpanded && (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={draft.note}
                              onChange={(e) => handleItemDraftChange(item.id, { note: e.target.value })}
                              placeholder="Note"
                              className="w-full px-3 py-2 border border-neutral-warm rounded-lg text-sm"
                            />
                            <input
                              type="url"
                              value={draft.proof_url}
                              onChange={(e) => handleItemDraftChange(item.id, { proof_url: e.target.value })}
                              placeholder="Proof URL (optional)"
                              className="w-full px-3 py-2 border border-neutral-warm rounded-lg text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveItem(item.id)}
                              disabled={saving}
                              className="min-h-11 px-3 py-2 rounded-lg bg-secondary text-primary-dark text-sm font-medium hover:bg-secondary-dark disabled:opacity-50"
                            >
                              {saving ? 'Saving...' : 'Save note/proof'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {periodDetail.period.status === 'open' ? (
                    <button
                      type="button"
                      onClick={handleCompletePeriod}
                      disabled={completingPeriod}
                      className="min-h-11 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {completingPeriod ? 'Completing...' : 'Mark Period Complete'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleReopenPeriod}
                      disabled={reopeningPeriod}
                      className="min-h-11 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                    >
                      {reopeningPeriod ? 'Reopening...' : 'Reopen Period'}
                    </button>
                  )}
                </div>
                <Link
                  to={`/admin/clients/${selectedCell.clientId}`}
                  className="text-sm text-primary hover:text-primary-dark underline"
                >
                  Open client details
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-text-muted">Unable to open this period yet.</p>
                <button
                  type="button"
                  onClick={handleRetryCreatePeriod}
                  className="min-h-11 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark"
                >
                  Retry opening period
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
