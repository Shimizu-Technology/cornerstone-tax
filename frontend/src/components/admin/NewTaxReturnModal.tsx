import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { WorkflowStage, UserSummary, ClientSummary } from '../../lib/api'

interface NewTaxReturnModalProps {
  isOpen: boolean
  onClose: () => void
  defaultClient?: { id: number; full_name: string; email?: string; client_type?: string } | null
  onCreated?: () => void
}

interface FeeLineItemForm {
  id: string
  label: string
  amount: string
  notes: string
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

const TAX_OUTCOMES = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'refund', label: 'Refund' },
  { value: 'tax_due', label: 'Tax Due' },
  { value: 'no_balance', label: 'No Refund / No Balance' },
]

const SIGNATURE_REQUEST_STAGE_SLUGS = ['ready_to_sign', 'filing', 'ready_for_pickup', 'complete']

const centsFromDollars = (value: string) => Math.round((parseFloat(value || '0') || 0) * 100)
const dollarsFromCents = (value: number) => (value / 100).toFixed(2)

const newFeeLineItem = (): FeeLineItemForm => ({
  id: crypto.randomUUID(),
  label: '',
  amount: '',
  notes: '',
})

const signatureStatusOptionsForStage = (requiresSignatureRequest: boolean) => [
  { value: 'not_needed', label: 'Not needed yet' },
  ...(requiresSignatureRequest ? [{ value: 'requested', label: 'Requested' }] : []),
  { value: 'signed', label: 'Signed' },
  { value: 'waived', label: 'Waived' },
]

const initialFormFor = (defaultClient?: NewTaxReturnModalProps['defaultClient']) => ({
  client_id: defaultClient?.id?.toString() || '',
  tax_year: currentYear.toString(),
  return_type: defaultClient?.client_type === 'business' ? 'business' : 'individual',
  form_type: defaultClient?.client_type === 'business' ? '1120S' : '1040',
  workflow_stage_id: '',
  assigned_to_id: '',
  reviewed_by_id: '',
  priority: 'normal',
  payment_status: 'unpaid',
  base_fee: defaultClient?.client_type === 'business' ? '' : '85.00',
  discount_amount: '',
  discount_reason: '',
  amount_paid: '',
  tax_outcome_status: 'unknown',
  tax_outcome_amount: '',
  tax_outcome_notes: '',
  portal_visible: false,
  documents_enabled: true,
  signature_status: 'not_needed',
  notes: '',
})

const initialClientForm = {
  client_type: 'individual' as 'individual' | 'business',
  business_name: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  filing_status: 'single',
}

export default function NewTaxReturnModal({ isOpen, onClose, defaultClient, onCreated }: NewTaxReturnModalProps) {
  const navigate = useNavigate()
  const defaultClientId = defaultClient?.id
  const defaultClientType = defaultClient?.client_type
  const hasDefaultClient = Boolean(defaultClientId)
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing')
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [stages, setStages] = useState<WorkflowStage[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(() => initialFormFor(defaultClient))
  const [clientForm, setClientForm] = useState(initialClientForm)
  const [feeLineItems, setFeeLineItems] = useState<FeeLineItemForm[]>([])

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setClientSearch('')
    setClients([])
    setClientMode(defaultClient ? 'existing' : 'new')
    setForm(initialFormFor(defaultClient))
    setClientForm(initialClientForm)
    setFeeLineItems([])
  }, [defaultClientId, defaultClientType, isOpen])

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
    if (!isOpen || hasDefaultClient || clientMode === 'new') {
      setClients([])
      return
    }

    let cancelled = false

    const timeout = window.setTimeout(async () => {
      const result = await api.getClients({ search: clientSearch, per_page: 10 })
      if (!cancelled && result.data) setClients(result.data.clients)
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [clientSearch, clientMode, hasDefaultClient, isOpen])

  const selectedClient = defaultClient || clients.find(c => c.id.toString() === form.client_id)
  const selectedWorkflowStage = stages.find(stage => String(stage.id) === form.workflow_stage_id)
  const signatureStageRequiresRequest = selectedWorkflowStage ? SIGNATURE_REQUEST_STAGE_SLUGS.includes(selectedWorkflowStage.slug) : false
  const addOnTotal = useMemo(
    () => feeLineItems.reduce((sum, item) => sum + centsFromDollars(item.amount), 0),
    [feeLineItems]
  )
  const finalFee = Math.max(centsFromDollars(form.base_fee) + addOnTotal - centsFromDollars(form.discount_amount), 0)
  const balanceDue = Math.max(finalFee - centsFromDollars(form.amount_paid), 0)

  const clientNameIsReady = clientForm.client_type === 'business'
    ? clientForm.business_name.trim().length > 0
    : clientForm.first_name.trim().length > 0 && clientForm.last_name.trim().length > 0

  const canSubmit = clientMode === 'new' ? clientNameIsReady : Boolean(selectedClient)

  const updateFeeItem = (id: string, updates: Partial<FeeLineItemForm>) => {
    setFeeLineItems(items => items.map(item => item.id === id ? { ...item, ...updates } : item))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (clientMode === 'existing' && !form.client_id) {
      setError('Choose a client or create a new one.')
      return
    }

    if (clientMode === 'new' && !clientNameIsReady) {
      setError(clientForm.client_type === 'business' ? 'Enter a business name.' : 'Enter the client first and last name.')
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        tax_year: Number(form.tax_year),
        return_type: form.return_type,
        form_type: form.form_type.trim() || '1040',
        jurisdiction: 'both',
        workflow_stage_id: form.workflow_stage_id ? Number(form.workflow_stage_id) : undefined,
        assigned_to_id: form.assigned_to_id ? Number(form.assigned_to_id) : undefined,
        reviewed_by_id: form.reviewed_by_id ? Number(form.reviewed_by_id) : undefined,
        priority: form.priority,
        payment_status: form.payment_status,
        base_fee_cents: centsFromDollars(form.base_fee),
        fee_line_items: feeLineItems.map(item => ({
          label: item.label.trim(),
          amount_cents: centsFromDollars(item.amount),
          notes: item.notes.trim(),
        })),
        discount_amount_cents: centsFromDollars(form.discount_amount),
        discount_reason: form.discount_reason,
        amount_paid_cents: centsFromDollars(form.amount_paid),
        tax_outcome_status: form.tax_outcome_status,
        tax_outcome_amount_cents: centsFromDollars(form.tax_outcome_amount),
        tax_outcome_notes: form.tax_outcome_notes,
        portal_visible: form.portal_visible,
        documents_enabled: form.documents_enabled,
        signature_status: form.signature_status,
        notes: form.notes,
      }

      if (clientMode === 'new') {
        payload.client_attributes = {
          client_type: clientForm.client_type,
          business_name: clientForm.client_type === 'business' ? clientForm.business_name.trim() : undefined,
          first_name: clientForm.first_name.trim(),
          last_name: clientForm.last_name.trim(),
          email: clientForm.email.trim(),
          phone: clientForm.phone.trim(),
          date_of_birth: clientForm.date_of_birth || undefined,
          filing_status: clientForm.client_type === 'individual' ? clientForm.filing_status : undefined,
        }
      } else {
        payload.client_id = Number(form.client_id)
      }

      const result = await api.createTaxReturn(payload)

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
        <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-xl max-h-[92vh] overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-secondary-dark bg-white px-6 py-4 rounded-t-2xl">
            <div>
              <h2 className="text-xl font-bold text-gray-900">New Tax Return</h2>
              <p className="text-sm text-gray-500">Create the client and return together, or add a return for an existing client.</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            {!defaultClient && (
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary/40 p-1">
                <button
                  type="button"
                  onClick={() => setClientMode('existing')}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${clientMode === 'existing' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:bg-white/70'}`}
                >
                  Existing Client
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClientMode('new')
                    setForm(prev => ({ ...prev, client_id: '' }))
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${clientMode === 'new' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:bg-white/70'}`}
                >
                  Create New Client
                </button>
              </div>
            )}

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Client</label>
                {defaultClient ? (
                  <div className="rounded-xl border border-secondary-dark bg-secondary/30 px-3 py-2">
                    <p className="font-medium text-gray-900">{defaultClient.full_name}</p>
                    {defaultClient.email && <p className="text-sm text-gray-500">{defaultClient.email}</p>}
                  </div>
                ) : clientMode === 'existing' ? (
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
                ) : (
                  <div className="space-y-4 rounded-2xl border border-secondary-dark bg-gray-50 p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setClientForm({ ...clientForm, client_type: 'individual' })
                          setForm(prev => ({ ...prev, return_type: 'individual', form_type: prev.form_type === '1120S' ? '1040' : prev.form_type, base_fee: prev.base_fee || '85.00' }))
                        }}
                        className={`rounded-xl px-3 py-2 font-semibold ${clientForm.client_type === 'individual' ? 'bg-primary text-white' : 'bg-white text-gray-600'}`}
                      >
                        Individual
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setClientForm({ ...clientForm, client_type: 'business' })
                          setForm(prev => ({ ...prev, return_type: 'business', form_type: prev.form_type === '1040' ? '1120S' : prev.form_type, base_fee: prev.base_fee === '85.00' ? '' : prev.base_fee }))
                        }}
                        className={`rounded-xl px-3 py-2 font-semibold ${clientForm.client_type === 'business' ? 'bg-primary text-white' : 'bg-white text-gray-600'}`}
                      >
                        Business
                      </button>
                    </div>
                    {clientForm.client_type === 'business' && (
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Business Name *</label>
                        <input value={clientForm.business_name} onChange={e => setClientForm({ ...clientForm, business_name: e.target.value })} className="w-full rounded-xl border border-secondary-dark px-3 py-2" />
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">{clientForm.client_type === 'business' ? 'Contact First Name' : 'First Name *'}</label>
                        <input value={clientForm.first_name} onChange={e => setClientForm({ ...clientForm, first_name: e.target.value })} className="w-full rounded-xl border border-secondary-dark px-3 py-2" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">{clientForm.client_type === 'business' ? 'Contact Last Name' : 'Last Name *'}</label>
                        <input value={clientForm.last_name} onChange={e => setClientForm({ ...clientForm, last_name: e.target.value })} className="w-full rounded-xl border border-secondary-dark px-3 py-2" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" value={clientForm.email} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} className="w-full rounded-xl border border-secondary-dark px-3 py-2" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                        <input value={clientForm.phone} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} className="w-full rounded-xl border border-secondary-dark px-3 py-2" />
                      </div>
                      {clientForm.client_type === 'individual' && (
                        <>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Date of Birth</label>
                            <input type="date" value={clientForm.date_of_birth} onChange={e => setClientForm({ ...clientForm, date_of_birth: e.target.value })} className="w-full rounded-xl border border-secondary-dark px-3 py-2" />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Filing Status</label>
                            <select value={clientForm.filing_status} onChange={e => setClientForm({ ...clientForm, filing_status: e.target.value })} className="w-full rounded-xl border border-secondary-dark px-3 py-2">
                              <option value="single">Single</option>
                              <option value="married_filing_jointly">Married Filing Jointly</option>
                              <option value="married_filing_separately">Married Filing Separately</option>
                              <option value="head_of_household">Head of Household</option>
                              <option value="qualifying_widow">Qualifying Widow(er)</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
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
                <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full rounded-xl border border-secondary-dark px-3 py-2">
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Workflow Status</label>
                <select
                  value={form.workflow_stage_id}
                  onChange={e => {
                    const nextStage = stages.find(stage => String(stage.id) === e.target.value)
                    const nextRequiresSignature = nextStage ? SIGNATURE_REQUEST_STAGE_SLUGS.includes(nextStage.slug) : false
                    setForm({
                      ...form,
                      workflow_stage_id: e.target.value,
                      signature_status: form.signature_status === 'requested' && !nextRequiresSignature ? 'not_needed' : form.signature_status,
                    })
                  }}
                  className="w-full rounded-xl border border-secondary-dark px-3 py-2"
                >
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
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Cornerstone Fee</h3>
                  <p className="text-sm text-gray-500">Base return plus schedules/add-ons, discounts, and payments.</p>
                </div>
                <div className="text-sm text-gray-600">
                  Total ${dollarsFromCents(finalFee)} • Balance ${dollarsFromCents(balanceDue)}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <input value={form.base_fee} onChange={e => setForm({ ...form, base_fee: e.target.value })} placeholder="Base 1040 fee" className="rounded-xl border border-secondary-dark px-3 py-2" inputMode="decimal" />
                <input value={form.discount_amount} onChange={e => setForm({ ...form, discount_amount: e.target.value })} placeholder="Discount" className="rounded-xl border border-secondary-dark px-3 py-2" inputMode="decimal" />
                <input value={form.amount_paid} onChange={e => setForm({ ...form, amount_paid: e.target.value })} placeholder="Amount paid" className="rounded-xl border border-secondary-dark px-3 py-2" inputMode="decimal" />
                <select value={form.payment_status} onChange={e => setForm({ ...form, payment_status: e.target.value })} className="rounded-xl border border-secondary-dark px-3 py-2">
                  {PAYMENT_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
                <input value={form.discount_reason} onChange={e => setForm({ ...form, discount_reason: e.target.value })} placeholder="Discount reason or approval note" className="md:col-span-4 rounded-xl border border-secondary-dark px-3 py-2" />
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">Fee Add-ons</h4>
                      <button type="button" onClick={() => setFeeLineItems(items => [...items, newFeeLineItem()])} className="shrink-0 text-sm font-medium text-primary hover:text-primary-dark">
                        Add schedule or service
                      </button>
                </div>
                {feeLineItems.length === 0 ? (
                  <p className="text-sm text-gray-500">No add-ons yet.</p>
                ) : (
                  feeLineItems.map(item => (
                    <div key={item.id} className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_auto]">
                      <input value={item.label} onChange={e => updateFeeItem(item.id, { label: e.target.value })} placeholder="Schedule C, rental, dividends..." className="min-w-0 rounded-xl border border-secondary-dark px-3 py-2" />
                      <input value={item.amount} onChange={e => updateFeeItem(item.id, { amount: e.target.value })} placeholder="Amount" className="min-w-0 rounded-xl border border-secondary-dark px-3 py-2" inputMode="decimal" />
                      <input value={item.notes} onChange={e => updateFeeItem(item.id, { notes: e.target.value })} placeholder="Optional note" className="min-w-0 rounded-xl border border-secondary-dark px-3 py-2 md:col-span-2 xl:col-span-1" />
                      <button type="button" onClick={() => setFeeLineItems(items => items.filter(existing => existing.id !== item.id))} className="justify-self-start rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 xl:justify-self-auto">
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-secondary-dark p-4">
              <div className="mb-3">
                <h3 className="font-semibold text-gray-900">Tax Refund or Amount Owed</h3>
                <p className="text-sm text-gray-500">Separate from Cornerstone's preparation fee.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <select value={form.tax_outcome_status} onChange={e => setForm({ ...form, tax_outcome_status: e.target.value })} className="rounded-xl border border-secondary-dark px-3 py-2">
                  {TAX_OUTCOMES.map(outcome => <option key={outcome.value} value={outcome.value}>{outcome.label}</option>)}
                </select>
                <input value={form.tax_outcome_amount} onChange={e => setForm({ ...form, tax_outcome_amount: e.target.value })} placeholder="Refund/owed amount" className="rounded-xl border border-secondary-dark px-3 py-2" inputMode="decimal" />
                <input value={form.tax_outcome_notes} onChange={e => setForm({ ...form, tax_outcome_notes: e.target.value })} placeholder="Cash/check note, filing instruction..." className="rounded-xl border border-secondary-dark px-3 py-2" />
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
                <select
                  value={form.signature_status === 'requested' && !signatureStageRequiresRequest ? 'not_needed' : form.signature_status}
                  onChange={e => setForm({ ...form, signature_status: e.target.value })}
                  className="w-full rounded-xl border border-secondary-dark px-3 py-2"
                >
                  {signatureStatusOptionsForStage(signatureStageRequiresRequest).map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </section>

            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Internal notes..." className="w-full rounded-xl border border-secondary-dark px-3 py-2" />

            <div className="flex justify-end gap-3 border-t border-secondary-dark pt-4">
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button type="submit" disabled={saving || !canSubmit} className="rounded-xl bg-primary px-5 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
                {saving ? 'Creating...' : clientMode === 'new' ? 'Create Client & Tax Return' : 'Create Tax Return'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
