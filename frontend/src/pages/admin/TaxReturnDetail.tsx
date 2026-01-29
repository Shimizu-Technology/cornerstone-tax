import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Document } from '../../lib/api'
import { formatDate, formatDateTime } from '../../lib/dateUtils'
import DocumentUpload from '../../components/admin/DocumentUpload'

// Define types locally to avoid Vite import caching issues
interface IncomeSourceLocal {
  id: number
  source_type: string
  payer_name: string
  notes?: string | null
}

interface TaxReturnDetailLocal {
  id: number
  tax_year: number
  notes: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  client: {
    id: number
    full_name: string
    email: string
    phone: string
    filing_status: string
  }
  workflow_stage: {
    id: number
    name: string
    slug: string
    color: string
  } | null
  assigned_to: {
    id: number
    name: string
    email: string
  } | null
  reviewed_by: {
    id: number
    name: string
  } | null
  income_sources: IncomeSourceLocal[]
  documents: Document[]
  workflow_events: Array<{
    id: number
    event_type: string
    old_value: string | null
    new_value: string | null
    description: string
    actor: string
    created_at: string
  }>
}

interface WorkflowStageLocal {
  id: number
  name: string
  slug: string
  position: number
  color: string | null
  notify_client: boolean
}

interface UserSummaryLocal {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  full_name: string
  role: string
}

// Income source types
const INCOME_SOURCE_TYPES = [
  { value: 'w2', label: 'W-2 (Employment)' },
  { value: '1099', label: '1099 (Contractor/Freelance)' },
  { value: 'business', label: 'Business Income' },
  { value: 'rental', label: 'Rental Income' },
  { value: 'investment', label: 'Investment Income' },
  { value: 'retirement', label: 'Retirement Income' },
  { value: 'social_security', label: 'Social Security' },
  { value: 'other', label: 'Other' },
]

// Icons
const EditIcon = () => (
  <svg className="h-4 w-4" fill="none" aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

const PlusIcon = () => (
  <svg className="h-4 w-4" fill="none" aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const TrashIcon = () => (
  <svg className="h-4 w-4" fill="none" aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const UserIcon = () => (
  <svg className="h-4 w-4" fill="none" aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

export default function TaxReturnDetailPage() {
  useEffect(() => { document.title = 'Tax Return Details | Cornerstone Admin' }, [])

  const { id } = useParams<{ id: string }>()
  const [taxReturn, setTaxReturn] = useState<TaxReturnDetailLocal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dropdown data
  const [stages, setStages] = useState<WorkflowStageLocal[]>([])
  const [users, setUsers] = useState<UserSummaryLocal[]>([])
  
  // Edit states
  const [saving, setSaving] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState('')

  // Income source modal
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [editingIncomeSource, setEditingIncomeSource] = useState<IncomeSourceLocal | null>(null)
  const [incomeForm, setIncomeForm] = useState({ source_type: 'w2', payer_name: '', notes: '' })

  // Initial load - shows full page spinner
  const loadTaxReturn = async () => {
    if (!id) return
    setLoading(true)
    try {
      const result = await api.getTaxReturn(parseInt(id))
      if (result.data) {
        setTaxReturn(result.data.tax_return)
        setNotes(result.data.tax_return.notes || '')
      } else if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to load tax return')
    } finally {
      setLoading(false)
    }
  }

  // Refresh without full page loading spinner (for inline updates)
  const refreshTaxReturn = async () => {
    if (!id) return
    try {
      const result = await api.getTaxReturn(parseInt(id))
      if (result.data) {
        setTaxReturn(result.data.tax_return)
        setNotes(result.data.tax_return.notes || '')
      }
    } catch (err) {
      console.error('Failed to refresh tax return:', err)
    }
  }

  const loadDropdownData = async () => {
    try {
      const [stagesRes, usersRes] = await Promise.all([
        api.getWorkflowStages(),
        api.getUsers()
      ])
      if (stagesRes.data) setStages(stagesRes.data.workflow_stages)
      if (usersRes.data) setUsers(usersRes.data.users)
    } catch (err) {
      console.error('Failed to load dropdown data:', err)
    }
  }

  useEffect(() => {
    loadTaxReturn()
    loadDropdownData()
  }, [id])

  const handleStatusChange = async (stageId: number) => {
    if (!taxReturn) return
    setSaving(true)
    try {
      await api.updateTaxReturn(taxReturn.id, { workflow_stage_id: stageId })
      await loadTaxReturn()
    } catch (err) {
      alert('Failed to update status')
    } finally {
      setSaving(false)
    }
  }

  const handleAssign = async (userId: number | null) => {
    if (!taxReturn) return
    setSaving(true)
    try {
      if (userId) {
        await api.assignTaxReturn(taxReturn.id, userId)
      } else {
        await api.updateTaxReturn(taxReturn.id, { assigned_to_id: null })
      }
      await loadTaxReturn()
    } catch (err) {
      alert('Failed to update assignment')
    } finally {
      setSaving(false)
    }
  }

  const handleReviewerChange = async (userId: number | null) => {
    if (!taxReturn) return
    setSaving(true)
    try {
      await api.updateTaxReturn(taxReturn.id, { reviewed_by_id: userId })
      await loadTaxReturn()
    } catch (err) {
      alert('Failed to update reviewer')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!taxReturn) return
    setSaving(true)
    try {
      await api.updateTaxReturn(taxReturn.id, { notes })
      await loadTaxReturn()
      setEditingNotes(false)
    } catch (err) {
      alert('Failed to save notes')
    } finally {
      setSaving(false)
    }
  }

  // Income source handlers
  const openAddIncomeModal = () => {
    setEditingIncomeSource(null)
    setIncomeForm({ source_type: 'w2', payer_name: '', notes: '' })
    setShowIncomeModal(true)
  }

  const openEditIncomeModal = (src: IncomeSourceLocal) => {
    setEditingIncomeSource(src)
    setIncomeForm({
      source_type: src.source_type,
      payer_name: src.payer_name,
      notes: src.notes || ''
    })
    setShowIncomeModal(true)
  }

  const handleSaveIncomeSource = async () => {
    if (!taxReturn || !incomeForm.payer_name.trim()) return
    setSaving(true)
    try {
      if (editingIncomeSource) {
        await api.updateIncomeSource(taxReturn.id, editingIncomeSource.id, incomeForm)
      } else {
        await api.createIncomeSource(taxReturn.id, incomeForm)
      }
      await loadTaxReturn()
      setShowIncomeModal(false)
    } catch (err) {
      alert('Failed to save income source')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteIncomeSource = async (srcId: number) => {
    if (!taxReturn) return
    if (!confirm('Are you sure you want to delete this income source?')) return
    setSaving(true)
    try {
      await api.deleteIncomeSource(taxReturn.id, srcId)
      await loadTaxReturn()
    } catch (err) {
      alert('Failed to delete income source')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !taxReturn) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error || 'Tax return not found'}</p>
        <Link to="/admin/returns" className="text-primary hover:underline mt-4 inline-block">
          ← Back to Tax Returns
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link to="/admin/returns" className="text-gray-500 hover:text-gray-700 text-sm mb-2 inline-block">
            ← Back to Tax Returns
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {taxReturn.tax_year} Tax Return
          </h1>
          <Link 
            to={`/admin/clients/${taxReturn.client.id}`}
            className="text-primary hover:text-primary-dark font-medium"
          >
            {taxReturn.client.full_name}
          </Link>
          <p className="text-gray-500">{taxReturn.client.email}</p>
        </div>

        {taxReturn.workflow_stage && (
          <span
            className="px-4 py-2 rounded-full text-sm font-medium text-white self-start"
            style={{ backgroundColor: taxReturn.workflow_stage.color || '#6B7280' }}
          >
            {taxReturn.workflow_stage.name}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workflow Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Workflow</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="return-status" className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  id="return-status"
                  value={taxReturn.workflow_stage?.id || ''}
                  onChange={(e) => handleStatusChange(parseInt(e.target.value))}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="return-assignee" className="block text-sm font-medium text-gray-700 mb-2">Assigned To</label>
                <select
                  id="return-assignee"
                  value={taxReturn.assigned_to?.id || ''}
                  onChange={(e) => handleAssign(e.target.value ? parseInt(e.target.value) : null)}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="return-reviewer" className="block text-sm font-medium text-gray-700 mb-2">Reviewed By</label>
                <select
                  id="return-reviewer"
                  value={taxReturn.reviewed_by?.id || ''}
                  onChange={(e) => handleReviewerChange(e.target.value ? parseInt(e.target.value) : null)}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Not Reviewed</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Client Info Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Client Information</h2>
              <Link 
                to={`/admin/clients/${taxReturn.client.id}`}
                className="text-primary hover:text-primary-dark text-sm font-medium"
              >
                View Full Profile →
              </Link>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Name</dt>
                <dd className="font-medium">{taxReturn.client.full_name}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Email</dt>
                <dd className="font-medium">{taxReturn.client.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="font-medium">{taxReturn.client.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Filing Status</dt>
                <dd className="font-medium capitalize">{taxReturn.client.filing_status || '—'}</dd>
              </div>
            </dl>
          </div>

          {/* Income Sources */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Income Sources ({taxReturn.income_sources.length})
              </h2>
              <button
                onClick={openAddIncomeModal}
                className="inline-flex items-center gap-1 text-primary hover:text-primary-dark text-sm font-medium"
              >
                <PlusIcon />
                Add Source
              </button>
            </div>
            {taxReturn.income_sources.length === 0 ? (
              <p className="text-gray-400 italic">No income sources added yet</p>
            ) : (
              <div className="space-y-3">
                {taxReturn.income_sources.map((src) => (
                  <div key={src.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{src.payer_name}</p>
                      <p className="text-sm text-gray-500">
                        {INCOME_SOURCE_TYPES.find(t => t.value === src.source_type)?.label || src.source_type.toUpperCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditIncomeModal(src)}
                        className="p-2 text-gray-500 hover:text-primary hover:bg-white rounded-lg transition-colors"
                        title="Edit"
                      >
                        <EditIcon />
                      </button>
                      <button
                        onClick={() => handleDeleteIncomeSource(src.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents */}
          <DocumentUpload
            taxReturnId={taxReturn.id}
            documents={taxReturn.documents}
            onDocumentsChange={refreshTaxReturn}
          />

          {/* Notes */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Internal Notes</h2>
              {!editingNotes && (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="inline-flex items-center gap-1 text-primary hover:text-primary-dark text-sm font-medium"
                >
                  <EditIcon />
                  {taxReturn.notes ? 'Edit' : 'Add Note'}
                </button>
              )}
            </div>
            
            {editingNotes ? (
              <div className="space-y-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Add internal notes about this tax return..."
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditingNotes(false)
                      setNotes(taxReturn.notes || '')
                    }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap">
                {taxReturn.notes || <span className="text-gray-400 italic">No notes yet</span>}
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500">Tax Year</dt>
                <dd className="font-bold text-lg">{taxReturn.tax_year}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Assigned To</dt>
                <dd className="font-medium">
                  {taxReturn.assigned_to ? (
                    <span className="inline-flex items-center gap-1">
                      <UserIcon />
                      {taxReturn.assigned_to.name}
                    </span>
                  ) : (
                    <span className="text-gray-400">Unassigned</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Reviewed By</dt>
                <dd className="font-medium">
                  {taxReturn.reviewed_by ? (
                    <span className="inline-flex items-center gap-1">
                      <UserIcon />
                      {taxReturn.reviewed_by.name}
                    </span>
                  ) : (
                    <span className="text-gray-400">Not Reviewed</span>
                  )}
                </dd>
              </div>
              {taxReturn.completed_at && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Completed</dt>
                  <dd className="font-medium">{formatDate(taxReturn.completed_at)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity</h2>
            {taxReturn.workflow_events.length === 0 ? (
              <p className="text-gray-500 text-sm">No activity yet</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {taxReturn.workflow_events.map((event) => (
                  <div key={event.id} className="border-l-2 border-gray-200 pl-4">
                    <p className="text-sm font-medium text-gray-900">
                      {event.description || event.event_type}
                    </p>
                    <p className="text-xs text-gray-500">
                      {event.actor} • {formatDateTime(event.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500">
            <p>Created: {formatDateTime(taxReturn.created_at)}</p>
            <p>Updated: {formatDateTime(taxReturn.updated_at)}</p>
          </div>
        </div>
      </div>

      {/* Income Source Modal */}
      {showIncomeModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowIncomeModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-secondary-dark">
              <h2 className="text-xl font-bold text-primary-dark">
                {editingIncomeSource ? 'Edit Income Source' : 'Add Income Source'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="income-doc-type" className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                <select
                  id="income-doc-type"
                  value={incomeForm.source_type}
                  onChange={e => setIncomeForm({ ...incomeForm, source_type: e.target.value })}
                  className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {INCOME_SOURCE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="payer-name" className="block text-sm font-medium text-gray-700 mb-2">Payer Name *</label>
                <input
                  type="text"
                  value={incomeForm.payer_name}
                  onChange={e => setIncomeForm({ ...incomeForm, payer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="e.g., Shimizu Technology"
                />
              </div>

              <div>
                <label htmlFor="income-notes" className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                <textarea
                  value={incomeForm.notes}
                  onChange={e => setIncomeForm({ ...incomeForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Any additional notes..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-secondary-dark flex justify-end gap-3">
              <button
                onClick={() => setShowIncomeModal(false)}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveIncomeSource}
                disabled={saving || !incomeForm.payer_name.trim()}
                className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingIncomeSource ? 'Save Changes' : 'Add Source'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
