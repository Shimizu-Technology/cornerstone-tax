import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { WorkflowStage, UserSummary, ClientSummary } from '../../lib/api'

interface NewTaxReturnModalProps {
  isOpen: boolean
  onClose: () => void
  defaultClient?: { id: number; full_name: string; email?: string; client_type?: string } | null
  onCreated?: () => void
}

const currentYear = new Date().getFullYear()

const RETURN_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'business', label: 'Business' },
  { value: 'amended', label: 'Amended' },
  { value: 'prior_year', label: 'Prior Year' },
  { value: 'extension', label: 'Extension' },
  { value: 'notice', label: 'Notice Response' },
  { value: 'other', label: 'Other' },
]

const PAYMENT_STATUSES = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'waived', label: 'Waived' },
]

const centsFromDollars = (value: string) => Math.round((parseFloat(value || '0') || 0) * 100)

export default function NewTaxReturnModal({ isOpen, onClose, defaultClient, onCreated }: NewTaxReturnModalProps) {
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [stages, setStages] = useState<WorkflowStage[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    client_id: defaultClient?.id?.toString() || '',
    tax_year: currentYear.toString(),
    return_type: defaultClient?.client_type === 'business' ? 'business' : 'individual',
    form_type: defaultClient?.client_type === 'business' ? '1120S' : '1040',
    jurisdiction: 'both',
    workflow_stage_id: '',
    assigned_to_id: '',
    reviewed_by_id: '',
    priority: 'normal',
    payment_status: 'unpaid',
    base_fee: '',
    discount_amount: '',
    discount_reason: '',
    amount_paid: '',
    portal_visible: false,
    documents_enabled: true,
    signature_status: 'not_needed',
    notes: '',
  })

  useEffect(() => {
    if (!isOpen) return
    setForm(prev => ({
      ...prev,
      client_id: defaultClient?.id?.toString() || prev.client_id,
      return_type: defaultClient?.client_type === 'business' ? 'business' : prev.return_type,
      form_type: defaultClient?.client_type === 'business' ? '1120S' : prev.form_type,
    }))
  }, [defaultClient, isOpen])

  useEffect(() => {
    if (!isOpen) return

    async function loadBasics() {
      const [stageRes, userRes] = await Promise.all([api.getWorkflowStages(), api.getUsers()])
      if (stageRes.data) {
        setStages(stageRes.data.workflow_stages)
        setForm(prev => ({ ...prev, workflow_stage_id: prev.workflow_stage_id || String(stageRes.data!.workflow_stages[0]?.id || '') }))
      }
      if (userRes.data) setUsers(userRes.data.users)
    }

    loadBasics()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || defaultClient) return

    const timeout = window.setTimeout(async () => {
      const result = await api.getClients({ search: clientSearch, per_page: 10 })
      if (result.data) setClients(result.data.clients)
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [clientSearch, defaultClient, isOpen])

  const selectedClient = defaultClient || clients.find(c => c.id.toString() === form.client_id)
  const finalFee = Math.max(centsFromDollars(form.base_fee) - centsFromDollars(form.discount_amount), 0)
  const balanceDue = Math.max(finalFee - centsFromDollars(form.amount_paid), 0)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!form.client_id) {
      setError('Choose a client for this return.')
      return
    }

    setSaving(true)
    try {
      const result = await api.createTaxReturn({
        client_id: Number(form.client_id),
        tax_year: Number(form.tax_year),
        return_type: form.return_type,
        form_type: form.form_type.trim() || 'general',
        jurisdiction: form.jurisdiction,
        workflow_stage_id: form.workflow_stage_id ? Number(form.workflow_stage_id) : undefined,
        assigned_to_id: form.assigned_to_id ? Number(form.assigned_to_id) : undefined,
        reviewed_by_id: form.reviewed_by_id ? Number(form.reviewed_by_id) : undefined,
        priority: form.priority,
        payment_status: form.payment_status,
        base_fee_cents: centsFromDollars(form.base_fee),
        discount_amount_cents: centsFromDollars(form.discount_amount),
        discount_reason: form.discount_reason,
        amount_paid_cents: centsFromDollars(form.amount_paid),
        portal_visible: form.portal_visible,
        documents_enabled: form.documents_enabled,
        signature_status: form.signature_status,
        notes: form.notes,
      })

      if (result.error || result.errors?.length) {
        setError(result.errors?.join(', ') || result.error || 'Could not create tax return.')
        return
      }

      if (result.data) {
        onCreated?.()
        onClose()
        navigate(`/admin/returns/${result.data.tax_return.id}`)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl max-h-[92vh] overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-secondary-dark bg-white px-6 py-4 rounded-t-2xl">
            <div>
              <h2 className="text-xl font-bold text-gray-900">New Tax Return</h2>
              <p className="text-sm text-gray-500">Create a trackable return for intake, walk-ins, legacy work, or in-progress cases.</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Client</label>
                {defaultClient ? (
                  <div className="rounded-xl border border-secondary-dark bg-secondary/30 px-3 py-2">
                    <p className="font-medium text-gray-900">{defaultClient.full_name}</p>
                    {defaultClient.email && <p className="text-sm text-gray-500">{defaultClient.email}</p>}
                  </div>
                ) : (
                  <>
                    <input
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      placeholder="Search clients by name, email, or business..."
                      className="mb-2 w-full rounded-xl border border-secondary-dark px-3 py-2 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <select
                      value={form.client_id}
                      onChange={e => setForm({ ...form, client_id: e.target.value })}
                      className="w-full rounded-xl border border-secondary-dark px-3 py-2 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      required
                    >
                      <option value="">Choose a client</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.client_type === 'business' && client.business_name ? client.business_name : client.full_name}
                          {client.email ? ` (${client.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tax Year</label>
                <input type="number" value={form.tax_year} onChange={e => setForm({ ...form, tax_year: e.target.value })} className="w-full rounded-xl border border-secondary-dark px-3 py-2" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Return Type</label>
                <select value={form.return_type} onChange={e => setForm({ ...form, return_type: e.target.value })} className="w-full rounded-xl border border-secondary-dark px-3 py-2">
                  {RETURN_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Form</label>
                <input value={form.form_type} onChange={e => setForm({ ...form, form_type: e.target.value })} placeholder="1040, 1120S, 1065..." className="w-full rounded-xl border border-secondary-dark px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Jurisdiction</label>
                <select value={form.jurisdiction} onChange={e => setForm({ ...form, jurisdiction: e.target.value })} className="w-full rounded-xl border border-secondary-dark px-3 py-2">
                  <option value="both">Guam + Federal</option>
                  <option value="guam">Guam</option>
                  <option value="federal">Federal</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Workflow Status</label>
                <select value={form.workflow_stage_id} onChange={e => setForm({ ...form, workflow_stage_id: e.target.value })} className="w-full rounded-xl border border-secondary-dark px-3 py-2">
                  {stages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Assigned To</label>
                <select value={form.assigned_to_id} onChange={e => setForm({ ...form, assigned_to_id: e.target.value })} className="w-full rounded-xl border border-secondary-dark px-3 py-2">
                  <option value="">Unassigned</option>
                  {users.map(user => <option key={user.id} value={user.id}>{user.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Reviewer</label>
                <select value={form.reviewed_by_id} onChange={e => setForm({ ...form, reviewed_by_id: e.target.value })} className="w-full rounded-xl border border-secondary-dark px-3 py-2">
                  <option value="">Not reviewed</option>
                  {users.map(user => <option key={user.id} value={user.id}>{user.full_name}</option>)}
                </select>
              </div>
            </section>

            <section className="rounded-2xl bg-secondary/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Payment</h3>
                <p className="text-sm text-gray-500">Balance: ${(balanceDue / 100).toFixed(2)}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <input value={form.base_fee} onChange={e => setForm({ ...form, base_fee: e.target.value })} placeholder="Base fee" className="rounded-xl border border-secondary-dark px-3 py-2" inputMode="decimal" />
                <input value={form.discount_amount} onChange={e => setForm({ ...form, discount_amount: e.target.value })} placeholder="Discount" className="rounded-xl border border-secondary-dark px-3 py-2" inputMode="decimal" />
                <input value={form.amount_paid} onChange={e => setForm({ ...form, amount_paid: e.target.value })} placeholder="Amount paid" className="rounded-xl border border-secondary-dark px-3 py-2" inputMode="decimal" />
                <select value={form.payment_status} onChange={e => setForm({ ...form, payment_status: e.target.value })} className="rounded-xl border border-secondary-dark px-3 py-2">
                  {PAYMENT_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
                <input value={form.discount_reason} onChange={e => setForm({ ...form, discount_reason: e.target.value })} placeholder="Discount reason or approval note" className="md:col-span-4 rounded-xl border border-secondary-dark px-3 py-2" />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="flex items-start gap-3 rounded-xl border border-secondary-dark p-3">
                <input type="checkbox" checked={form.portal_visible} onChange={e => setForm({ ...form, portal_visible: e.target.checked })} className="mt-1" />
                <span><span className="block font-medium text-gray-900">Show in portal</span><span className="text-sm text-gray-500">Client can see this return.</span></span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-secondary-dark p-3">
                <input type="checkbox" checked={form.documents_enabled} onChange={e => setForm({ ...form, documents_enabled: e.target.checked })} className="mt-1" />
                <span><span className="block font-medium text-gray-900">Allow uploads</span><span className="text-sm text-gray-500">Client can add documents.</span></span>
              </label>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Signature</label>
                <select value={form.signature_status} onChange={e => setForm({ ...form, signature_status: e.target.value })} className="w-full rounded-xl border border-secondary-dark px-3 py-2">
                  <option value="not_needed">Not needed</option>
                  <option value="requested">Requested</option>
                  <option value="signed">Signed</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
            </section>

            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Internal notes..." className="w-full rounded-xl border border-secondary-dark px-3 py-2" />

            <div className="flex justify-end gap-3 border-t border-secondary-dark pt-4">
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button type="submit" disabled={saving || !selectedClient} className="rounded-xl bg-primary px-5 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Tax Return'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
