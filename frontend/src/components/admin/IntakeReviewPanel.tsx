import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { ClientIntakeReview, IntakeSubmissionDetail, IntakeReviewField } from '../../lib/api'
import { formatDateTime } from '../../lib/dateUtils'

interface IntakeReviewPanelProps {
  reviews: ClientIntakeReview[]
  onResolved: () => void
}

// Public intakes whose email matched a client already on file. The form never
// edits that client; staff pick which submitted values to copy over here.
export default function IntakeReviewPanel({ reviews, onResolved }: IntakeReviewPanelProps) {
  const [openId, setOpenId] = useState<number | null>(null)

  if (reviews.length === 0) return null

  return (
    <>
      {reviews.map(review => (
        <div
          key={review.id}
          className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <p className="text-blue-900 text-sm">
            {review.role === 'submitted' ? (
              <>
                This client was created by a public intake form whose email matches{' '}
                <span className="font-semibold">{review.other_client?.full_name ?? 'an existing client'}</span>.
                Nothing on that client has changed yet.
              </>
            ) : (
              <>
                A public intake form submitted {formatDateTime(review.submitted_at)} uses this client's email.
                It was saved separately and hasn't changed this client.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setOpenId(review.id)}
            className="shrink-0 px-4 py-3.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark"
          >
            Review intake
          </button>
        </div>
      ))}
      {openId !== null && (
        <IntakeReviewModal
          submissionId={openId}
          onClose={() => setOpenId(null)}
          onResolved={() => {
            setOpenId(null)
            onResolved()
          }}
        />
      )}
    </>
  )
}

function displayValue(value: IntakeReviewField['submitted']) {
  if (value === null || value === undefined || value === '') return <span className="text-gray-400">—</span>
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

interface IntakeReviewModalProps {
  submissionId: number
  onClose: () => void
  onResolved: () => void
}

function IntakeReviewModal({ submissionId, onClose, onResolved }: IntakeReviewModalProps) {
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [detail, setDetail] = useState<IntakeSubmissionDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [includeDependents, setIncludeDependents] = useState(false)
  const [saving, setSaving] = useState<'merge' | 'separate' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.getIntakeSubmission(submissionId).then(result => {
      if (cancelled) return
      if (result.data) setDetail(result.data.intake_submission)
      else setLoadError(result.error || 'Could not load this intake')
    })
    return () => {
      cancelled = true
    }
  }, [submissionId])

  // Move focus into the dialog on open and give it back to the trigger on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    return () => opener?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
      if (event.key !== 'Tab' || !dialogRef.current) return

      // Keep Tab and Shift+Tab inside the dialog.
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const toggleField = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const differing = detail?.fields.filter(field => field.differs) ?? []
  const matching = detail?.fields.filter(field => !field.differs) ?? []
  const existingName = detail?.matched_client?.full_name ?? 'the existing client'

  const handleMerge = async () => {
    if (!detail?.matched_client) return
    setSaving('merge')
    setActionError(null)
    const result = await api.mergeIntakeSubmission(detail.id, {
      fields: Array.from(selected),
      include_dependents: includeDependents,
    })
    setSaving(null)
    if (result.error) {
      setActionError(result.error)
      return
    }
    onResolved()
    if (result.data) navigate(`/admin/clients/${result.data.client_id}`)
  }

  const handleKeepSeparate = async () => {
    if (!detail) return
    setSaving('separate')
    setActionError(null)
    const result = await api.keepIntakeSubmissionSeparate(detail.id)
    setSaving(null)
    if (result.error) {
      setActionError(result.error)
      return
    }
    onResolved()
  }

  // Portaled so the overlay covers the page even inside animated containers.
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="intake-review-title"
        className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden focus:outline-none"
        onClick={event => event.stopPropagation()}
      >
        <div className="p-6 border-b border-secondary-dark">
          <h2 id="intake-review-title" className="text-xl font-bold text-primary-dark">Review intake</h2>
          {detail && (
            <p className="text-sm text-gray-500 mt-1">
              Submitted {formatDateTime(detail.submitted_at)} with the email of {existingName}. Tick the submitted values
              to copy onto {existingName}; anything unticked stays as it is.
            </p>
          )}
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {loadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{loadError}</div>
          )}
          {!detail && !loadError && <p className="text-sm text-gray-500">Loading…</p>}

          {detail && (
            <>
              {differing.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 pr-3 w-10"><span className="sr-only">Copy</span></th>
                        <th className="py-2 pr-3">Field</th>
                        <th className="py-2 pr-3">On file</th>
                        <th className="py-2">Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {differing.map(field => (
                        <tr key={field.key} className="border-b last:border-0 align-top">
                          <td className="py-2 pr-3">
                            <input
                              id={`intake-field-${field.key}`}
                              type="checkbox"
                              checked={selected.has(field.key)}
                              onChange={() => toggleField(field.key)}
                              className="h-4 w-4"
                            />
                          </td>
                          <td className="py-2 pr-3 font-medium text-gray-700">
                            <label htmlFor={`intake-field-${field.key}`}>{field.label}</label>
                          </td>
                          <td className="py-2 pr-3 text-gray-600 break-words">{displayValue(field.existing)}</td>
                          <td className="py-2 text-gray-900 break-words">{displayValue(field.submitted)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-600">Every submitted client field already matches what's on file.</p>
              )}

              {matching.length > 0 && (
                <p className="text-xs text-gray-500">
                  Already the same: {matching.map(field => field.label).join(', ')}.
                </p>
              )}

              {detail.submitted_dependents.length > 0 && (
                <div className="space-y-2">
                  <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={includeDependents}
                      onChange={event => setIncludeDependents(event.target.checked)}
                      className="h-4 w-4 mt-0.5"
                    />
                    <span>
                      Add submitted dependents not already on file:{' '}
                      {detail.submitted_dependents.map(dep => dep.name).join(', ')}
                      {detail.existing_dependents.length > 0 && (
                        <span className="text-gray-500">
                          {' '}(on file: {detail.existing_dependents.map(dep => dep.name).join(', ')})
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              )}

              {detail.tax_return && (
                <p className="text-sm text-gray-600">
                  Merging also moves this intake's {detail.tax_return.tax_year} return work
                  ({detail.tax_return.documents_count} document{detail.tax_return.documents_count === 1 ? '' : 's'},{' '}
                  {detail.tax_return.income_sources_count} income source{detail.tax_return.income_sources_count === 1 ? '' : 's'})
                  to {existingName}, and archives the separate intake client.
                </p>
              )}

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{actionError}</div>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-secondary-dark flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={!!saving}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleKeepSeparate}
              disabled={!detail || !!saving}
              className="px-4 py-3.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {saving === 'separate' ? 'Saving…' : 'Keep as separate client'}
            </button>
            <button
              type="button"
              onClick={handleMerge}
              disabled={!detail?.matched_client || !!saving}
              className="px-4 py-3.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
            >
              {saving === 'merge' ? 'Merging…' : `Merge into ${existingName}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
