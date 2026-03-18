import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type {
  ServiceType,
  ClientServiceType,
  OperationCycle,
  OperationTemplateTask,
  ClientOperationAssignment,
  CurrentUser,
} from '../../lib/api'
import { formatDate, formatDateTime } from '../../lib/dateUtils'
import { getFilingStatusLabel } from '../../lib/constants'
import NotFound from '../../components/common/NotFound'
import PrintableIntakeForm from '../../components/admin/PrintableIntakeForm'
import { FadeUp } from '../../components/ui/MotionComponents'

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

interface ClientContact {
  id: number
  first_name: string
  last_name: string
  full_name: string
  email: string | null
  phone: string | null
  role: string | null
  is_primary: boolean
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
  client_type: 'individual' | 'business'
  business_name: string | null
  is_service_only: boolean
  archived_at: string | null
  service_types: ClientServiceType[]
  contacts: ClientContact[]
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
  client_type: 'individual' | 'business'
  business_name: string
  is_service_only: boolean
  service_type_ids: number[]
}

interface AuditLogEntry {
  id: number
  action: string
  description: string
  changes_made: Record<string, { from: unknown; to: unknown }> | null
  created_at: string
  user: { id: number; email: string; name?: string } | null
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
  const [archiving, setArchiving] = useState(false)
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<EditFormData | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Tax return notes editing
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null)
  const [editingNotes, setEditingNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Service types for editing
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])

  // Load service types
  useEffect(() => {
    const loadServiceTypes = async () => {
      try {
        const result = await api.getServiceTypes()
        if (result.data) {
          setServiceTypes(result.data.service_types)
        }
      } catch (err) {
        console.error('Failed to load service types:', err)
      }
    }
    loadServiceTypes()
  }, [])

  const loadClient = useCallback(async () => {
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
      console.error('Failed to load client:', err)
      setError('Failed to load client')
    } finally {
      setLoading(false)
    }
  }, [id])

  // Audit logs for this client (CST-7)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])

  // Contacts
  const [showContactModal, setShowContactModal] = useState(false)
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null)
  const [contactSaving, setContactSaving] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  const [contactForm, setContactForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: '',
    is_primary: false,
  })

  // Payroll checklist
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [operationTemplates, setOperationTemplates] = useState<{ id: number; name: string; is_active: boolean }[]>([])
  const [operationAssignments, setOperationAssignments] = useState<ClientOperationAssignment[]>([])
  const [operationCycles, setOperationCycles] = useState<OperationCycle[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null)
  const [selectedCycle, setSelectedCycle] = useState<OperationCycle | null>(null)
  const [operationsLoading, setOperationsLoading] = useState(false)
  const [operationsError, setOperationsError] = useState<string | null>(null)
  const [generateForm, setGenerateForm] = useState({
    operation_template_id: '',
    period_start: '',
    period_end: '',
  })
  const [assignmentForm, setAssignmentForm] = useState({
    operation_template_id: '',
    auto_generate: true,
    assignment_status: 'active' as 'active' | 'paused',
  })
  const [generatingCycle, setGeneratingCycle] = useState(false)
  const [creatingAssignment, setCreatingAssignment] = useState(false)
  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(null)
  const [loadingAssignmentId, setLoadingAssignmentId] = useState<number | null>(null)
  const [savingAssignmentId, setSavingAssignmentId] = useState<number | null>(null)
  const [templateTasksByTemplateId, setTemplateTasksByTemplateId] = useState<Record<number, OperationTemplateTask[]>>({})
  const [assignmentExclusionDrafts, setAssignmentExclusionDrafts] = useState<Record<number, number[]>>({})

  const loadAuditLogs = useCallback(async () => {
    if (!id) return
    try {
      const result = await api.getAuditLogs({ client_id: parseInt(id), page: 1 })
      if (result.data) {
        setAuditLogs(result.data.audit_logs)
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    }
  }, [id])

  const loadOperations = useCallback(async () => {
    if (!id) return
    setOperationsLoading(true)
    setOperationsError(null)
    try {
      const clientId = parseInt(id)
      const [userResult, templatesResult, assignmentsResult, cyclesResult] = await Promise.all([
        api.getCurrentUser(),
        api.getOperationTemplates(true),
        api.getClientOperationAssignments(clientId),
        api.getClientOperationCycles(clientId),
      ])

      if (userResult.data) {
        setCurrentUser(userResult.data.user)
      }
      if (templatesResult.data) {
        setOperationTemplates(
          templatesResult.data.operation_templates.map(t => ({
            id: t.id,
            name: t.name,
            is_active: t.is_active,
          }))
        )
      }
      if (assignmentsResult.data) {
        setOperationAssignments(assignmentsResult.data.assignments)
      }
      if (cyclesResult.data) {
        const cycles = cyclesResult.data.operation_cycles
        setOperationCycles(cycles)
        if (cycles.length > 0) {
          const preferred = cycles.find(c => c.status === 'active') || cycles[0]
          setSelectedCycleId(preferred.id)
        } else {
          setSelectedCycleId(null)
          setSelectedCycle(null)
        }
      }

      const firstError =
        userResult.error || templatesResult.error || assignmentsResult.error || cyclesResult.error
      if (firstError) {
        setOperationsError(firstError)
      }
    } catch (err) {
      console.error('Failed to load operations data:', err)
      setOperationsError('Failed to load payroll checklist data')
    } finally {
      setOperationsLoading(false)
    }
  }, [id])

  useEffect(() => {
    setAssignmentExclusionDrafts(
      operationAssignments.reduce((acc, assignment) => {
        acc[assignment.id] = assignment.excluded_template_task_ids || []
        return acc
      }, {} as Record<number, number[]>)
    )
  }, [operationAssignments])

  const loadCycleDetail = useCallback(async (cycleId: number) => {
    const result = await api.getOperationCycle(cycleId)
    if (result.data) {
      const cycle = result.data.operation_cycle
      setSelectedCycle(cycle)
      setOperationsError(null)
    } else if (result.error) {
      setOperationsError(result.error)
    }
  }, [])

  const resetContactForm = () => {
    setContactForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      role: '',
      is_primary: false,
    })
  }

  const openAddContact = () => {
    if (!client) return
    setEditingContact(null)
    setContactError(null)
    setContactForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      role: '',
      is_primary: client.contacts.length === 0,
    })
    setShowContactModal(true)
  }

  const openEditContact = (contact: ClientContact) => {
    setEditingContact(contact)
    setContactError(null)
    setContactForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email || '',
      phone: contact.phone || '',
      role: contact.role || '',
      is_primary: contact.is_primary,
    })
    setShowContactModal(true)
  }

  const handleSaveContact = async () => {
    if (!client) return
    setContactSaving(true)
    setContactError(null)

    try {
      const payload = {
        first_name: contactForm.first_name.trim(),
        last_name: contactForm.last_name.trim(),
        email: contactForm.email.trim() || undefined,
        phone: contactForm.phone.trim() || undefined,
        role: contactForm.role.trim() || undefined,
        is_primary: contactForm.is_primary,
      }

      if (editingContact) {
        const result = await api.updateClientContact(client.id, editingContact.id, payload)
        if (result.error) {
          setContactError(result.error)
          return
        }
      } else {
        const result = await api.createClientContact(client.id, payload)
        if (result.error) {
          setContactError(result.error)
          return
        }
      }

      await loadClient()
      resetContactForm()
      setShowContactModal(false)
    } catch (err) {
      console.error('Failed to save contact:', err)
      setContactError('Failed to save contact')
    } finally {
      setContactSaving(false)
    }
  }

  const handleDeleteContact = async (contact: ClientContact) => {
    if (!client) return
    if (!confirm(`Delete ${contact.full_name}?`)) return

    try {
      const result = await api.deleteClientContact(client.id, contact.id)
      if (result?.error) {
        alert(result.error)
        return
      }
      await loadClient()
    } catch (err) {
      console.error('Failed to delete contact:', err)
      alert('Failed to delete contact')
    }
  }

  const handleCreateAssignment = async () => {
    if (!client || !assignmentForm.operation_template_id) return
    setCreatingAssignment(true)
    setOperationsError(null)
    try {
      const result = await api.createClientOperationAssignment(client.id, {
        operation_template_id: parseInt(assignmentForm.operation_template_id),
        auto_generate: assignmentForm.auto_generate,
        assignment_status: assignmentForm.assignment_status,
      })
      if (result.data) {
        await loadOperations()
        setAssignmentForm({
          operation_template_id: '',
          auto_generate: true,
          assignment_status: 'active',
        })
      } else if (result.error) {
        setOperationsError(result.error)
      }
    } catch (err) {
      console.error('Failed to create assignment:', err)
      setOperationsError('Failed to create assignment')
    } finally {
      setCreatingAssignment(false)
    }
  }

  const handleToggleAssignmentEditor = async (assignment: ClientOperationAssignment) => {
    if (editingAssignmentId === assignment.id) {
      setEditingAssignmentId(null)
      return
    }

    setEditingAssignmentId(assignment.id)
    const templateId = assignment.operation_template_id
    if (templateTasksByTemplateId[templateId]) return

    setLoadingAssignmentId(assignment.id)
    try {
      const result = await api.getOperationTemplateTasks(templateId, true)
      if (result.data) {
        setTemplateTasksByTemplateId(prev => ({ ...prev, [templateId]: result.data!.tasks }))
      } else if (result.error) {
        setOperationsError(result.error)
      }
    } catch (err) {
      console.error('Failed to load template tasks for assignment:', err)
      setOperationsError('Failed to load assignment checklist steps')
    } finally {
      setLoadingAssignmentId(null)
    }
  }

  const handleToggleAssignmentStep = (assignmentId: number, templateTaskId: number, enabled: boolean) => {
    setAssignmentExclusionDrafts(prev => {
      const current = prev[assignmentId] || []
      const nextExcludedIds = enabled
        ? current.filter(id => id !== templateTaskId)
        : Array.from(new Set([ ...current, templateTaskId ]))

      return {
        ...prev,
        [assignmentId]: nextExcludedIds,
      }
    })
  }

  const handleSaveAssignmentSteps = async (assignmentId: number) => {
    const excludedIds = assignmentExclusionDrafts[assignmentId] || []
    setSavingAssignmentId(assignmentId)
    setOperationsError(null)

    try {
      const result = await api.updateClientOperationAssignment(assignmentId, {
        excluded_template_task_ids: excludedIds,
      })

      if (result.data) {
        await loadOperations()
      } else if (result.error) {
        setOperationsError(result.error)
      }
    } catch (err) {
      console.error('Failed to save assignment checklist applicability:', err)
      setOperationsError('Failed to save checklist applicability')
    } finally {
      setSavingAssignmentId(null)
    }
  }

  const handleGenerateCycle = async () => {
    if (!client || !generateForm.operation_template_id || !generateForm.period_start || !generateForm.period_end) {
      setOperationsError('Template and period dates are required to generate a payroll period')
      return
    }

    setGeneratingCycle(true)
    setOperationsError(null)
    try {
      const result = await api.generateOperationCycle(client.id, {
        operation_template_id: parseInt(generateForm.operation_template_id),
        period_start: generateForm.period_start,
        period_end: generateForm.period_end,
      })
      if (result.data) {
        await loadOperations()
        setSelectedCycleId(result.data.operation_cycle.id)
      } else if (result.error) {
        setOperationsError(result.error)
      }
    } catch (err) {
      console.error('Failed to generate cycle:', err)
      setOperationsError('Failed to generate payroll period')
    } finally {
      setGeneratingCycle(false)
    }
  }

  useEffect(() => {
    loadClient()
    loadAuditLogs()
    loadOperations()
  }, [loadAuditLogs, loadClient, loadOperations])

  useEffect(() => {
    if (selectedCycleId) {
      loadCycleDetail(selectedCycleId)
    } else {
      setSelectedCycle(null)
    }
  }, [loadCycleDetail, selectedCycleId])

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
      console.error('Failed to save notes:', err)
      alert('Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  const handleArchiveToggle = async () => {
    if (!client) return
    const action = client.archived_at ? 'unarchive' : 'archive'
    const confirm = window.confirm(
      action === 'archive'
        ? `Archive ${client.full_name}? They will be hidden from the active client list.`
        : `Unarchive ${client.full_name}? They will reappear in the active client list.`
    )
    if (!confirm) return
    setArchiving(true)
    try {
      const result = action === 'archive'
        ? await api.archiveClient(client.id)
        : await api.unarchiveClient(client.id)
      if (result.data) {
        setClient(result.data.client as unknown as ClientDetail)
      }
    } finally {
      setArchiving(false)
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
      client_type: client.client_type || 'individual',
      business_name: client.business_name || '',
      is_service_only: client.is_service_only || false,
      service_type_ids: client.service_types?.map(st => st.id) || [],
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
      console.error('Failed to save client changes:', err)
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
      <NotFound 
        title="Client Not Found"
        message={error || 'This client does not exist or may have been removed.'}
        backTo="/admin/clients"
        backLabel="← Back to Clients"
      />
    )
  }

  const latestReturn = client.tax_returns[0]
  const activeCycle = operationCycles.find(c => c.status === 'active') || null
  const cycleTasks = selectedCycle?.tasks || []
  const unassignedTemplateOptions = operationTemplates.filter(
    template => template.is_active && !operationAssignments.some(a => a.operation_template_id === template.id)
  )

  return (
    <>
    <FadeUp>
    <div className="space-y-6">
      {/* Archived Banner */}
      {client.archived_at && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <p className="text-amber-800 text-sm font-medium">
              This client is archived. They won't appear in the active client list.
            </p>
          </div>
          <button
            onClick={handleArchiveToggle}
            disabled={archiving}
            className="text-amber-700 hover:text-amber-900 text-sm font-semibold underline disabled:opacity-50"
          >
            {archiving ? 'Restoring...' : 'Unarchive'}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link to="/admin/clients" className="text-gray-500 hover:text-gray-700 text-sm mb-2 inline-block">
            ← Back to Clients
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {client.client_type === 'business' && client.business_name 
                ? client.business_name 
                : client.full_name}
            </h1>
            {client.client_type === 'business' && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                Business
              </span>
            )}
            {client.is_service_only && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                Service Only
              </span>
            )}
          </div>
          <p className="text-gray-500">
            {client.client_type === 'business' && client.business_name && (
              <span className="mr-2">{client.full_name} •</span>
            )}
            {client.email}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start flex-wrap">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-secondary-dark rounded-xl text-gray-600 font-medium hover:bg-secondary transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Intake
          </button>
          <button
            onClick={openEditModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-secondary-dark rounded-xl text-primary-dark font-medium hover:bg-secondary transition-colors"
          >
            <EditIcon />
            Edit Client
          </button>
          <button
            onClick={handleArchiveToggle}
            disabled={archiving}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-xl font-medium transition-colors ${
              client.archived_at
                ? 'bg-white border-green-300 text-green-700 hover:bg-green-50'
                : 'bg-white border-red-200 text-red-600 hover:bg-red-50'
            } disabled:opacity-50`}
          >
            {client.archived_at ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {archiving ? 'Restoring...' : 'Unarchive'}
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                {archiving ? 'Archiving...' : 'Archive'}
              </>
            )}
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
          <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
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
                <dd className="font-medium">{getFilingStatusLabel(client.filing_status)}</dd>
              </div>
            </dl>
          </div>

          {/* Spouse Info */}
          {client.spouse_name && (
            <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
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
            <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
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
          <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
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

          {/* Payroll Checklist */}
          <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Payroll Checklist</h2>
                <p className="text-sm text-gray-500">Track payroll-period steps for this client in one place.</p>
              </div>
              {activeCycle && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 self-start">
                  Active Period: {activeCycle.cycle_label}
                </span>
              )}
            </div>

            {operationsError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {operationsError}
              </div>
            )}

            {operationsLoading ? (
              <div className="py-8 flex justify-center">
                <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Assignment Management */}
                {currentUser?.is_admin && (
                  <div className="p-4 border border-secondary-dark rounded-xl bg-secondary/20">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Checklist Setup</h3>
                    <div className="space-y-2 mb-3">
                      {operationAssignments.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No payroll checklist template assigned to this client yet.</p>
                      ) : (
                        operationAssignments.map(assignment => (
                          <div key={assignment.id} className="border border-secondary-dark rounded-lg p-3 bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-800">
                                  {assignment.operation_template_name || `Template #${assignment.operation_template_id}`}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  assignment.assignment_status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {assignment.assignment_status}
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                  {assignment.excluded_template_task_ids.length} disabled step{assignment.excluded_template_task_ids.length === 1 ? '' : 's'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleToggleAssignmentEditor(assignment)}
                                className="min-h-11 px-3 py-2 rounded-lg border border-secondary-dark text-xs font-medium text-primary hover:bg-secondary"
                              >
                                {editingAssignmentId === assignment.id ? 'Close Steps' : 'Edit Applicable Steps'}
                              </button>
                            </div>

                            {editingAssignmentId === assignment.id && (
                              <div className="mt-3 pt-3 border-t border-secondary-dark space-y-2">
                                <p className="text-xs text-gray-500">
                                  Turn steps on only if they apply to this client. Disabled steps are excluded from newly generated payroll periods.
                                </p>
                                {loadingAssignmentId === assignment.id ? (
                                  <div className="py-4 flex justify-center">
                                    <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                                  </div>
                                ) : (
                                  <>
                                    {(templateTasksByTemplateId[assignment.operation_template_id] || []).length === 0 ? (
                                      <p className="text-sm text-gray-500 italic">No steps found for this template.</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {(templateTasksByTemplateId[assignment.operation_template_id] || []).map(task => {
                                          const excludedIds = assignmentExclusionDrafts[assignment.id] || []
                                          const enabled = !excludedIds.includes(task.id)
                                          return (
                                            <label key={task.id} className="flex items-start gap-2 text-sm">
                                              <input
                                                type="checkbox"
                                                checked={enabled}
                                                onChange={(e) => handleToggleAssignmentStep(assignment.id, task.id, e.target.checked)}
                                                className="mt-1"
                                              />
                                              <span>
                                                {task.title}
                                                {!task.is_active && (
                                                  <span className="ml-2 text-xs text-amber-700">(inactive template step)</span>
                                                )}
                                              </span>
                                            </label>
                                          )
                                        })}
                                      </div>
                                    )}
                                    <div className="pt-1">
                                      <button
                                        type="button"
                                        onClick={() => handleSaveAssignmentSteps(assignment.id)}
                                        disabled={savingAssignmentId === assignment.id}
                                        className="min-h-11 px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-dark disabled:opacity-50"
                                      >
                                        {savingAssignmentId === assignment.id ? 'Saving...' : 'Save Step Setup'}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <select
                        value={assignmentForm.operation_template_id}
                        onChange={(e) => setAssignmentForm(prev => ({ ...prev, operation_template_id: e.target.value }))}
                        className="px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                      >
                        <option value="">Assign payroll checklist template...</option>
                        {unassignedTemplateOptions.map(template => (
                          <option key={template.id} value={template.id}>{template.name}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-sm px-3 py-2 border border-secondary-dark rounded-lg bg-white">
                        <input
                          type="checkbox"
                          checked={assignmentForm.auto_generate}
                          onChange={(e) => setAssignmentForm(prev => ({ ...prev, auto_generate: e.target.checked }))}
                        />
                        Auto-generate
                      </label>
                      <button
                        type="button"
                        onClick={handleCreateAssignment}
                        disabled={creatingAssignment || !assignmentForm.operation_template_id}
                        className="min-h-11 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                      >
                        {creatingAssignment ? 'Assigning...' : 'Assign Checklist'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Manual Generate */}
                {currentUser?.is_admin && (
                  <div className="p-4 border border-secondary-dark rounded-xl">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Generate Payroll Period</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <select
                        value={generateForm.operation_template_id}
                        onChange={(e) => setGenerateForm(prev => ({ ...prev, operation_template_id: e.target.value }))}
                        className="px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                      >
                        <option value="">Checklist template...</option>
                        {operationAssignments.filter(a => a.assignment_status === 'active').map(assignment => (
                          <option key={assignment.id} value={assignment.operation_template_id}>
                            {assignment.operation_template_name || `Template #${assignment.operation_template_id}`}
                          </option>
                        ))}
                        {operationAssignments.length === 0 &&
                          operationTemplates.filter(t => t.is_active).map(template => (
                            <option key={template.id} value={template.id}>{template.name}</option>
                          ))
                        }
                      </select>
                      <input
                        type="date"
                        value={generateForm.period_start}
                        onChange={(e) => setGenerateForm(prev => ({ ...prev, period_start: e.target.value }))}
                        className="px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                      />
                      <input
                        type="date"
                        value={generateForm.period_end}
                        onChange={(e) => setGenerateForm(prev => ({ ...prev, period_end: e.target.value }))}
                        className="px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateCycle}
                        disabled={generatingCycle || !generateForm.operation_template_id || !generateForm.period_start || !generateForm.period_end}
                        className="min-h-11 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                      >
                        {generatingCycle ? 'Generating...' : 'Generate'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Payroll Period History / Picker */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">Payroll Period History</h3>
                    <span className="text-xs text-gray-500">{operationCycles.length} period{operationCycles.length !== 1 ? 's' : ''}</span>
                  </div>
                  {operationCycles.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No payroll periods yet. Generate one to start tracking checklist steps.</p>
                  ) : (
                    <select
                      value={selectedCycleId || ''}
                      onChange={(e) => setSelectedCycleId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                    >
                      {operationCycles.map(cycle => (
                        <option key={cycle.id} value={cycle.id}>
                          {cycle.cycle_label} - {cycle.operation_template_name || `Template #${cycle.operation_template_id}`} ({cycle.status})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Checklist Steps Summary (daily checkoffs happen on Payroll Checklist Board) */}
                {selectedCycle && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900">Checklist Steps for {selectedCycle.cycle_label}</h3>
                    {cycleTasks.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No checklist steps generated for this payroll period.</p>
                    ) : (
                      <div className="border border-secondary-dark rounded-xl p-4 bg-white space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="rounded-lg bg-secondary px-3 py-2">
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="text-sm font-semibold text-gray-900">{cycleTasks.length}</p>
                          </div>
                          <div className="rounded-lg bg-emerald-50 px-3 py-2">
                            <p className="text-xs text-emerald-700">Done</p>
                            <p className="text-sm font-semibold text-emerald-800">{cycleTasks.filter(t => t.status === 'done').length}</p>
                          </div>
                          <div className="rounded-lg bg-amber-50 px-3 py-2">
                            <p className="text-xs text-amber-700">In Progress</p>
                            <p className="text-sm font-semibold text-amber-800">{cycleTasks.filter(t => t.status === 'in_progress').length}</p>
                          </div>
                          <div className="rounded-lg bg-red-50 px-3 py-2">
                            <p className="text-xs text-red-700">Blocked</p>
                            <p className="text-sm font-semibold text-red-800">{cycleTasks.filter(t => t.status === 'blocked').length}</p>
                          </div>
                        </div>

                        <p className="text-sm text-gray-600">
                          Use the Payroll Checklist Board for simple checkbox updates, notes, and proof on each step.
                        </p>
                        <Link
                          to="/admin/operations"
                          className="min-h-11 inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark"
                        >
                          Open Payroll Checklist Board
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
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

          {/* Services */}
          <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Services</h2>
              <button
                onClick={openEditModal}
                className="text-xs text-primary hover:text-primary-dark font-medium"
              >
                Edit
              </button>
            </div>
            {client.service_types && client.service_types.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {client.service_types.map(st => (
                  <span
                    key={st.id}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: st.color || '#8B7355' }}
                  >
                    {st.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm italic">No services assigned</p>
            )}
          </div>

          {/* Contacts */}
          <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
              <button
                onClick={openAddContact}
                className="text-xs text-primary hover:text-primary-dark font-medium"
              >
                Add
              </button>
            </div>
            {client.contacts && client.contacts.length > 0 ? (
              <div className="space-y-3">
                {client.contacts.map(contact => (
                  <div key={contact.id} className="p-3 border border-secondary-dark rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{contact.full_name}</p>
                          {contact.is_primary && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">
                              Primary
                            </span>
                          )}
                        </div>
                        {contact.role && (
                          <p className="text-xs text-gray-500 mt-0.5">{contact.role}</p>
                        )}
                        {contact.email && (
                          <p className="text-xs text-gray-600 mt-1">{contact.email}</p>
                        )}
                        {contact.phone && (
                          <p className="text-xs text-gray-600">{contact.phone}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditContact(contact)}
                          className="text-xs text-primary hover:text-primary-dark font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm italic">No contacts added</p>
            )}
          </div>

          {/* Activity (CST-7: includes workflow events + client audit logs) */}
          {(latestReturn?.workflow_events?.length > 0 || auditLogs.length > 0) && (
            <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {/* Merge and sort workflow events + audit logs by date */}
                {[
                  ...(latestReturn?.workflow_events || []).map(e => ({
                    id: `wf-${e.id}`,
                    text: e.description || e.event_type,
                    actor: e.actor,
                    date: e.created_at,
                  })),
                  ...auditLogs.map(log => ({
                    id: `al-${log.id}`,
                    text: log.description,
                    actor: log.user?.name || log.user?.email || 'System',
                    date: log.created_at,
                  })),
                ]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 8)
                  .map((item) => (
                    <div key={item.id} className="border-l-2 border-gray-200 pl-4">
                      <p className="text-sm font-medium text-gray-900">
                        {item.text}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.actor} • {formatDateTime(item.date)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Changes from Prior Year */}
          {client.changes_from_prior_year && (
            <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
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

      {/* Contact Modal */}
      {showContactModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowContactModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-secondary-dark">
              <h2 className="text-xl font-bold text-primary-dark">
                {editingContact ? 'Edit Contact' : 'Add Contact'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">Manage client contact information</p>
            </div>
            <div className="p-6 space-y-4">
              {contactError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {contactError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={contactForm.first_name}
                    onChange={(e) => setContactForm(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={contactForm.last_name}
                    onChange={(e) => setContactForm(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <input
                  type="text"
                  value={contactForm.role}
                  onChange={(e) => setContactForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Owner, HR, Bookkeeper, etc."
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={contactForm.is_primary}
                  onChange={(e) => setContactForm(prev => ({ ...prev, is_primary: e.target.checked }))}
                  disabled={client?.client_type === 'business' && client.contacts.length === 1 && editingContact?.is_primary}
                />
                Primary contact
              </label>
            </div>
            <div className="p-6 border-t border-secondary-dark flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveContact}
                disabled={contactSaving || !contactForm.first_name.trim() || !contactForm.last_name.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {contactSaving ? 'Saving...' : 'Save Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

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

              {/* Client Type & Services */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Client Type & Services</h3>
                <div className="space-y-4">
                  {/* Client Type Toggle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Client Type</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, client_type: 'individual' })}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          editForm.client_type === 'individual'
                            ? 'bg-primary text-white'
                            : 'bg-secondary text-gray-700 hover:bg-secondary-dark'
                        }`}
                      >
                        Individual
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, client_type: 'business' })}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          editForm.client_type === 'business'
                            ? 'bg-primary text-white'
                            : 'bg-secondary text-gray-700 hover:bg-secondary-dark'
                        }`}
                      >
                        Business
                      </button>
                    </div>
                  </div>

                  {/* Business Name */}
                  {editForm.client_type === 'business' && (
                    <div>
                      <label htmlFor="client-business-name" className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                      <input
                        id="client-business-name"
                        type="text"
                        value={editForm.business_name}
                        onChange={e => setEditForm({ ...editForm, business_name: e.target.value })}
                        className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  )}

                  {/* Service-Only Toggle */}
                  <label className="flex items-start gap-3 p-3 border border-secondary-dark rounded-lg cursor-pointer hover:bg-secondary/50">
                    <input
                      type="checkbox"
                      checked={editForm.is_service_only}
                      onChange={e => setEditForm({ ...editForm, is_service_only: e.target.checked })}
                      className="mt-0.5 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Service Client Only</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        This client receives ongoing services without a tax return.
                      </p>
                    </div>
                  </label>

                  {/* Service Types */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Services</label>
                    <div className="grid grid-cols-2 gap-2">
                      {serviceTypes.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            const current = editForm.service_type_ids
                            if (current.includes(st.id)) {
                              setEditForm({ ...editForm, service_type_ids: current.filter(id => id !== st.id) })
                            } else {
                              setEditForm({ ...editForm, service_type_ids: [...current, st.id] })
                            }
                          }}
                          className={`px-3 py-2 min-h-11 rounded-lg text-sm text-left transition-all ${
                            editForm.service_type_ids.includes(st.id)
                              ? 'bg-primary text-white'
                              : 'bg-secondary text-gray-700 hover:bg-secondary-dark'
                          }`}
                        >
                          {st.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Basic Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Basic Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="client-first-name" className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      id="client-first-name"
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
                      id="client-last-name"
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
                      id="client-email"
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
                      id="client-phone"
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
                      id="client-dob"
                      type="date"
                      value={editForm.date_of_birth}
                      onChange={e => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                      className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="client-filing-status" className="block text-sm font-medium text-gray-700 mb-1">Filing Status</label>
                    <select
                      id="client-filing-status"
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
                      id="client-address"
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
                      id="client-spouse-name"
                      type="text"
                      value={editForm.spouse_name}
                      onChange={e => setEditForm({ ...editForm, spouse_name: e.target.value })}
                      className="w-full px-3 py-2 border border-secondary-dark rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="client-spouse-dob" className="block text-sm font-medium text-gray-700 mb-1">Spouse DOB</label>
                    <input
                      id="client-spouse-dob"
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
                        id="client-year-denied"
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
                    id="client-changes"
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
    </FadeUp>

    {/* Hidden print view — rendered outside #root via portal so print CSS can hide #root */}
    {createPortal(
      <PrintableIntakeForm client={client} />,
      document.body
    )}
    </>
  )
}
