import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type {
  ServiceType,
  ClientServiceType,
  UserSummary,
  OperationCycle,
  OperationTaskItem,
  ClientOperationAssignment,
  CurrentUser,
  OperationTemplate,
} from '../../lib/api'
import { formatDate, formatDateTime } from '../../lib/dateUtils'
import { getFilingStatusLabel } from '../../lib/constants'
import NotFound from '../../components/common/NotFound'
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
  is_archived?: boolean
  archived_at?: string | null
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

interface ChecklistTaskDraft {
  id: string
  title: string
  description: string
  evidence_required: boolean
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

  // Operations checklist
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [staffUsers, setStaffUsers] = useState<UserSummary[]>([])
  const [operationTemplates, setOperationTemplates] = useState<OperationTemplate[]>([])
  const [operationAssignments, setOperationAssignments] = useState<ClientOperationAssignment[]>([])
  const [operationCycles, setOperationCycles] = useState<OperationCycle[]>([])
  const [historicalClientTasks, setHistoricalClientTasks] = useState<OperationTaskItem[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null)
  const [selectedCycle, setSelectedCycle] = useState<OperationCycle | null>(null)
  const [operationsLoading, setOperationsLoading] = useState(false)
  const [operationsError, setOperationsError] = useState<string | null>(null)
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null)
  const [taskViewFilter, setTaskViewFilter] = useState<'all' | 'open' | 'done' | 'mine' | 'needs_evidence'>('open')
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<number, boolean>>({})
  const [checklistDetailsExpanded, setChecklistDetailsExpanded] = useState(false)
  const [taskDrafts, setTaskDrafts] = useState<Record<number, {
    status: OperationTaskItem['status']
    assigned_to_id: string
    notes: string
    evidence_note: string
  }>>({})
  const [generateForm, setGenerateForm] = useState({
    assignment_id: '',
    period_start: '',
    period_end: '',
  })
  const [generatingCycle, setGeneratingCycle] = useState(false)
  const [updatingAssignmentId, setUpdatingAssignmentId] = useState<number | null>(null)
  const [archivingClient, setArchivingClient] = useState(false)
  const [archivingCycleId, setArchivingCycleId] = useState<number | null>(null)
  const [showChecklistSetupModal, setShowChecklistSetupModal] = useState(false)
  const [creatingChecklistSetup, setCreatingChecklistSetup] = useState(false)
  const [checklistSetupError, setChecklistSetupError] = useState<string | null>(null)
  const checklistDetailsRef = useRef<HTMLDivElement | null>(null)
  const [showScheduleEditModal, setShowScheduleEditModal] = useState(false)
  const [editingScheduleAssignment, setEditingScheduleAssignment] = useState<ClientOperationAssignment | null>(null)
  const [scheduleEditError, setScheduleEditError] = useState<string | null>(null)
  const [savingScheduleEdit, setSavingScheduleEdit] = useState(false)
  const [scheduleEditForm, setScheduleEditForm] = useState({
    cadence_type: 'biweekly' as ClientOperationAssignment['cadence_type'],
    cadence_interval: '',
    cadence_anchor: '',
  })
  const [checklistSetup, setChecklistSetup] = useState({
    mode: 'existing' as 'existing' | 'new',
    existing_template_id: '',
    new_template_name: '',
    new_template_description: '',
    category: 'payroll' as 'payroll' | 'bookkeeping' | 'compliance' | 'general' | 'custom',
    clone_from_template_id: '',
    cadence_type: 'biweekly' as 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'custom',
    cadence_interval: '',
    cadence_anchor: '',
  })
  const [checklistTaskDrafts, setChecklistTaskDrafts] = useState<ChecklistTaskDraft[]>([
    { id: crypto.randomUUID(), title: '', description: '', evidence_required: false },
  ])

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
      const [userResult, usersResult, templatesResult, assignmentsResult, cyclesResult, tasksResult] = await Promise.all([
        api.getCurrentUser(),
        api.getUsers(),
        api.getOperationTemplates(true),
        api.getClientOperationAssignments(clientId),
        api.getClientOperationCycles(clientId),
        api.getOperationTasks({ client_id: clientId, include_done: true, include_archived_runs: true, limit: 1000 }),
      ])

      if (userResult.data) {
        setCurrentUser(userResult.data.user)
      }
      if (usersResult.data) {
        setStaffUsers(usersResult.data.users.filter(u => u.role === 'admin' || u.role === 'employee'))
      }
      if (templatesResult.data) {
        setOperationTemplates(templatesResult.data.operation_templates)
      }
      if (assignmentsResult.data) {
        setOperationAssignments(assignmentsResult.data.assignments)
      }
      if (cyclesResult.data) {
        const cycles = cyclesResult.data.operation_cycles
        setOperationCycles(cycles)
        if (cycles.length > 0) {
          const stillSelected = selectedCycleId ? cycles.find(c => c.id === selectedCycleId) : null
          if (stillSelected) {
            setSelectedCycleId(stillSelected.id)
          } else {
            const preferred = cycles.find(c => c.status === 'active') || cycles[0]
            setSelectedCycleId(preferred.id)
          }
        } else {
          setSelectedCycleId(null)
          setSelectedCycle(null)
        }
      }
      if (tasksResult.data) {
        setHistoricalClientTasks(tasksResult.data.operation_tasks)
      }

      const firstError =
        userResult.error || usersResult.error || templatesResult.error || assignmentsResult.error || cyclesResult.error || tasksResult.error
      if (firstError) {
        setOperationsError(firstError)
      }
    } catch (err) {
      console.error('Failed to load operations data:', err)
      setOperationsError('Failed to load operations checklist data')
    } finally {
      setOperationsLoading(false)
    }
  }, [id, selectedCycleId])

  const loadCycleDetail = useCallback(async (cycleId: number) => {
    const result = await api.getOperationCycle(cycleId)
    if (result.data) {
      const cycle = result.data.operation_cycle
      setSelectedCycle(cycle)
      setTaskDrafts(
        (cycle.tasks || []).reduce((acc, task) => {
          acc[task.id] = {
            status: task.status,
            assigned_to_id: task.assigned_to?.id ? String(task.assigned_to.id) : '',
            notes: task.notes || '',
            evidence_note: task.evidence_note || '',
          }
          return acc
        }, {} as Record<number, { status: OperationTaskItem['status']; assigned_to_id: string; notes: string; evidence_note: string }>)
      )
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
    if (!client) return false
    if (!confirm(`Delete ${contact.full_name}?`)) return false

    try {
      const result = await api.deleteClientContact(client.id, contact.id)
      if (result?.error) {
        alert(result.error)
        return false
      }
      await loadClient()
      return true
    } catch (err) {
      console.error('Failed to delete contact:', err)
      alert('Failed to delete contact')
      return false
    }
  }

  const handleGenerateCycle = async () => {
    if (!client || !generateForm.assignment_id || !generateForm.period_start || !generateForm.period_end) {
      setOperationsError('Recurring checklist and period dates are required to create a manual run')
      return
    }

    setGeneratingCycle(true)
    setOperationsError(null)
    try {
      const result = await api.generateOperationCycle(client.id, {
        client_operation_assignment_id: parseInt(generateForm.assignment_id),
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
      setOperationsError('Failed to generate cycle')
    } finally {
      setGeneratingCycle(false)
    }
  }

  const handleTogglePlanStatus = async (assignment: ClientOperationAssignment) => {
    setUpdatingAssignmentId(assignment.id)
    setOperationsError(null)
    try {
      const result = await api.updateClientOperationAssignment(assignment.id, {
        assignment_status: assignment.assignment_status === 'active' ? 'paused' : 'active',
      })
      if (result.data) {
        await loadOperations()
      } else if (result.error) {
        setOperationsError(result.error)
      }
    } catch (err) {
      console.error('Failed to update recurring checklist status:', err)
      setOperationsError('Failed to update recurring checklist status')
    } finally {
      setUpdatingAssignmentId(null)
    }
  }

  const handleArchiveRunToggle = async (cycle: OperationCycle) => {
    const archiving = cycle.status !== 'archived'
    const confirmed = confirm(
      archiving
        ? 'Archive this checklist run? It will remain in history but tasks become read-only and hidden from team task lists.'
        : 'Unarchive this checklist run? It will return to active checklist task lists.'
    )
    if (!confirmed) return

    setArchivingCycleId(cycle.id)
    setOperationsError(null)
    try {
      const result = archiving
        ? await api.archiveOperationCycle(cycle.id)
        : await api.unarchiveOperationCycle(cycle.id)

      if (result.data) {
        await loadOperations()
        setSelectedCycleId(cycle.id)
      } else if (result.error) {
        setOperationsError(result.error)
      }
    } catch (err) {
      console.error('Failed to update run archive status:', err)
      setOperationsError('Failed to update run archive status')
    } finally {
      setArchivingCycleId(null)
    }
  }

  const handleArchiveToggle = async () => {
    if (!client) return
    const archiving = !client.is_archived
    const confirmed = confirm(
      archiving
        ? 'Archive this client? This will pause recurring checklists and hide checklist tasks from team boards.'
        : 'Unarchive this client? Recurring checklists will stay paused until manually resumed.'
    )
    if (!confirmed) return

    setArchivingClient(true)
    setOperationsError(null)
    try {
      const result = archiving ? await api.archiveClient(client.id) : await api.unarchiveClient(client.id)
      if (result.data) {
        setClient(result.data.client as ClientDetail)
        await loadOperations()
      } else if (result.error) {
        setOperationsError(result.error)
      }
    } catch (err) {
      console.error('Failed to update archive status:', err)
      setOperationsError('Failed to update archive status')
    } finally {
      setArchivingClient(false)
    }
  }

  const openChecklistSetupModal = () => {
    const firstTemplate = operationTemplates.find(t => t.is_active)
    setChecklistSetupError(null)
    setChecklistSetup({
      mode: firstTemplate ? 'existing' : 'new',
      existing_template_id: firstTemplate ? String(firstTemplate.id) : '',
      new_template_name: '',
      new_template_description: '',
      category: 'payroll',
      clone_from_template_id: firstTemplate ? String(firstTemplate.id) : '',
      cadence_type: 'biweekly',
      cadence_interval: '',
      cadence_anchor: '',
    })
    setChecklistTaskDrafts([{ id: crypto.randomUUID(), title: '', description: '', evidence_required: false }])
    setShowChecklistSetupModal(true)
  }

  const openScheduleEditModal = (assignment: ClientOperationAssignment) => {
    setScheduleEditError(null)
    setEditingScheduleAssignment(assignment)
    setScheduleEditForm({
      cadence_type: assignment.cadence_type,
      cadence_interval: assignment.cadence_interval ? String(assignment.cadence_interval) : '',
      cadence_anchor: assignment.cadence_anchor ? assignment.cadence_anchor.slice(0, 10) : '',
    })
    setShowScheduleEditModal(true)
  }

  const handleSaveScheduleEdit = async () => {
    if (!editingScheduleAssignment) return

    setSavingScheduleEdit(true)
    setScheduleEditError(null)
    try {
      const cadenceInterval =
        scheduleEditForm.cadence_type === 'custom' && scheduleEditForm.cadence_interval
          ? parseInt(scheduleEditForm.cadence_interval)
          : null

      const result = await api.updateClientOperationAssignment(editingScheduleAssignment.id, {
        cadence_type: scheduleEditForm.cadence_type,
        cadence_interval: cadenceInterval,
        cadence_anchor: scheduleEditForm.cadence_anchor || null,
      })

      if (result.error) {
        setScheduleEditError(result.error)
        return
      }

      setShowScheduleEditModal(false)
      setEditingScheduleAssignment(null)
      await loadOperations()
    } catch (err) {
      console.error('Failed to update recurring checklist schedule:', err)
      setScheduleEditError('Failed to update recurring checklist schedule')
    } finally {
      setSavingScheduleEdit(false)
    }
  }

  const buildTaskDraftsFromTemplate = useCallback((templateId: number) => {
    const template = operationTemplates.find(t => t.id === templateId)
    if (!template) return
    const activeTemplateTasks = (template.tasks || [])
      .filter(task => task.is_active)
      .sort((a, b) => a.position - b.position)
      .map(task => ({
        id: crypto.randomUUID(),
        title: task.title,
        description: task.description || '',
        evidence_required: task.evidence_required,
      }))

    setChecklistTaskDrafts(
      activeTemplateTasks.length > 0
        ? activeTemplateTasks
        : [{ id: crypto.randomUUID(), title: '', description: '', evidence_required: false }]
    )
  }, [operationTemplates])

  const handleCreateChecklistSetup = async () => {
    if (!client) return
    setCreatingChecklistSetup(true)
    setChecklistSetupError(null)
    setOperationsError(null)

    try {
      let templateId: number | null = null
      const cadenceInterval =
        checklistSetup.cadence_type === 'custom' && checklistSetup.cadence_interval
          ? parseInt(checklistSetup.cadence_interval)
          : null

      if (checklistSetup.mode === 'existing') {
        if (!checklistSetup.existing_template_id) {
          setChecklistSetupError('Pick a checklist template')
          return
        }
        templateId = parseInt(checklistSetup.existing_template_id)
      } else {
        if (!checklistSetup.new_template_name.trim()) {
          setChecklistSetupError('Checklist template name is required')
          return
        }

        const createTemplate = await api.createOperationTemplate({
          name: checklistSetup.new_template_name.trim(),
          description: checklistSetup.new_template_description.trim() || undefined,
          category: checklistSetup.category,
          recurrence_type: 'monthly',
          auto_generate: true,
          is_active: true,
        })
        if (createTemplate.error || !createTemplate.data) {
          setChecklistSetupError(createTemplate.error || 'Failed to create template')
          return
        }
        templateId = createTemplate.data.operation_template.id

        const tasksToCreate = checklistTaskDrafts
          .map((task, index) => ({
            title: task.title.trim(),
            description: task.description.trim() || undefined,
            position: index + 1,
            evidence_required: task.evidence_required,
          }))
          .filter(task => task.title.length > 0)

        if (tasksToCreate.length === 0) {
          setChecklistSetupError('Add at least one checklist task')
          return
        }

        for (const taskPayload of tasksToCreate) {
          const createTask = await api.createOperationTemplateTask(templateId, taskPayload)
          if (createTask.error) {
            setChecklistSetupError(createTask.error)
            return
          }
        }
      }

      if (!templateId) {
        setChecklistSetupError('Template selection is required')
        return
      }

      const assignment = await api.createClientOperationAssignment(client.id, {
        operation_template_id: templateId,
        cadence_type: checklistSetup.cadence_type,
        cadence_interval: cadenceInterval,
        cadence_anchor: checklistSetup.cadence_anchor || undefined,
        auto_generate: false,
        assignment_status: 'active',
      })

      if (assignment.error || !assignment.data) {
        setChecklistSetupError(assignment.error || 'Failed to create recurring plan')
        return
      }

      const firstRunPeriod = derivePeriodFromPlan(assignment.data.assignment)
      const runResult = await api.generateOperationCycle(client.id, {
        client_operation_assignment_id: assignment.data.assignment.id,
        period_start: firstRunPeriod.period_start,
        period_end: firstRunPeriod.period_end,
      })
      if (runResult.error) {
        setChecklistSetupError(runResult.error)
        return
      }

      setShowChecklistSetupModal(false)
      await loadOperations()
    } catch (err) {
      console.error('Failed to create recurring checklist setup:', err)
      setChecklistSetupError('Failed to create recurring checklist setup')
    } finally {
      setCreatingChecklistSetup(false)
    }
  }

  const toDateInputValue = useCallback((date: Date) => date.toISOString().slice(0, 10), [])

  const derivePeriodFromPlan = useCallback((assignment: ClientOperationAssignment) => {
    const today = new Date()
    const normalizeToStartOfDay = (date: Date) => {
      const normalized = new Date(date)
      normalized.setHours(0, 0, 0, 0)
      return normalized
    }
    const todayDate = normalizeToStartOfDay(today)
    const cadence = assignment.cadence_type
    if (cadence === 'weekly') {
      const start = new Date(today)
      start.setDate(today.getDate() - today.getDay())
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return { period_start: toDateInputValue(start), period_end: toDateInputValue(end) }
    }
    if (cadence === 'biweekly') {
      const anchor = assignment.cadence_anchor ? normalizeToStartOfDay(new Date(assignment.cadence_anchor)) : todayDate
      if (todayDate < anchor) {
        const start = new Date(anchor)
        const end = new Date(start)
        end.setDate(start.getDate() + 13)
        return { period_start: toDateInputValue(start), period_end: toDateInputValue(end) }
      }

      const daysSinceAnchor = Math.floor((todayDate.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24))
      const offset = ((daysSinceAnchor % 14) + 14) % 14
      const start = new Date(todayDate)
      start.setDate(todayDate.getDate() - offset)
      const end = new Date(start)
      end.setDate(start.getDate() + 13)
      return { period_start: toDateInputValue(start), period_end: toDateInputValue(end) }
    }
    if (cadence === 'monthly') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return { period_start: toDateInputValue(start), period_end: toDateInputValue(end) }
    }
    if (cadence === 'quarterly') {
      const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3
      const start = new Date(today.getFullYear(), quarterStartMonth, 1)
      const end = new Date(today.getFullYear(), quarterStartMonth + 3, 0)
      return { period_start: toDateInputValue(start), period_end: toDateInputValue(end) }
    }
    const intervalDays = assignment.cadence_interval && assignment.cadence_interval > 0 ? assignment.cadence_interval : 30
    const anchor = assignment.cadence_anchor ? normalizeToStartOfDay(new Date(assignment.cadence_anchor)) : todayDate
    if (todayDate < anchor) {
      const start = new Date(anchor)
      const end = new Date(start)
      end.setDate(start.getDate() + intervalDays - 1)
      return { period_start: toDateInputValue(start), period_end: toDateInputValue(end) }
    }

    const daysSinceAnchor = Math.floor((todayDate.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24))
    const offset = ((daysSinceAnchor % intervalDays) + intervalDays) % intervalDays
    const start = new Date(todayDate)
    start.setDate(todayDate.getDate() - offset)
    const end = new Date(start)
    end.setDate(start.getDate() + intervalDays - 1)
    return { period_start: toDateInputValue(start), period_end: toDateInputValue(end) }
  }, [toDateInputValue])

  const handleTaskDraftChange = (taskId: number, patch: Partial<{
    status: OperationTaskItem['status']
    assigned_to_id: string
    notes: string
    evidence_note: string
  }>) => {
    setTaskDrafts(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        ...patch,
      },
    }))
  }

  const handleSaveTask = async (taskId: number) => {
    const draft = taskDrafts[taskId]
    if (!draft) return
    setSavingTaskId(taskId)
    setOperationsError(null)
    try {
      const result = await api.updateOperationTask(taskId, {
        status: draft.status,
        assigned_to_id: draft.assigned_to_id ? parseInt(draft.assigned_to_id) : null,
        notes: draft.notes,
        evidence_note: draft.evidence_note,
      })
      if (result.data && selectedCycleId) {
        await loadCycleDetail(selectedCycleId)
      } else if (result.error) {
        setOperationsError(result.error)
      }
    } catch (err) {
      console.error('Failed to update task:', err)
      setOperationsError('Failed to update task')
    } finally {
      setSavingTaskId(null)
    }
  }

  const handleCompleteTask = async (taskId: number) => {
    const draft = taskDrafts[taskId]
    const evidence = draft?.evidence_note?.trim() || undefined
    setSavingTaskId(taskId)
    setOperationsError(null)
    try {
      const result = await api.completeOperationTask(taskId, evidence)
      if (result.data && selectedCycleId) {
        await loadCycleDetail(selectedCycleId)
      } else if (result.error) {
        setOperationsError(result.error)
      }
    } catch (err) {
      console.error('Failed to complete task:', err)
      setOperationsError('Failed to complete task')
    } finally {
      setSavingTaskId(null)
    }
  }

  const handleReopenTask = async (taskId: number) => {
    setSavingTaskId(taskId)
    setOperationsError(null)
    try {
      const result = await api.reopenOperationTask(taskId)
      if (result.data && selectedCycleId) {
        await loadCycleDetail(selectedCycleId)
      } else if (result.error) {
        setOperationsError(result.error)
      }
    } catch (err) {
      console.error('Failed to reopen task:', err)
      setOperationsError('Failed to reopen task')
    } finally {
      setSavingTaskId(null)
    }
  }

  const toggleTaskExpanded = (taskId: number) => {
    setExpandedTaskIds(prev => ({
      ...prev,
      [taskId]: !prev[taskId],
    }))
  }

  const setExpandedForTaskIds = (taskIds: number[], expanded: boolean) => {
    setExpandedTaskIds(prev => {
      const next = { ...prev }
      taskIds.forEach(taskId => {
        next[taskId] = expanded
      })
      return next
    })
  }

  const openRunForEditing = (cycleId: number) => {
    setSelectedCycleId(cycleId)
    setChecklistDetailsExpanded(true)
    requestAnimationFrame(() => {
      checklistDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
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

  useEffect(() => {
    setExpandedTaskIds({})
    setTaskViewFilter('open')
    setChecklistDetailsExpanded(false)
  }, [selectedCycleId])

  useEffect(() => {
    if (checklistSetup.mode !== 'new' || !checklistSetup.clone_from_template_id) return
    buildTaskDraftsFromTemplate(parseInt(checklistSetup.clone_from_template_id))
  }, [buildTaskDraftsFromTemplate, checklistSetup.clone_from_template_id, checklistSetup.mode])

  useEffect(() => {
    if (!generateForm.assignment_id) return
    const selectedAssignment = operationAssignments.find(a => a.id === parseInt(generateForm.assignment_id))
    if (!selectedAssignment) return
    const derived = derivePeriodFromPlan(selectedAssignment)
    setGenerateForm(prev => ({
      ...prev,
      period_start: prev.period_start || derived.period_start,
      period_end: prev.period_end || derived.period_end,
    }))
  }, [derivePeriodFromPlan, generateForm.assignment_id, operationAssignments])

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
      if (editForm.client_type === 'business') {
        dataToSend.is_service_only = true
        dataToSend.date_of_birth = ''
        dataToSend.filing_status = ''
        dataToSend.spouse_name = ''
        dataToSend.spouse_dob = ''
        dataToSend.has_prior_year_return = false
        dataToSend.changes_from_prior_year = ''
        dataToSend.denied_eic_actc = false
        dataToSend.denied_eic_actc_year = null
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
  const selectedCycleArchived = selectedCycle?.status === 'archived'
  const activeTemplates = operationTemplates.filter(template => template.is_active)
  const activePlans = operationAssignments.filter(a => a.assignment_status === 'active')
  const selectedCycleAssignment = selectedCycle?.client_operation_assignment_id
    ? operationAssignments.find(assignment => assignment.id === selectedCycle.client_operation_assignment_id) || null
    : null
  const previousRuns = operationCycles.filter(cycle => !activeCycle || cycle.id !== activeCycle.id)
  const matrixCycles = operationCycles.slice(0, 8)
  const matrixCycleIds = new Set(matrixCycles.map(cycle => cycle.id))
  const matrixTasks = historicalClientTasks.filter(task => matrixCycleIds.has(task.operation_cycle_id))
  const taskMatrixRows = Object.values(
    matrixTasks.reduce((acc, task) => {
      const rowKey = `${task.operation_template_task_id}-${task.title}`
      if (!acc[rowKey]) {
        acc[rowKey] = {
          rowKey,
          taskTitle: task.title,
          taskPosition: task.position,
          byCycle: {} as Record<number, OperationTaskItem>,
        }
      }
      acc[rowKey].byCycle[task.operation_cycle_id] = task
      if (task.position < acc[rowKey].taskPosition) acc[rowKey].taskPosition = task.position
      return acc
    }, {} as Record<string, { rowKey: string; taskTitle: string; taskPosition: number; byCycle: Record<number, OperationTaskItem> }>)
  ).sort((a, b) => a.taskPosition - b.taskPosition || a.taskTitle.localeCompare(b.taskTitle))
  const doneCount = cycleTasks.filter(task => task.status === 'done').length
  const inProgressCount = cycleTasks.filter(task => task.status === 'in_progress').length
  const blockedCount = cycleTasks.filter(task => task.status === 'blocked').length
  const overdueCount = cycleTasks.filter(task =>
    task.status !== 'done' && !!task.due_at && new Date(task.due_at).getTime() < Date.now()
  ).length
  const myOpenCount = cycleTasks.filter(task =>
    task.status !== 'done' && !!currentUser && task.assigned_to?.id === currentUser.id
  ).length
  const latestTaskUpdate = cycleTasks
    .map(task => task.updated_at)
    .filter(Boolean)
    .map(value => new Date(value))
    .filter(value => !Number.isNaN(value.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0] || null

  const filteredCycleTasks = cycleTasks.filter(task => {
    if (taskViewFilter === 'all') return true
    if (taskViewFilter === 'open') return task.status !== 'done'
    if (taskViewFilter === 'done') return task.status === 'done'
    if (taskViewFilter === 'mine') return !!currentUser && task.assigned_to?.id === currentUser.id
    return task.evidence_required && task.status !== 'done'
  })
  const allFilteredExpanded = filteredCycleTasks.length > 0 && filteredCycleTasks.every(task => expandedTaskIds[task.id])
  const schedulePreviewPeriod = selectedCycleAssignment ? derivePeriodFromPlan(selectedCycleAssignment) : null
  const selectedRunDiffersFromSchedule = !!(
    selectedCycle &&
    schedulePreviewPeriod &&
    (selectedCycle.period_start !== schedulePreviewPeriod.period_start || selectedCycle.period_end !== schedulePreviewPeriod.period_end)
  )

  const formatCadence = (assignment: ClientOperationAssignment) => {
    if (assignment.cadence_type === 'custom' && assignment.cadence_interval) {
      return `Every ${assignment.cadence_interval} days`
    }
    const labels: Record<ClientOperationAssignment['cadence_type'], string> = {
      weekly: 'Weekly',
      biweekly: 'Bi-weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      custom: 'Custom',
    }
    return labels[assignment.cadence_type]
  }

  const formatCycleDisplayName = (cycle: Pick<OperationCycle, 'operation_template_name' | 'operation_template_id' | 'period_start' | 'period_end'>) => {
    const baseName = cycle.operation_template_name || `Template #${cycle.operation_template_id}`
    return `${baseName} (${formatDate(cycle.period_start)} - ${formatDate(cycle.period_end)})`
  }

  return (
    <FadeUp>
    <div className="space-y-6">
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
            onClick={openEditModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-secondary-dark rounded-xl text-primary-dark font-medium hover:bg-secondary transition-colors"
          >
            <EditIcon />
            Edit Client
          </button>
          {currentUser?.is_admin && (
            <button
              onClick={handleArchiveToggle}
              disabled={archivingClient}
              className={`inline-flex items-center gap-2 px-4 py-2 border rounded-xl font-medium transition-colors ${
                client.is_archived
                  ? 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-50'
              } disabled:opacity-50`}
            >
              {archivingClient ? 'Saving...' : client.is_archived ? 'Unarchive Client' : 'Archive Client'}
            </button>
          )}
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

      {client.is_archived && (
        <div className="p-3 border border-amber-200 bg-amber-50 rounded-xl text-amber-800 text-sm">
          This client is archived. Checklist tasks are hidden from team boards and recurring plans stay paused until resumed.
        </div>
      )}

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
              {client.client_type === 'individual' && !client.is_service_only && (
                <>
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
                </>
              )}
            </dl>
          </div>

          {/* Spouse Info */}
          {client.client_type === 'individual' && !client.is_service_only && client.spouse_name && (
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

          {/* Operations Checklist */}
          <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Recurring Checklists</h2>
                <p className="text-sm text-gray-500">Set up recurring checklists once per client. Manual runs are optional when needed.</p>
              </div>
              {activeCycle && (
                <div className="self-start sm:self-auto rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 max-w-full">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-emerald-700">Active Cycle</p>
                  <p className="text-xs font-medium text-emerald-900 wrap-break-word">{formatCycleDisplayName(activeCycle)}</p>
                </div>
              )}
            </div>

            <div className="mb-4 p-3 border border-blue-100 bg-blue-50 rounded-lg text-sm text-blue-900">
              <p className="font-medium">How this works</p>
              <p className="mt-1">
                1) Create a <strong>Recurring Checklist</strong> by choosing a template and cadence.
                2) The first run is created automatically. Use <strong>Create Run</strong> when you want to run it again.
              </p>
              {currentUser?.is_admin && (
                <Link to="/admin/settings" className="inline-flex mt-2 text-blue-700 hover:text-blue-900 font-medium">
                  Manage checklist templates in Settings →
                </Link>
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
                {/* Recurring Checklists */}
                {currentUser?.is_admin && !client.is_archived && (
                  <div className="p-4 border border-secondary-dark rounded-xl bg-secondary/20">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">Recurring Checklists</h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Choose a template and cadence once per client. Pause anytime without losing history.
                    </p>
                    <div className="space-y-2 mb-3">
                      {operationAssignments.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No recurring checklists yet.</p>
                      ) : (
                        operationAssignments.map(assignment => (
                          <div key={assignment.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 text-sm border border-secondary-dark rounded-lg bg-white px-3 py-2.5">
                            <div>
                              <p className="font-medium text-gray-800">
                                {assignment.operation_template_name || `Template #${assignment.operation_template_id}`}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatCadence(assignment)}
                                {assignment.cadence_anchor ? ` • Anchor ${formatDate(assignment.cadence_anchor)}` : ''}
                                • Manual runs
                              </p>
                            </div>
                            <div className="flex items-center gap-2 self-start md:self-center">
                              <span className={`h-8 px-2.5 inline-flex items-center justify-center rounded-md text-xs font-semibold uppercase tracking-wide border ${
                                assignment.assignment_status === 'active'
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-100 text-amber-700 border-amber-200'
                              }`}>
                                {assignment.assignment_status}
                              </span>
                              <button
                                type="button"
                                onClick={() => openScheduleEditModal(assignment)}
                                className="h-8 px-3 inline-flex items-center justify-center rounded-md border border-secondary-dark bg-white text-xs font-medium text-gray-700 hover:bg-secondary/40"
                              >
                                Edit schedule
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTogglePlanStatus(assignment)}
                                disabled={updatingAssignmentId === assignment.id}
                                className="h-8 px-3 inline-flex items-center justify-center rounded-md border border-secondary-dark bg-white text-xs font-medium text-gray-700 hover:bg-secondary/40 disabled:opacity-50"
                              >
                                {assignment.assignment_status === 'active' ? 'Pause' : 'Resume'}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={openChecklistSetupModal}
                      className="min-h-11 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark"
                    >
                      Create Recurring Checklist
                    </button>
                  </div>
                )}

                {/* Manual Generate */}
                {currentUser?.is_admin && !client.is_archived && (
                  <div className="p-4 border border-secondary-dark rounded-xl">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">Create Run</h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Manual only: create a run from an active recurring checklist when you want to go again. Duplicate periods are blocked automatically.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <select
                        value={generateForm.assignment_id}
                        onChange={(e) =>
                          setGenerateForm({
                            assignment_id: e.target.value,
                            period_start: '',
                            period_end: '',
                          })
                        }
                        className="px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                      >
                        <option value="">Recurring checklist...</option>
                        {activePlans.map(assignment => (
                          <option key={assignment.id} value={assignment.id}>
                            {(assignment.operation_template_name || `Template #${assignment.operation_template_id}`)} • {formatCadence(assignment)}
                          </option>
                        ))}
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
                        disabled={generatingCycle || !generateForm.assignment_id || !generateForm.period_start || !generateForm.period_end}
                        className="min-h-11 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                      >
                        {generatingCycle ? 'Generating...' : 'Create Run'}
                      </button>
                    </div>
                    {activePlans.length === 0 && (
                      <p className="text-xs text-amber-700 mt-2">Set up a recurring checklist first.</p>
                    )}
                  </div>
                )}

                {/* Cycle History / Picker */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">Run History</h3>
                    <span className="text-xs text-gray-500">{operationCycles.length} cycle{operationCycles.length !== 1 ? 's' : ''}</span>
                  </div>
                  {operationCycles.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No runs yet. Use "Create Run" whenever you want to generate one.</p>
                  ) : (
                    <select
                      value={selectedCycleId || ''}
                      onChange={(e) => setSelectedCycleId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                    >
                      {operationCycles.map(cycle => (
                        <option key={cycle.id} value={cycle.id}>
                          {formatCycleDisplayName(cycle)} ({cycle.status})
                        </option>
                      ))}
                    </select>
                  )}
                  {previousRuns.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {previousRuns.slice(0, 6).map(run => (
                        <button
                          key={run.id}
                          type="button"
                          onClick={() => setSelectedCycleId(run.id)}
                          className="text-xs px-2 py-1 rounded-md border border-secondary-dark hover:bg-secondary/50"
                        >
                          {formatDate(run.period_start)} - {formatDate(run.period_end)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Task List */}
                {matrixCycles.length > 1 && taskMatrixRows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">Checklist Matrix (history view)</h3>
                      <p className="text-xs text-gray-500">Compare runs quickly, then click a cell to edit that run</p>
                    </div>
                    <div className="overflow-x-auto border border-secondary-dark rounded-xl">
                      <table className="min-w-[820px] w-full text-xs">
                        <thead className="bg-secondary/30">
                          <tr>
                            <th className="text-left p-2 sticky left-0 bg-secondary/30 z-10 min-w-[240px]">Task</th>
                            {matrixCycles.map(cycle => (
                              <th key={cycle.id} className="text-center p-2 min-w-[95px]">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCycleId(cycle.id)}
                                  className="font-medium text-gray-700 hover:text-primary"
                                >
                                  {formatDate(cycle.period_start)}
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {taskMatrixRows.map(row => (
                            <tr key={row.rowKey} className="border-t border-secondary-dark">
                              <td className="p-2 sticky left-0 bg-white z-10">
                                <span className="text-gray-800">{row.taskTitle}</span>
                              </td>
                              {matrixCycles.map(cycle => {
                                const task = row.byCycle[cycle.id]
                                const status = task?.status || 'not_started'
                                const statusClass =
                                  status === 'done'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : status === 'in_progress'
                                      ? 'bg-blue-100 text-blue-700'
                                      : status === 'blocked'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-gray-100 text-gray-600'
                                const statusLabel =
                                  status === 'done'
                                    ? 'Done'
                                    : status === 'in_progress'
                                      ? 'In Progress'
                                      : status === 'blocked'
                                        ? 'Blocked'
                                        : 'Not Started'
                                return (
                                  <td key={`${row.rowKey}-${cycle.id}`} className="p-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => openRunForEditing(cycle.id)}
                                      className={`w-8 h-8 rounded-full inline-flex items-center justify-center font-semibold ${statusClass}`}
                                      title={`${statusLabel} • ${row.taskTitle} • ${formatDate(cycle.period_start)} - ${formatDate(cycle.period_end)}`}
                                    >
                                      {status === 'done' ? '✓' : status === 'in_progress' ? '•' : status === 'blocked' ? '!' : '○'}
                                    </button>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedCycle && (
                  <div className="space-y-3" ref={checklistDetailsRef}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {selectedCycle.status === 'active' ? 'Current Period Checklist' : 'Checklist Run Details'}: {formatCycleDisplayName(selectedCycle)}
                        </h3>
                        <span className={`h-7 px-2.5 inline-flex items-center justify-center rounded-md text-[11px] font-semibold uppercase tracking-wide border ${
                          selectedCycle.status === 'archived'
                            ? 'bg-gray-100 text-gray-700 border-gray-200'
                            : selectedCycle.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : selectedCycle.status === 'completed'
                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                          {selectedCycle.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 self-start">
                        <button
                          type="button"
                          onClick={() => {
                            setChecklistDetailsExpanded(prev => !prev)
                          }}
                          disabled={selectedCycleArchived}
                          className="h-9 px-3 rounded-lg text-xs font-medium whitespace-nowrap border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {checklistDetailsExpanded ? 'Hide task editor' : 'Edit tasks'}
                        </button>
                        {currentUser?.is_admin && (
                          <button
                            type="button"
                            onClick={() => handleArchiveRunToggle(selectedCycle)}
                            disabled={archivingCycleId === selectedCycle.id}
                            className="h-9 px-3 rounded-lg text-xs font-medium whitespace-nowrap border border-secondary-dark bg-white text-gray-700 hover:bg-secondary/40 disabled:opacity-50"
                          >
                            {archivingCycleId === selectedCycle.id
                              ? (selectedCycle.status === 'archived' ? 'Unarchiving...' : 'Archiving...')
                              : (selectedCycle.status === 'archived' ? 'Unarchive run' : 'Archive run')}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">
                        Run title is based on template + period dates. Existing run dates are locked after creation. Use <strong>Edit schedule</strong> in the Recurring Checklists section for future runs.
                      </p>
                      {selectedCycleArchived && (
                        <p className="text-xs text-amber-700">
                          This run is archived. Tasks are read-only and hidden from team task boards until unarchived.
                        </p>
                      )}
                      {selectedRunDiffersFromSchedule && schedulePreviewPeriod && selectedCycle && (
                        <p className="text-xs text-amber-700">
                          Schedule updated: this selected run stays {formatDate(selectedCycle.period_start)} - {formatDate(selectedCycle.period_end)}.
                          Next run window is {formatDate(schedulePreviewPeriod.period_start)} - {formatDate(schedulePreviewPeriod.period_end)}.
                        </p>
                      )}
                    </div>
                    {cycleTasks.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No tasks generated for this cycle.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                          <div className="rounded-lg border border-secondary-dark bg-secondary/20 p-2">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">Progress</p>
                            <p className="text-sm font-semibold text-gray-900">{doneCount}/{cycleTasks.length} done</p>
                          </div>
                          <div className="rounded-lg border border-secondary-dark bg-secondary/20 p-2">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">Open</p>
                            <p className="text-sm font-semibold text-gray-900">{cycleTasks.length - doneCount}</p>
                          </div>
                          <div className="rounded-lg border border-secondary-dark bg-secondary/20 p-2">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">In Progress</p>
                            <p className="text-sm font-semibold text-gray-900">{inProgressCount}</p>
                          </div>
                          <div className="rounded-lg border border-secondary-dark bg-secondary/20 p-2">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">Blocked</p>
                            <p className="text-sm font-semibold text-gray-900">{blockedCount}</p>
                          </div>
                          <div className="rounded-lg border border-secondary-dark bg-secondary/20 p-2">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">Overdue</p>
                            <p className="text-sm font-semibold text-gray-900">{overdueCount}</p>
                          </div>
                          <div className="rounded-lg border border-secondary-dark bg-secondary/20 p-2">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">My Open</p>
                            <p className="text-sm font-semibold text-gray-900">{myOpenCount}</p>
                          </div>
                        </div>

                        {latestTaskUpdate && (
                          <p className="text-xs text-gray-500">
                            Last checklist update: {formatDateTime(latestTaskUpdate)}
                          </p>
                        )}

                        {!checklistDetailsExpanded && (
                          <p className="text-sm text-gray-600 bg-secondary/20 border border-secondary-dark rounded-xl p-3">
                            This checklist is collapsed for quick scanning. Click <strong>Edit tasks</strong> to update task statuses, assignees, notes, and evidence.
                          </p>
                        )}

                        {checklistDetailsExpanded && (
                          <>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-secondary-dark rounded-xl p-3 bg-white">
                              <div className="flex flex-wrap gap-2">
                            {[
                              { key: 'open', label: `Open (${cycleTasks.length - doneCount})` },
                              { key: 'all', label: `All (${cycleTasks.length})` },
                              { key: 'done', label: `Done (${doneCount})` },
                              { key: 'mine', label: `Mine (${myOpenCount})` },
                              { key: 'needs_evidence', label: 'Needs Evidence' },
                            ].map((option) => (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => setTaskViewFilter(option.key as typeof taskViewFilter)}
                                className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                                  taskViewFilter === option.key
                                    ? 'bg-primary/10 text-primary border-primary/30'
                                    : 'bg-white text-gray-600 border-secondary-dark hover:bg-secondary/30'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setExpandedForTaskIds(filteredCycleTasks.map(t => t.id), !allFilteredExpanded)}
                                  className="min-h-11 px-3 py-1.5 rounded-lg text-xs font-medium border border-secondary-dark text-gray-700 hover:bg-secondary/30"
                                >
                                  {allFilteredExpanded ? 'Collapse all' : 'Expand all'}
                                </button>
                              </div>
                            </div>

                            {filteredCycleTasks.length === 0 && (
                              <p className="text-sm text-gray-500 italic">No tasks match this filter.</p>
                            )}

                            {filteredCycleTasks.map(task => {
                              const draft = taskDrafts[task.id] || {
                                status: task.status,
                                assigned_to_id: task.assigned_to?.id ? String(task.assigned_to.id) : '',
                                notes: task.notes || '',
                                evidence_note: task.evidence_note || '',
                              }
                              const logNotes = `Ops task: ${task.title} (${formatCycleDisplayName(selectedCycle)})`
                              const logTimeLink =
                                `/admin/time?prefill=true&client_id=${client.id}&operation_task_id=${task.id}&notes=${encodeURIComponent(logNotes)}`
                              const savingThisTask = savingTaskId === task.id
                              const hasUnmetPrerequisites = task.unmet_prerequisites.length > 0
                              const blockedByPrerequisites =
                                hasUnmetPrerequisites && (draft.status === 'in_progress' || draft.status === 'done')
                              const isExpanded = !!expandedTaskIds[task.id]
                              const statusLabel = task.status.replace(/_/g, ' ')
                              const statusPillClass =
                                task.status === 'done'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : task.status === 'blocked'
                                    ? 'bg-red-100 text-red-700'
                                    : task.status === 'in_progress'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-700'
                              return (
                                <div key={task.id} className="border border-secondary-dark rounded-xl p-4">
                                  <div className="flex items-start justify-between gap-2">
                                    <button
                                      type="button"
                                      onClick={() => toggleTaskExpanded(task.id)}
                                      className="text-left flex-1 min-h-11"
                                    >
                                      <p className="font-medium text-gray-900">{task.position}. {task.title}</p>
                                      <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span className={`text-xs px-2 py-0.5 rounded capitalize ${statusPillClass}`}>
                                          {statusLabel}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {task.assigned_to?.name || 'Unassigned'}
                                        </span>
                                        {task.evidence_required && (
                                          <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">Evidence required</span>
                                        )}
                                        {task.due_at && (
                                          <span className="text-xs text-gray-500">Due: {formatDateTime(task.due_at)}</span>
                                        )}
                                        {task.linked_time_entry && (
                                          <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                            Linked time: {task.linked_time_entry.hours.toFixed(2)}h on {formatDate(task.linked_time_entry.work_date)}
                                          </span>
                                        )}
                                        {hasUnmetPrerequisites && (
                                          <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
                                            Waiting on prerequisites
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                    <div className="flex items-center gap-2">
                                      <Link
                                        to={logTimeLink}
                                        className="text-xs text-primary hover:text-primary-dark font-medium min-h-11 inline-flex items-center"
                                      >
                                        Log Time
                                      </Link>
                                      <button
                                        type="button"
                                        onClick={() => toggleTaskExpanded(task.id)}
                                        className="min-h-11 px-3 py-1.5 rounded-lg text-xs font-medium border border-secondary-dark text-gray-700 hover:bg-secondary/30"
                                        aria-label={isExpanded ? `Collapse task ${task.title}` : `Expand task ${task.title}`}
                                      >
                                        {isExpanded ? 'Collapse' : 'Expand'}
                                      </button>
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <>
                                      {task.description && <p className="text-sm text-gray-500 mt-2">{task.description}</p>}
                                      {hasUnmetPrerequisites && (
                                        <p className="text-xs text-red-700 mt-2">
                                          Unmet: {task.unmet_prerequisites.map(dep => dep.title).join(', ')}
                                        </p>
                                      )}

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2 mt-3">
                                        <select
                                          value={draft.status}
                                          onChange={(e) => handleTaskDraftChange(task.id, { status: e.target.value as OperationTaskItem['status'] })}
                                          className="px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                                        >
                                          <option value="not_started">Not Started</option>
                                          <option value="in_progress">In Progress</option>
                                          <option value="blocked">Blocked</option>
                                          <option value="done">Done</option>
                                        </select>
                                        <select
                                          value={draft.assigned_to_id}
                                          onChange={(e) => handleTaskDraftChange(task.id, { assigned_to_id: e.target.value })}
                                          className="px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                                        >
                                          <option value="">Unassigned</option>
                                          {staffUsers.map(user => (
                                            <option key={user.id} value={user.id}>{user.full_name}</option>
                                          ))}
                                        </select>
                                        <input
                                          type="text"
                                          value={draft.notes}
                                          onChange={(e) => handleTaskDraftChange(task.id, { notes: e.target.value })}
                                          placeholder="Task notes"
                                          className="px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                                        />
                                        <input
                                          type="text"
                                          value={draft.evidence_note}
                                          onChange={(e) => handleTaskDraftChange(task.id, { evidence_note: e.target.value })}
                                          placeholder={task.evidence_required ? 'Evidence note (required for done)' : 'Evidence note (optional)'}
                                          className="px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                                        />
                                      </div>

                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleSaveTask(task.id)}
                                          disabled={savingThisTask || blockedByPrerequisites}
                                          className="min-h-11 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
                                        >
                                          {savingThisTask ? 'Saving...' : 'Save'}
                                        </button>
                                        {task.status !== 'done' ? (
                                          <button
                                            type="button"
                                            onClick={() => handleCompleteTask(task.id)}
                                            disabled={
                                              savingThisTask ||
                                              hasUnmetPrerequisites ||
                                              (task.evidence_required && !draft.evidence_note.trim())
                                            }
                                            className="min-h-11 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                          >
                                            Complete
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleReopenTask(task.id)}
                                            disabled={savingThisTask}
                                            className="min-h-11 px-3 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                                          >
                                            Reopen
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </>
                        )}
                      </>
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
                      <div className="flex items-center gap-2 self-start">
                        <button
                          onClick={() => openEditContact(contact)}
                          className="min-h-8 px-2.5 inline-flex items-center justify-center rounded-md border border-secondary-dark text-xs text-primary hover:text-primary-dark font-medium hover:bg-secondary/30"
                        >
                          Edit
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
          {(latestReturn?.workflow_events?.length > 0 || auditLogs.length > 0 || !!client.created_at) && (
            <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {/* Merge and sort workflow events + audit logs by date */}
                {[
                  ...(!auditLogs.some(log => log.action === 'created') ? [{
                    id: 'synthetic-client-created',
                    text: `Created client record for ${client.client_type === 'business' && client.business_name ? client.business_name : client.full_name}`,
                    actor: 'System',
                    date: client.created_at,
                  }] : []),
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

      {showChecklistSetupModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowChecklistSetupModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-secondary-dark">
              <h2 className="text-xl font-bold text-primary-dark">Create Recurring Checklist</h2>
              <p className="text-sm text-gray-500 mt-1">
                Set this client up once, then track completion each period.
              </p>
            </div>
            <div className="p-6 space-y-5">
              {checklistSetupError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {checklistSetupError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setChecklistSetup(prev => ({ ...prev, mode: 'existing' }))}
                  className={`p-3 border rounded-lg text-left ${checklistSetup.mode === 'existing' ? 'border-primary bg-primary/5' : 'border-secondary-dark'}`}
                >
                  <p className="font-medium text-sm text-primary-dark">Use Existing Template</p>
                  <p className="text-xs text-gray-500 mt-1">Fast setup from your current library.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setChecklistSetup(prev => ({ ...prev, mode: 'new' }))}
                  className={`p-3 border rounded-lg text-left ${checklistSetup.mode === 'new' ? 'border-primary bg-primary/5' : 'border-secondary-dark'}`}
                >
                  <p className="font-medium text-sm text-primary-dark">Create New Template</p>
                  <p className="text-xs text-gray-500 mt-1">Build from scratch or clone and customize.</p>
                </button>
              </div>

              {checklistSetup.mode === 'existing' ? (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                  <select
                    value={checklistSetup.existing_template_id}
                    onChange={(e) => setChecklistSetup(prev => ({ ...prev, existing_template_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-secondary-dark rounded-lg"
                  >
                    <option value="">Select template...</option>
                    {activeTemplates.map(template => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500">
                      Using an existing template keeps it unchanged for all clients.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setChecklistSetup(prev => ({
                          ...prev,
                          mode: 'new',
                          clone_from_template_id: prev.existing_template_id,
                          new_template_name: prev.existing_template_id
                            ? `${activeTemplates.find(t => t.id === parseInt(prev.existing_template_id))?.name || 'Template'} - Custom`
                            : prev.new_template_name,
                        }))
                      }
                      className="text-xs text-primary hover:text-primary-dark font-medium whitespace-nowrap"
                    >
                      Customize as new template
                    </button>
                  </div>
                  {checklistSetup.existing_template_id && (
                    <div className="border border-secondary-dark rounded-lg p-3 bg-secondary/20">
                      <p className="text-sm font-semibold text-gray-900 mb-2">Template Checklist Preview</p>
                      {(() => {
                        const selected = activeTemplates.find(t => t.id === parseInt(checklistSetup.existing_template_id))
                        const tasks = (selected?.tasks || []).filter(task => task.is_active).sort((a, b) => a.position - b.position)
                        if (tasks.length === 0) {
                          return <p className="text-xs text-gray-500 italic">This template has no active tasks.</p>
                        }
                        return (
                          <div className="space-y-1">
                            {tasks.map(task => (
                              <div key={task.id} className="text-sm text-gray-700 flex items-start gap-2">
                                <span className="text-xs mt-1 text-gray-500">{task.position}.</span>
                                <div>
                                  <p className="font-medium">{task.title}</p>
                                  {task.description && <p className="text-xs text-gray-500">{task.description}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Template Name *</label>
                      <input
                        type="text"
                        value={checklistSetup.new_template_name}
                        onChange={(e) => setChecklistSetup(prev => ({ ...prev, new_template_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-secondary-dark rounded-lg"
                        placeholder="e.g., Biweekly Payroll - Tips"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select
                        value={checklistSetup.category}
                        onChange={(e) => setChecklistSetup(prev => ({ ...prev, category: e.target.value as typeof checklistSetup.category }))}
                        className="w-full px-3 py-2 border border-secondary-dark rounded-lg"
                      >
                        <option value="payroll">Payroll</option>
                        <option value="bookkeeping">Bookkeeping</option>
                        <option value="compliance">Compliance</option>
                        <option value="general">General</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                    <textarea
                      value={checklistSetup.new_template_description}
                      onChange={(e) => setChecklistSetup(prev => ({ ...prev, new_template_description: e.target.value }))}
                      className="w-full px-3 py-2 border border-secondary-dark rounded-lg"
                      rows={2}
                      placeholder="Describe when this checklist should be used..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start From Existing Template (optional)</label>
                    <select
                      value={checklistSetup.clone_from_template_id}
                      onChange={(e) => setChecklistSetup(prev => ({ ...prev, clone_from_template_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-secondary-dark rounded-lg"
                    >
                      <option value="">Blank template</option>
                      {activeTemplates.map(template => (
                        <option key={template.id} value={template.id}>{template.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="border border-secondary-dark rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-gray-900">Checklist Tasks</p>
                      <button
                        type="button"
                        onClick={() =>
                          setChecklistTaskDrafts(prev => [
                            ...prev,
                            { id: crypto.randomUUID(), title: '', description: '', evidence_required: false },
                          ])
                        }
                        className="text-xs text-primary hover:text-primary-dark font-medium"
                      >
                        + Add Task
                      </button>
                    </div>
                    <div className="space-y-2">
                      {checklistTaskDrafts.map((task, index) => (
                        <div key={task.id} className="border border-secondary-dark rounded-lg p-2 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-gray-500">Task {index + 1}</p>
                            {checklistTaskDrafts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setChecklistTaskDrafts(prev => prev.filter(t => t.id !== task.id))}
                                className="text-xs text-red-600 hover:text-red-700"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) =>
                              setChecklistTaskDrafts(prev => prev.map(t => (t.id === task.id ? { ...t, title: e.target.value } : t)))
                            }
                            className="w-full px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                            placeholder="Task title"
                          />
                          <input
                            type="text"
                            value={task.description}
                            onChange={(e) =>
                              setChecklistTaskDrafts(prev => prev.map(t => (t.id === task.id ? { ...t, description: e.target.value } : t)))
                            }
                            className="w-full px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                            placeholder="Optional notes"
                          />
                          <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={task.evidence_required}
                              onChange={(e) =>
                                setChecklistTaskDrafts(prev =>
                                  prev.map(t => (t.id === task.id ? { ...t, evidence_required: e.target.checked } : t))
                                )
                              }
                            />
                            Evidence required before marking done
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="border border-secondary-dark rounded-lg p-3 space-y-3">
                <p className="text-sm font-semibold text-gray-900">Recurring Schedule</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select
                    value={checklistSetup.cadence_type}
                    onChange={(e) => setChecklistSetup(prev => ({ ...prev, cadence_type: e.target.value as typeof checklistSetup.cadence_type }))}
                    className="px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="custom">Custom (days)</option>
                  </select>
                  {checklistSetup.cadence_type === 'custom' ? (
                    <input
                      type="number"
                      min={1}
                      value={checklistSetup.cadence_interval}
                      onChange={(e) => setChecklistSetup(prev => ({ ...prev, cadence_interval: e.target.value }))}
                      placeholder="Every N days"
                      className="px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                    />
                  ) : (
                    <input
                      type="date"
                      value={checklistSetup.cadence_anchor}
                      onChange={(e) => setChecklistSetup(prev => ({ ...prev, cadence_anchor: e.target.value }))}
                      className="px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                    />
                  )}
                  <div className="flex items-center text-sm px-3 py-2 border border-secondary-dark rounded-lg bg-secondary/20 text-gray-700">
                    Manual mode: use Create Run when ready
                  </div>
                </div>
              </div>

              <div className="border border-secondary-dark rounded-lg p-3">
                <p className="text-sm font-medium text-gray-800">First run is created automatically</p>
                <p className="text-xs text-gray-500 mt-1">
                  Saving this setup creates the current-period checklist immediately. After that, create additional runs manually when needed.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-secondary-dark flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowChecklistSetupModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                disabled={creatingChecklistSetup}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateChecklistSetup}
                disabled={creatingChecklistSetup}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
              >
                {creatingChecklistSetup ? 'Creating...' : 'Save Checklist Setup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recurring Checklist Schedule Edit Modal */}
      {showScheduleEditModal && editingScheduleAssignment && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowScheduleEditModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-secondary-dark">
              <h2 className="text-xl font-bold text-primary-dark">Edit Recurring Checklist Schedule</h2>
              <p className="text-sm text-gray-500 mt-1">
                Update cadence and anchor date for future runs. Existing runs stay unchanged.
              </p>
            </div>
            <div className="p-6 space-y-4">
              {scheduleEditError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {scheduleEditError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Checklist</label>
                <p className="text-sm text-gray-900">
                  {editingScheduleAssignment.operation_template_name || `Template #${editingScheduleAssignment.operation_template_id}`}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <select
                  value={scheduleEditForm.cadence_type}
                  onChange={(e) =>
                    setScheduleEditForm(prev => ({
                      ...prev,
                      cadence_type: e.target.value as ClientOperationAssignment['cadence_type'],
                    }))
                  }
                  className="px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="custom">Custom (days)</option>
                </select>
                {scheduleEditForm.cadence_type === 'custom' ? (
                  <input
                    type="number"
                    min={1}
                    value={scheduleEditForm.cadence_interval}
                    onChange={(e) => setScheduleEditForm(prev => ({ ...prev, cadence_interval: e.target.value }))}
                    placeholder="Every N days"
                    className="px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                  />
                ) : (
                  <input
                    type="date"
                    value={scheduleEditForm.cadence_anchor}
                    onChange={(e) => setScheduleEditForm(prev => ({ ...prev, cadence_anchor: e.target.value }))}
                    className="px-3 py-2 border border-secondary-dark rounded-lg text-sm"
                  />
                )}
                <div className="text-xs text-gray-500 border border-secondary-dark rounded-lg px-3 py-2 bg-secondary/20">
                  Anchor controls where the period boundaries start.
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-secondary-dark flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowScheduleEditModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                disabled={savingScheduleEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveScheduleEdit}
                disabled={savingScheduleEdit}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
              >
                {savingScheduleEdit ? 'Saving...' : 'Save schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <div className="p-6 border-t border-secondary-dark flex items-center justify-between gap-3">
              <div>
                {editingContact && (
                  <button
                    type="button"
                    onClick={async () => {
                      const deleted = await handleDeleteContact(editingContact)
                      if (deleted) setShowContactModal(false)
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                    disabled={contactSaving}
                  >
                    Delete Contact
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
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
                        onClick={() =>
                          setEditForm({
                            ...editForm,
                            client_type: 'individual',
                            is_service_only: false,
                          })
                        }
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
                        onClick={() =>
                          setEditForm({
                            ...editForm,
                            client_type: 'business',
                            is_service_only: true,
                            date_of_birth: '',
                            filing_status: '',
                            spouse_name: '',
                            spouse_dob: '',
                            has_prior_year_return: false,
                            changes_from_prior_year: '',
                            denied_eic_actc: false,
                            denied_eic_actc_year: '',
                          })
                        }
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

                  {editForm.client_type === 'individual' ? (
                    <label className="flex items-start gap-3 p-3 border border-secondary-dark rounded-lg cursor-pointer hover:bg-secondary/50">
                      <input
                        type="checkbox"
                        checked={!editForm.is_service_only}
                        onChange={e => setEditForm({ ...editForm, is_service_only: !e.target.checked })}
                        className="mt-0.5 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">Include in Tax Return Workflow</span>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Turn off only for ongoing service clients without a tax return.
                        </p>
                      </div>
                    </label>
                  ) : (
                    <div className="p-3 border border-blue-100 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-900">Business clients use service workflow by default.</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        Individual-only tax fields are hidden for business clients.
                      </p>
                    </div>
                  )}

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
                  {editForm.client_type === 'individual' && !editForm.is_service_only && (
                    <>
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
                    </>
                  )}
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
              {editForm.client_type === 'individual' && !editForm.is_service_only && (
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
              )}

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
                  {editForm.client_type === 'individual' && !editForm.is_service_only && (
                    <label className="flex items-center gap-3 p-3 border border-secondary-dark rounded-lg cursor-pointer hover:bg-secondary/50">
                      <input
                        type="checkbox"
                        checked={editForm.has_prior_year_return}
                        onChange={e => setEditForm({ ...editForm, has_prior_year_return: e.target.checked })}
                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium text-gray-700">Has Prior Year Return</span>
                    </label>
                  )}
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

                {editForm.client_type === 'individual' && !editForm.is_service_only && (
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
                )}

                {editForm.client_type === 'individual' && !editForm.is_service_only && (
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
                )}
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
  )
}
