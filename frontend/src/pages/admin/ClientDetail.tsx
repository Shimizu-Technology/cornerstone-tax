import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatDate, formatDateTime } from '../../lib/dateUtils'

interface Dependent {
  id: number
  name: string
  date_of_birth: string
  relationship: string
  months_lived_with_client: number
  is_student: boolean
  is_disabled: boolean
}

interface WorkflowEvent {
  id: number
  event_type: string
  old_value: string | null
  new_value: string | null
  description: string
  actor: string
  created_at: string
}

interface TaxReturn {
  id: number
  tax_year: number
  notes?: string | null
  status: string
  status_slug: string
  status_color: string
  assigned_to: { id: number; name: string } | null
  created_at: string
  income_sources: { id: number; source_type: string; payer_name: string }[]
  workflow_events: WorkflowEvent[]
}

interface ClientDetail {
  id: number
  first_name: string
  last_name: string
  full_name: string
  date_of_birth: string
  email: string
  phone: string
  mailing_address: string
  filing_status: string
  is_new_client: boolean
  has_prior_year_return: boolean
  changes_from_prior_year: string
  spouse_name: string
  spouse_dob: string
  denied_eic_actc: boolean
  denied_eic_actc_year: number | null
  has_crypto_transactions: boolean
  wants_direct_deposit: boolean
  created_at: string
  updated_at: string
  dependents: Dependent[]
  tax_returns: TaxReturn[]
}

interface EditFormData {
  first_name: string
  last_name: string
  email: string
  phone: string
  date_of_birth: string
  mailing_address: string
  filing_status: string
  spouse_name: string
  spouse_dob: string
  is_new_client: boolean
  has_prior_year_return: boolean
  changes_from_prior_year: string
  has_crypto_transactions: boolean
  wants_direct_deposit: boolean
  denied_eic_actc: boolean
  denied_eic_actc_year: string
}

// Icons
const EditIcon = () => (
  <svg className="h-4 w-4" fill="none" aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

export default function ClientDetailPage() {
  useEffect(() => { document.title = 'Client Details | Cornerstone Admin' }, [])

  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<EditFormData | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Tax return notes editing
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null)
  const [editingNotes, setEditingNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const loadClient = async () => {
    if (!id) return
    setLoading(true)
    try {
      const result = await api.getClient(parseInt(id))
      if (result.data) {
        setClient(result.data.client)
      } else if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to load client')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClient()
  }, [id])

  const startEditingNotes = (tr: TaxReturn) => {
    setEditingNotesId(tr.id)
    setEditingNotes(tr.notes || '')
  }

  const cancelEditingNotes = () => {
    setEditingNotesId(null)
    setEditingNotes('')
  }

  const saveNotes = async (taxReturnId: number) => {
    setSavingNotes(true)
    try {
      const result = await api.updateTaxReturn(taxReturnId, { notes: editingNotes })
      if (result.data) {
        // Reload client to get updated data
        await loadClient()
        setEditingNotesId(null)
        setEditingNotes('')
      } else if (result.error) {
        alert('Failed to save notes: ' + result.error)
      }
    } catch (err) {
      alert('Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  const openEditModal = () => {
    if (!client) return
    setEditForm({
      first_name: client.first_name || '',
      last_name: client.last_name || '',
      email: client.email || '',
      phone: client.phone || '',
      date_of_birth: client.date_of_birth || '',
      mailing_address: client.mailing_address || '',
      filing_status: client.filing_status || '',
      spouse_name: client.spouse_name || '',
      spouse_dob: client.spouse_dob || '',
      is_new_client: client.is_new_client,
      has_prior_year_return: client.has_prior_year_return,
      changes_from_prior_year: client.changes_from_prior_year || '',
      has_crypto_transactions: client.has_crypto_transactions,
      wants_direct_deposit: client.wants_direct_deposit,
      denied_eic_actc: client.denied_eic_actc,
      denied_eic_actc_year: client.denied_eic_actc_year?.toString() || '',
    })
    setSaveError(null)
    setShowEditModal(true)
  }

  const handleSave = async () => {
    if (!client || !editForm) return
    setSaving(true)
    setSaveError(null)

    try {
      const dataToSend = {
        ...editForm,
        denied_eic_actc_year: editForm.denied_eic_actc_year ? parseInt(editForm.denied_eic_actc_year) : null,
      }
      
      const result = await api.updateClient(client.id, dataToSend)
      if (result.data) {
        setClient(result.data.client)
        setShowEditModal(false)
      } else if (result.error) {
        setSaveError(result.error)
      } else if (result.errors) {
        setSaveError(result.errors.join(', '))
      }
    } catch (err) {
      setSaveError('Failed to save changes')
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

  if (error || !client) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error || 'Client not found'}</p>
        <Link to="/admin/clients" className="text-primary hover:underline mt-4 inline-block">
          ← Back to Clients
        </Link>
      </div>
    )
  }

  const latestReturn = client.tax_returns[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link to="/admin/clients" className="text-gray-500 hover:text-gray-700 text-sm mb-2 inline-block">
            ← Back to Clients
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{client.full_name}</h1>
          <p className="text-gray-500">{client.email}</p>
        </div>
        <div className="flex items-center gap-3 self-start">
          <button
            onClick={openEditModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-secondary-dark rounded-xl text-primary-dark font-medium hover:bg-secondary transition-colors"
          >
            <EditIcon />
            Edit Client
          </button>
          {latestReturn && (
            <span
              className="px-4 py-2 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: latestReturn.status_color || '#6B7280' }}
            >
              {latestReturn.status}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="font-medium">{client.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Email</dt>
                <dd className="font-medium">{client.email}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-gray-500">Mailing Address</dt>
                <dd className="font-medium whitespace-pre-line">{client.mailing_address || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Date of Birth</dt>
                <dd className="font-medium">
                  {client.date_of_birth ? formatDate(client.date_of_birth) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Filing Status</dt>
                <dd className="font-medium capitalize">{client.filing_status || '—'}</dd>
              </div>
            </dl>
          </div>

          {/* Spouse Info */}
          {client.spouse_name && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Spouse Information</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Name</dt>
                  <dd className="font-medium">{client.spouse_name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Date of Birth</dt>
                  <dd className="font-medium">
                    {client.spouse_dob ? formatDate(client.spouse_dob) : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Dependents */}
          {client.dependents.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Dependents ({client.dependents.length})
              </h2>
              <div className="space-y-4">
                {client.dependents.map((dep) => (
                  <div key={dep.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{dep.name}</p>
                      <span className="text-sm text-gray-500">{dep.relationship}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>DOB: {formatDate(dep.date_of_birth)}</span>
                      <span>{dep.months_lived_with_client} months</span>
                      {dep.is_student && <span className="text-blue-600">Student</span>}
                      {dep.is_disabled && <span className="text-orange-600">Disabled</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tax Returns */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Tax Returns</h2>
            {client.tax_returns.length === 0 ? (
              <p className="text-gray-500">No tax returns yet</p>
            ) : (
              <div className="space-y-4">
                {client.tax_returns.map((tr) => (
                  <div key={tr.id} className="border border-gray-200 rounded-lg p-4">
                    {/* Header row */}
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span className="text-lg font-bold">
                        <Link 
                          to={`/admin/returns/${tr.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          {tr.tax_year}
                        </Link>
                      </span>
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: tr.status_color || '#6B7280' }}
                      >
                        {tr.status}
                      </span>
                      <Link 
                        to={`/admin/returns/${tr.id}`}
                        className="text-primary hover:text-primary-dark text-sm font-medium ml-auto"
                      >
                        View →
                      </Link>
                    </div>
                    {tr.assigned_to && (
                      <p className="text-sm text-gray-500 mb-3">
                        Assigned to: {tr.assigned_to.name}
                      </p>
                    )}
                    {tr.income_sources.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-500 mb-1">Income Sources:</p>
                        <div className="flex flex-wrap gap-2">
                          {tr.income_sources.map((src) => (
                            <span
                              key={src.id}
                              className="px-2 py-1 bg-gray-100 rounded text-sm"
                            >
                              {src.source_type.toUpperCase()}: {src.payer_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes Section */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-500">Notes:</p>
                        {editingNotesId !== tr.id && (
                          <button
                            onClick={() => startEditingNotes(tr)}
                            className="text-xs text-primary hover:text-primary-dark font-medium"
                          >
                            {tr.notes ? 'Edit' : 'Add Note'}
                          </button>
                        )}
                      </div>
                      {editingNotesId === tr.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingNotes}
                            onChange={(e) => setEditingNotes(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 text-sm border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            placeholder="Add internal notes about this tax return..."
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={cancelEditingNotes}
                              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                              disabled={savingNotes}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveNotes(tr.id)}
                              disabled={savingNotes}
                              className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                            >
                              {savingNotes ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {tr.notes || <span className="text-gray-400 italic">No notes yet</span>}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Info</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500">New Client</dt>
                <dd className="font-medium">{client.is_new_client ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Prior Year Return</dt>
                <dd className="font-medium">{client.has_prior_year_return ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Direct Deposit</dt>
                <dd className="font-medium">{client.wants_direct_deposit ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Crypto Transactions</dt>
                <dd className="font-medium">{client.has_crypto_transactions ? 'Yes' : 'No'}</dd>
              </div>
              {client.denied_eic_actc && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Denied EIC/ACTC</dt>
                  <dd className="font-medium text-red-600">
                    Yes ({client.denied_eic_actc_year})
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Activity */}
          {latestReturn && latestReturn.workflow_events.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {latestReturn.workflow_events.slice(0, 5).map((event) => (
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
            </div>
          )}

          {/* Changes from Prior Year */}
          {client.changes_from_prior_year && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Changes from Prior Year</h2>
              <p className="text-gray-700 whitespace-pre-line">{client.changes_from_prior_year}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500">
            <p>Created: {formatDateTime(client.created_at)}</p>
            <p>Updated: {formatDateTime(client.updated_at)}</p>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && editForm && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-secondary-dark">
              <h2 className="text-xl font-bold text-primary-dark">Edit Client</h2>
              <p className="text-sm text-gray-500 mt-1">Update client information</p>
            </div>

            <div className="p-6 space-y-6">
              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {saveError}
                </div>
              )}

              {/* Basic Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Basic Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="client-first-name" className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      value={editForm.first_name}
                      onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="client-last-name" className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      value={editForm.last_name}
                      onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="client-email" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="client-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="client-dob" className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={editForm.date_of_birth}
                      onChange={e => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                      className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="client-filing-status" className="block text-sm font-medium text-gray-700 mb-1">Filing Status</label>
                    <select
                      value={editForm.filing_status}
                      onChange={e => setEditForm({ ...editForm, filing_status: e.target.value })}
                      className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="">Select...</option>
                      <option value="single">Single</option>
                      <option value="married_joint">Married Filing Jointly</option>
                      <option value="married_separate">Married Filing Separately</option>
                      <option value="hoh">Head of Household</option>
                      <option value="widow">Qualifying Widow(er)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="client-address" className="block text-sm font-medium text-gray-700 mb-1">Mailing Address</label>
                    <textarea
                      value={editForm.mailing_address}
                      onChange={e => setEditForm({ ...editForm, mailing_address: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Spouse Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Spouse Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="client-spouse-name" className="block text-sm font-medium text-gray-700 mb-1">Spouse Name</label>
                    <input
                      type="text"
                      value={editForm.spouse_name}
                      onChange={e => setEditForm({ ...editForm, spouse_name: e.target.value })}
                      className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="client-spouse-dob" className="block text-sm font-medium text-gray-700 mb-1">Spouse DOB</label>
                    <input
                      type="date"
                      value={editForm.spouse_dob}
                      onChange={e => setEditForm({ ...editForm, spouse_dob: e.target.value })}
                      className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Additional Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 p-3 border border-secondary-dark rounded-lg cursor-pointer hover:bg-secondary/50">
                    <input
                      type="checkbox"
                      checked={editForm.is_new_client}
                      onChange={e => setEditForm({ ...editForm, is_new_client: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-700">New Client</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-secondary-dark rounded-lg cursor-pointer hover:bg-secondary/50">
                    <input
                      type="checkbox"
                      checked={editForm.has_prior_year_return}
                      onChange={e => setEditForm({ ...editForm, has_prior_year_return: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-700">Has Prior Year Return</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-secondary-dark rounded-lg cursor-pointer hover:bg-secondary/50">
                    <input
                      type="checkbox"
                      checked={editForm.wants_direct_deposit}
                      onChange={e => setEditForm({ ...editForm, wants_direct_deposit: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-700">Wants Direct Deposit</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-secondary-dark rounded-lg cursor-pointer hover:bg-secondary/50">
                    <input
                      type="checkbox"
                      checked={editForm.has_crypto_transactions}
                      onChange={e => setEditForm({ ...editForm, has_crypto_transactions: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-700">Has Crypto Transactions</span>
                  </label>
                </div>

                <div className="mt-4 p-4 border border-secondary-dark rounded-lg">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.denied_eic_actc}
                      onChange={e => setEditForm({ ...editForm, denied_eic_actc: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Denied EIC/ACTC</span>
                  </label>
                  {editForm.denied_eic_actc && (
                    <div className="mt-3">
                      <label htmlFor="client-year-denied" className="block text-sm font-medium text-gray-700 mb-1">Year Denied</label>
                      <input
                        type="number"
                        value={editForm.denied_eic_actc_year}
                        onChange={e => setEditForm({ ...editForm, denied_eic_actc_year: e.target.value })}
                        placeholder="e.g., 2023"
                        className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <label htmlFor="client-changes" className="block text-sm font-medium text-gray-700 mb-1">Changes from Prior Year</label>
                  <textarea
                    value={editForm.changes_from_prior_year}
                    onChange={e => setEditForm({ ...editForm, changes_from_prior_year: e.target.value })}
                    rows={3}
                    placeholder="Note any significant changes from the prior year..."
                    className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-secondary-dark flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
