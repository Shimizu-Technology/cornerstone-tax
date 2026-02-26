// API client for backend communication
// Updated: Phase 5 - Workflow Tracking

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  errors?: string[];
}

// Store for the auth token getter function
let getAuthToken: (() => Promise<string | null>) | null = null;

// Set the auth token getter (called from AuthProvider)
export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  getAuthToken = getter;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  requireAuth: boolean = true
): Promise<ApiResponse<T>> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add auth token if available and required
    if (requireAuth && getAuthToken) {
      const token = await getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 204 No Content (empty response body)
    if (response.status === 204) {
      return { data: undefined as unknown as T };
    }

    const data = await response.json();

    if (!response.ok) {
      // Handle 401 specifically
      if (response.status === 401) {
        return {
          error: data.error || 'Authentication required',
          errors: data.errors || ['Please sign in to continue'],
        };
      }
      // CST-28: Handle 403 Forbidden properly
      if (response.status === 403) {
        return {
          error: data.error || 'Access denied',
          errors: data.errors || ['You do not have permission to perform this action'],
        };
      }
      return {
        error: data.error || 'Something went wrong',
        errors: data.errors || [],
      };
    }

    return { data };
  } catch (error) {
    console.error('API Error:', error);
    return {
      error: error instanceof Error ? error.message : 'Network error',
      errors: [],
    };
  }
}

// Fetch without auth (for public endpoints)
async function fetchApiPublic<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  return fetchApi(endpoint, options, false);
}

// Types
export interface IntakeSubmitResponse {
  message: string;
  client: {
    id: number;
    full_name: string;
    email: string;
  };
  tax_return: {
    id: number;
    tax_year: number;
    status: string;
  };
}

export interface WorkflowStage {
  id: number;
  name: string;
  slug: string;
  position: number;
  color: string | null;
  notify_client: boolean;
}

export interface ClientServiceType {
  id: number;
  name: string;
  color: string | null;
  description?: string;
}

export interface ClientContact {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
}

export interface ClientSummary {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  is_new_client: boolean;
  client_type: 'individual' | 'business';
  business_name: string | null;
  is_service_only: boolean;
  service_types: ClientServiceType[];
  contacts: ClientContact[];
  created_at: string;
  tax_return: {
    id: number;
    tax_year: number;
    status: string;
    status_slug: string;
    status_color: string;
    assigned_to: string | null;
  } | null;
}

export interface ClientsResponse {
  clients: ClientSummary[];
  meta: {
    current_page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
  };
}

export interface ClientDetailResponse {
  client: {
    id: number;
    first_name: string;
    last_name: string;
    full_name: string;
    date_of_birth: string;
    email: string;
    phone: string;
    mailing_address: string;
    filing_status: string;
    is_new_client: boolean;
    has_prior_year_return: boolean;
    changes_from_prior_year: string;
    spouse_name: string;
    spouse_dob: string;
    denied_eic_actc: boolean;
    denied_eic_actc_year: number | null;
    has_crypto_transactions: boolean;
    wants_direct_deposit: boolean;
    client_type: 'individual' | 'business';
    business_name: string | null;
    is_service_only: boolean;
    service_types: ClientServiceType[];
    contacts: ClientContact[];
    created_at: string;
    updated_at: string;
    dependents: Array<{
      id: number;
      name: string;
      date_of_birth: string;
      relationship: string;
      months_lived_with_client: number;
      is_student: boolean;
      is_disabled: boolean;
    }>;
    tax_returns: Array<{
      id: number;
      tax_year: number;
      status: string;
      status_slug: string;
      status_color: string;
      assigned_to: { id: number; name: string } | null;
      created_at: string;
      income_sources: Array<{ id: number; source_type: string; payer_name: string }>;
      workflow_events: Array<{
        id: number;
        event_type: string;
        old_value: string | null;
        new_value: string | null;
        description: string;
        actor: string;
        created_at: string;
      }>;
    }>;
  };
}

export interface TaxReturnSummary {
  id: number;
  tax_year: number;
  client: {
    id: number;
    full_name: string;
    email: string;
  };
  status: string;
  status_slug: string;
  status_color: string;
  assigned_to: { id: number; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface IncomeSource {
  id: number;
  source_type: string;
  payer_name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxReturnsResponse {
  tax_returns: TaxReturnSummary[];
  meta: {
    current_page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
  };
}

export interface TaxReturnDetail {
  id: number;
  tax_year: number;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  client: {
    id: number;
    full_name: string;
    email: string;
    phone: string;
    filing_status: string;
  };
  workflow_stage: {
    id: number;
    name: string;
    slug: string;
    color: string;
  } | null;
  assigned_to: {
    id: number;
    name: string;
    email: string;
  } | null;
  reviewed_by: {
    id: number;
    name: string;
  } | null;
  income_sources: Array<{
    id: number;
    source_type: string;
    payer_name: string;
  }>;
  documents: Document[];
  workflow_events: Array<{
    id: number;
    event_type: string;
    old_value: string | null;
    new_value: string | null;
    description: string;
    actor: string;
    created_at: string;
  }>;
}

export interface CurrentUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  role: 'admin' | 'employee' | 'client';
  is_admin: boolean;
  is_staff: boolean;
  created_at: string;
}

export interface UserSummary {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  full_name: string;
  role: string;
}

export interface AdminWorkflowStage extends WorkflowStage {
  is_active: boolean;
  tax_returns_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  full_name: string;
  role: 'admin' | 'employee';
  is_active: boolean;
  is_pending: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowEventItem {
  id: number;
  event_type: string;
  description: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user: {
    id: number;
    name: string;
    email: string;
  } | null;
  tax_return: {
    id: number;
    tax_year: number;
    client: {
      id: number;
      name: string;
    };
    current_status: string | null;
  };
}

export interface WorkflowEventsResponse {
  events: WorkflowEventItem[];
  pagination: {
    current_page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
  };
}

// Audit Log Types
export interface AuditLog {
  id: number;
  auditable_type: string;
  auditable_id: number;
  action: 'created' | 'updated' | 'deleted';
  description: string;
  changes_made: Record<string, { from: unknown; to: unknown }> | null;
  metadata: string | null;
  created_at: string;
  user: {
    id: number;
    email: string;
  } | null;
}

export interface AuditLogsResponse {
  audit_logs: AuditLog[];
  pagination: {
    current_page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
  };
}

// Time Tracking Types
export interface TimeCategory {
  id: number;
  name: string;
  description: string | null;
}

export interface AdminTimeCategory extends TimeCategory {
  is_active: boolean;
  time_entries_count: number;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: number;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  formatted_start_time: string | null;
  formatted_end_time: string | null;
  hours: number;
  break_minutes: number | null;
  description: string | null;
  user: {
    id: number;
    email: string;
    display_name: string;
    full_name: string;
  };
  time_category: {
    id: number;
    name: string;
  } | null;
  client: {
    id: number;
    name: string;
  } | null;
  tax_return: {
    id: number;
    tax_year: number;
  } | null;
  service_type: {
    id: number;
    name: string;
    color: string | null;
  } | null;
  service_task: {
    id: number;
    name: string;
  } | null;
  linked_operation_task: {
    id: number;
    title: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface TimeEntriesResponse {
  time_entries: TimeEntry[];
  pagination: {
    current_page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
  };
  summary: {
    total_hours: number;
    total_break_hours: number;
    entry_count: number;
  };
}

// Schedule Types
export interface Schedule {
  id: number;
  user_id: number;
  user: {
    id: number;
    email: string;
    display_name: string;
    full_name: string;
  };
  work_date: string;
  start_time: string;
  end_time: string;
  formatted_start_time: string;
  formatted_end_time: string;
  formatted_time_range: string;
  hours: number;
  notes: string | null;
  created_by: {
    id: number;
    email: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface SchedulesResponse {
  schedules: Schedule[];
  users: Array<{
    id: number;
    email: string;
    display_name: string;
    full_name: string;
  }>;
}

// Schedule Time Preset Types
export interface ScheduleTimePreset {
  id: number;
  label: string;
  start_time: string;
  end_time: string;
  formatted_start_time: string;
  formatted_end_time: string;
  position: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ScheduleTimePresetsResponse {
  presets: ScheduleTimePreset[];
}

// Document Types
export interface Document {
  id: number;
  filename: string;
  document_type: string | null;
  content_type: string | null;
  file_size: number | null;
  uploaded_by: {
    id: number;
    email: string;
  } | null;
  created_at: string;
  tax_return_id: number;
}

export interface PresignResponse {
  upload_url: string;
  s3_key: string;
  expires_in: number;
}

export interface DownloadResponse {
  download_url: string;
  expires_in: number;
}

// Service Types and Tasks
export interface ServiceTask {
  id: number;
  service_type_id?: number;
  name: string;
  description: string | null;
  is_active?: boolean;
  position?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceType {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  is_active?: boolean;
  position?: number;
  tasks?: ServiceTask[];
  created_at?: string;
  updated_at?: string;
}

export interface ServiceTypesResponse {
  service_types: ServiceType[];
}

// Operations Checklist Types
export interface OperationTemplateTask {
  id: number;
  operation_template_id?: number;
  title: string;
  description: string | null;
  position: number;
  default_assignee_id: number | null;
  due_offset_value: number | null;
  due_offset_unit: 'hours' | 'days' | null;
  due_offset_from: 'cycle_start' | 'cycle_end' | null;
  evidence_required: boolean;
  dependency_template_task_ids: number[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface OperationTemplate {
  id: number;
  name: string;
  description: string | null;
  category: 'payroll' | 'bookkeeping' | 'compliance' | 'general' | 'custom';
  recurrence_type: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'custom';
  recurrence_interval: number | null;
  recurrence_anchor: string | null;
  auto_generate: boolean;
  is_active: boolean;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
  tasks: OperationTemplateTask[];
}

export interface OperationTemplatesResponse {
  operation_templates: OperationTemplate[];
}

export interface ClientOperationAssignment {
  id: number;
  client_id: number;
  operation_template_id: number;
  operation_template_name: string | null;
  auto_generate: boolean;
  assignment_status: 'active' | 'paused';
  starts_on: string | null;
  ends_on: string | null;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface OperationTaskItem {
  id: number;
  operation_cycle_id: number;
  cycle_label?: string | null;
  operation_template_name?: string | null;
  operation_template_task_id: number;
  client_id: number;
  client_name?: string | null;
  title: string;
  description: string | null;
  position: number;
  status: 'not_started' | 'in_progress' | 'blocked' | 'done';
  assigned_to: { id: number; name: string } | null;
  due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  completed_by: { id: number; name: string } | null;
  evidence_required: boolean;
  evidence_note: string | null;
  notes: string | null;
  unmet_prerequisites: Array<{
    id: number;
    title: string;
    status: 'not_started' | 'in_progress' | 'blocked' | 'done';
  }>;
  linked_time_entry_id: number | null;
  linked_time_entry: {
    id: number;
    work_date: string;
    hours: number;
    user_name: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface OperationCycle {
  id: number;
  client_id: number;
  operation_template_id: number;
  operation_template_name: string | null;
  client_operation_assignment_id: number | null;
  period_start: string;
  period_end: string;
  cycle_label: string;
  generation_mode: 'auto' | 'manual';
  status: 'active' | 'completed' | 'cancelled';
  generated_at: string | null;
  generated_by: { id: number; name: string } | null;
  created_at: string;
  updated_at: string;
  tasks?: OperationTaskItem[];
}

export interface OperationTasksResponse {
  operation_tasks: OperationTaskItem[];
  meta?: {
    current_page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
  };
}

export interface OperationCyclesResponse {
  operation_cycles: OperationCycle[];
  meta?: {
    current_page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
  };
}

// API functions
export const api = {
  // Auth
  getCurrentUser: (email?: string) =>
    fetchApi<{ user: CurrentUser }>('/api/v1/auth/me', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Intake (public - no auth required)
  submitIntake: (data: Record<string, unknown>) =>
    fetchApiPublic<IntakeSubmitResponse>('/api/v1/intake', {
      method: 'POST',
      body: JSON.stringify({ intake: data }),
    }),

  // Contact form (public - no auth required)
  submitContact: (data: { name: string; email: string; phone?: string; subject: string; message: string }) =>
    fetchApiPublic<{ success: boolean; message: string }>('/api/v1/contact', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Workflow stages (public - no auth required)
  getWorkflowStages: () =>
    fetchApiPublic<{ workflow_stages: WorkflowStage[] }>('/api/v1/workflow_stages'),

  // Clients
  getClients: (params?: { 
    page?: number; 
    search?: string; 
    per_page?: number; 
    stage?: string;
    service_type_id?: number;
    client_type?: 'individual' | 'business';
    service_only?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.stage) searchParams.set('stage', params.stage);
    if (params?.service_type_id) searchParams.set('service_type_id', params.service_type_id.toString());
    if (params?.client_type) searchParams.set('client_type', params.client_type);
    if (params?.service_only !== undefined) searchParams.set('service_only', params.service_only.toString());
    const query = searchParams.toString();
    return fetchApi<ClientsResponse>(`/api/v1/clients${query ? `?${query}` : ''}`);
  },

  getClient: (id: number) =>
    fetchApi<ClientDetailResponse>(`/api/v1/clients/${id}`),

  createClient: (data: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    date_of_birth?: string | null;
    filing_status?: string;
    is_new_client?: boolean;
    client_type?: 'individual' | 'business';
    business_name?: string;
    is_service_only?: boolean;
    service_type_ids?: number[];
    tax_year?: number;
    contacts?: Array<{
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
      role?: string;
      is_primary?: boolean;
    }>;
  }) =>
    fetchApi<{ client: ClientSummary }>('/api/v1/clients', {
      method: 'POST',
      body: JSON.stringify({ client: data }),
    }),

  updateClient: (id: number, data: Record<string, unknown>) =>
    fetchApi<{ client: ClientDetailResponse['client'] }>(`/api/v1/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ client: data }),
    }),

  // Client Contacts
  getClientContacts: (clientId: number) =>
    fetchApi<{ contacts: ClientContact[] }>(`/api/v1/clients/${clientId}/contacts`),
  createClientContact: (clientId: number, data: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    role?: string;
    is_primary?: boolean;
  }) =>
    fetchApi<{ contact: ClientContact }>(`/api/v1/clients/${clientId}/contacts`, {
      method: 'POST',
      body: JSON.stringify({ contact: data }),
    }),
  updateClientContact: (clientId: number, contactId: number, data: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    role?: string;
    is_primary?: boolean;
  }) =>
    fetchApi<{ contact: ClientContact }>(`/api/v1/clients/${clientId}/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify({ contact: data }),
    }),
  deleteClientContact: (clientId: number, contactId: number) =>
    fetchApi<void>(`/api/v1/clients/${clientId}/contacts/${contactId}`, {
      method: 'DELETE',
    }),

  // Operations Templates
  getOperationTemplates: (includeInactive: boolean = false) =>
    fetchApi<OperationTemplatesResponse>(`/api/v1/operation_templates${includeInactive ? '?include_inactive=true' : ''}`),

  createOperationTemplate: (data: {
    name: string;
    description?: string;
    category: 'payroll' | 'bookkeeping' | 'compliance' | 'general' | 'custom';
    recurrence_type: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'custom';
    recurrence_interval?: number;
    recurrence_anchor?: string;
    auto_generate?: boolean;
    is_active?: boolean;
  }) =>
    fetchApi<{ operation_template: OperationTemplate }>('/api/v1/operation_templates', {
      method: 'POST',
      body: JSON.stringify({ operation_template: data }),
    }),

  updateOperationTemplate: (id: number, data: Partial<{
    name: string;
    description: string;
    category: 'payroll' | 'bookkeeping' | 'compliance' | 'general' | 'custom';
    recurrence_type: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'custom';
    recurrence_interval: number | null;
    recurrence_anchor: string | null;
    auto_generate: boolean;
    is_active: boolean;
  }>) =>
    fetchApi<{ operation_template: OperationTemplate }>(`/api/v1/operation_templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ operation_template: data }),
    }),

  deleteOperationTemplate: (id: number) =>
    fetchApi<void>(`/api/v1/operation_templates/${id}`, {
      method: 'DELETE',
    }),

  // Operation Template Tasks
  getOperationTemplateTasks: (templateId: number, includeInactive: boolean = false) =>
    fetchApi<{ tasks: OperationTemplateTask[] }>(`/api/v1/operation_templates/${templateId}/tasks${includeInactive ? '?include_inactive=true' : ''}`),

  reorderOperationTemplateTasks: (templateId: number, positions: Array<{ id: number; position: number }>) =>
    fetchApi<{ tasks: OperationTemplateTask[] }>(`/api/v1/operation_templates/${templateId}/tasks/reorder`, {
      method: 'POST',
      body: JSON.stringify({ positions }),
    }),

  createOperationTemplateTask: (templateId: number, data: {
    title: string;
    description?: string;
    position?: number;
    default_assignee_id?: number;
    due_offset_value?: number;
    due_offset_unit?: 'hours' | 'days';
    due_offset_from?: 'cycle_start' | 'cycle_end';
    evidence_required?: boolean;
    dependency_template_task_ids?: number[];
    is_active?: boolean;
  }) =>
    fetchApi<{ task: OperationTemplateTask }>(`/api/v1/operation_templates/${templateId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ task: data }),
    }),

  updateOperationTemplateTask: (id: number, data: Partial<{
    title: string;
    description: string | null;
    position: number;
    default_assignee_id: number | null;
    due_offset_value: number | null;
    due_offset_unit: 'hours' | 'days' | null;
    due_offset_from: 'cycle_start' | 'cycle_end' | null;
    evidence_required: boolean;
    dependency_template_task_ids: number[];
    is_active: boolean;
  }>) =>
    fetchApi<{ task: OperationTemplateTask }>(`/api/v1/operation_template_tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ task: data }),
    }),

  deleteOperationTemplateTask: (id: number) =>
    fetchApi<void>(`/api/v1/operation_template_tasks/${id}`, {
      method: 'DELETE',
    }),

  // Client Operation Assignments
  getClientOperationAssignments: (clientId: number) =>
    fetchApi<{ assignments: ClientOperationAssignment[] }>(`/api/v1/clients/${clientId}/operation_assignments`),

  createClientOperationAssignment: (clientId: number, data: {
    operation_template_id: number;
    auto_generate?: boolean;
    assignment_status?: 'active' | 'paused';
    starts_on?: string;
    ends_on?: string;
  }) =>
    fetchApi<{ assignment: ClientOperationAssignment }>(`/api/v1/clients/${clientId}/operation_assignments`, {
      method: 'POST',
      body: JSON.stringify({ assignment: data }),
    }),

  updateClientOperationAssignment: (assignmentId: number, data: Partial<{
    auto_generate: boolean;
    assignment_status: 'active' | 'paused';
    starts_on: string | null;
    ends_on: string | null;
  }>) =>
    fetchApi<{ assignment: ClientOperationAssignment }>(`/api/v1/client_operation_assignments/${assignmentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ assignment: data }),
    }),

  // Operation Cycles
  getClientOperationCycles: (
    clientId: number,
    params?: {
      page?: number;
      per_page?: number;
    }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    const query = searchParams.toString();
    return fetchApi<OperationCyclesResponse>(`/api/v1/clients/${clientId}/operation_cycles${query ? `?${query}` : ''}`);
  },

  generateOperationCycle: (clientId: number, data: {
    operation_template_id?: number;
    client_operation_assignment_id?: number;
    period_start?: string;
    period_end?: string;
  }) =>
    fetchApi<{ operation_cycle: OperationCycle }>(`/api/v1/clients/${clientId}/operation_cycles/generate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getOperationCycle: (cycleId: number) =>
    fetchApi<{ operation_cycle: OperationCycle }>(`/api/v1/operation_cycles/${cycleId}`),

  // Operation Tasks
  updateOperationTask: (taskId: number, data: Partial<{
    status: 'not_started' | 'in_progress' | 'blocked' | 'done';
    assigned_to_id: number | null;
    due_at: string | null;
    notes: string;
    evidence_note: string;
  }>) =>
    fetchApi<{ operation_task: OperationTaskItem }>(`/api/v1/operation_tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ operation_task: data }),
    }),

  completeOperationTask: (taskId: number, evidenceNote?: string) =>
    fetchApi<{ operation_task: OperationTaskItem }>(`/api/v1/operation_tasks/${taskId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ evidence_note: evidenceNote }),
    }),

  reopenOperationTask: (taskId: number) =>
    fetchApi<{ operation_task: OperationTaskItem }>(`/api/v1/operation_tasks/${taskId}/reopen`, {
      method: 'POST',
    }),

  getOperationTasks: (params?: {
    status?: 'not_started' | 'in_progress' | 'blocked' | 'done';
    assigned_to_id?: number;
    client_id?: number;
    due_filter?: 'overdue' | 'today' | 'upcoming';
    include_done?: boolean;
    limit?: number;
    page?: number;
    per_page?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.assigned_to_id) searchParams.set('assigned_to_id', params.assigned_to_id.toString());
    if (params?.client_id) searchParams.set('client_id', params.client_id.toString());
    if (params?.due_filter) searchParams.set('due_filter', params.due_filter);
    if (params?.include_done !== undefined) searchParams.set('include_done', params.include_done.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    const query = searchParams.toString();
    return fetchApi<OperationTasksResponse>(`/api/v1/operation_tasks${query ? `?${query}` : ''}`);
  },

  getMyOperationTasks: (params?: {
    status?: 'not_started' | 'in_progress' | 'blocked' | 'done';
    due_filter?: 'overdue' | 'today' | 'upcoming';
    include_done?: boolean;
    limit?: number;
    page?: number;
    per_page?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.due_filter) searchParams.set('due_filter', params.due_filter);
    if (params?.include_done !== undefined) searchParams.set('include_done', params.include_done.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    const query = searchParams.toString();
    return fetchApi<OperationTasksResponse>(`/api/v1/operation_tasks/my_tasks${query ? `?${query}` : ''}`);
  },

  // Tax Returns
  getTaxReturns: (params?: { page?: number; search?: string; stage?: string; year?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.stage) searchParams.set('stage', params.stage);
    if (params?.year) searchParams.set('year', params.year.toString());
    const query = searchParams.toString();
    return fetchApi<TaxReturnsResponse>(`/api/v1/tax_returns${query ? `?${query}` : ''}`);
  },

  getTaxReturn: (id: number) =>
    fetchApi<{ tax_return: TaxReturnDetail }>(`/api/v1/tax_returns/${id}`),

  updateTaxReturn: (id: number, data: Record<string, unknown>) =>
    fetchApi<{ tax_return: TaxReturnSummary }>(`/api/v1/tax_returns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ tax_return: data }),
    }),

  assignTaxReturn: (id: number, userId: number) =>
    fetchApi<{ message: string; tax_return: TaxReturnSummary }>(
      `/api/v1/tax_returns/${id}/assign`,
      {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      }
    ),

  // Income Sources (nested under tax returns)
  getIncomeSources: (taxReturnId: number) =>
    fetchApi<{ income_sources: IncomeSource[] }>(`/api/v1/tax_returns/${taxReturnId}/income_sources`),

  createIncomeSource: (taxReturnId: number, data: { source_type: string; payer_name: string; notes?: string }) =>
    fetchApi<{ income_source: IncomeSource }>(`/api/v1/tax_returns/${taxReturnId}/income_sources`, {
      method: 'POST',
      body: JSON.stringify({ income_source: data }),
    }),

  updateIncomeSource: (taxReturnId: number, id: number, data: { source_type?: string; payer_name?: string; notes?: string }) =>
    fetchApi<{ income_source: IncomeSource }>(`/api/v1/tax_returns/${taxReturnId}/income_sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ income_source: data }),
    }),

  deleteIncomeSource: (taxReturnId: number, id: number) =>
    fetchApi<void>(`/api/v1/tax_returns/${taxReturnId}/income_sources/${id}`, {
      method: 'DELETE',
    }),

  // Users (for assignment dropdowns)
  getUsers: () =>
    fetchApi<{ users: UserSummary[] }>('/api/v1/users'),

  // Admin: Workflow Stages
  getAdminWorkflowStages: () =>
    fetchApi<{ workflow_stages: AdminWorkflowStage[] }>('/api/v1/admin/workflow_stages'),

  createWorkflowStage: (data: { name: string; slug: string; color?: string; notify_client?: boolean }) =>
    fetchApi<{ workflow_stage: AdminWorkflowStage }>('/api/v1/admin/workflow_stages', {
      method: 'POST',
      body: JSON.stringify({ workflow_stage: data }),
    }),

  updateWorkflowStage: (id: number, data: Partial<{ name: string; slug: string; color: string; notify_client: boolean; is_active: boolean }>) =>
    fetchApi<{ workflow_stage: AdminWorkflowStage }>(`/api/v1/admin/workflow_stages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ workflow_stage: data }),
    }),

  deleteWorkflowStage: (id: number) =>
    fetchApi<{ message: string }>(`/api/v1/admin/workflow_stages/${id}`, {
      method: 'DELETE',
    }),

  reorderWorkflowStages: (stageIds: number[]) =>
    fetchApi<{ workflow_stages: AdminWorkflowStage[] }>('/api/v1/admin/workflow_stages/reorder', {
      method: 'POST',
      body: JSON.stringify({ stage_ids: stageIds }),
    }),

  // Workflow Events (Activity)
  getWorkflowEvents: (queryString?: string) =>
    fetchApi<WorkflowEventsResponse>(`/api/v1/workflow_events${queryString ? `?${queryString}` : ''}`),

  // Audit Logs
  getAuditLogs: (params?: {
    page?: number;
    per_page?: number;
    auditable_type?: string;
    action_type?: string;
    user_id?: number;
    client_id?: number;
    start_date?: string;
    end_date?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.auditable_type) searchParams.set('auditable_type', params.auditable_type);
    if (params?.action_type) searchParams.set('action_type', params.action_type);
    if (params?.user_id) searchParams.set('user_id', params.user_id.toString());
    if (params?.client_id) searchParams.set('client_id', params.client_id.toString());
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    const query = searchParams.toString();
    return fetchApi<AuditLogsResponse>(`/api/v1/audit_logs${query ? `?${query}` : ''}`);
  },

  // Admin: User Management
  getAdminUsers: () =>
    fetchApi<{ users: AdminUser[] }>('/api/v1/admin/users'),

  inviteUser: (data: { email: string; first_name: string; last_name?: string; role: 'admin' | 'employee' }) =>
    fetchApi<{ user: AdminUser }>('/api/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUserRole: (id: number, role: 'admin' | 'employee') =>
    fetchApi<{ user: AdminUser }>(`/api/v1/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  deleteUser: (id: number) =>
    fetchApi<void>(`/api/v1/admin/users/${id}`, {
      method: 'DELETE',
    }),

  // Time Tracking
  getTimeEntries: (params?: {
    page?: number;
    date?: string;
    week?: string;
    start_date?: string;
    end_date?: string;
    time_category_id?: number;
    client_id?: number;
    user_id?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.date) searchParams.set('date', params.date);
    if (params?.week) searchParams.set('week', params.week);
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    if (params?.time_category_id) searchParams.set('time_category_id', params.time_category_id.toString());
    if (params?.client_id) searchParams.set('client_id', params.client_id.toString());
    if (params?.user_id) searchParams.set('user_id', params.user_id.toString());
    const query = searchParams.toString();
    return fetchApi<TimeEntriesResponse>(`/api/v1/time_entries${query ? `?${query}` : ''}`);
  },

  createTimeEntry: (data: {
    work_date: string;
    start_time: string;
    end_time: string;
    description?: string;
    time_category_id?: number;
    client_id?: number;
    tax_return_id?: number;
    break_minutes?: number | null;
    service_type_id?: number;
    service_task_id?: number;
    operation_task_id?: number;
  }) =>
    fetchApi<{ time_entry: TimeEntry }>('/api/v1/time_entries', (() => {
      const { operation_task_id, ...timeEntryData } = data;
      return {
        method: 'POST',
        body: JSON.stringify({ time_entry: timeEntryData, operation_task_id }),
      };
    })()),

  updateTimeEntry: (id: number, data: Partial<{
    work_date: string;
    start_time: string;
    end_time: string;
    description: string;
    time_category_id: number;
    client_id: number;
    tax_return_id: number;
    break_minutes: number | null;
    service_type_id: number;
    service_task_id: number;
    operation_task_id: number;
  }>) =>
    fetchApi<{ time_entry: TimeEntry }>(`/api/v1/time_entries/${id}`, (() => {
      const { operation_task_id, ...timeEntryData } = data;
      return {
        method: 'PATCH',
        body: JSON.stringify({ time_entry: timeEntryData, operation_task_id }),
      };
    })()),

  deleteTimeEntry: (id: number) =>
    fetchApi<void>(`/api/v1/time_entries/${id}`, {
      method: 'DELETE',
    }),

  getTimeCategories: () =>
    fetchApi<{ time_categories: TimeCategory[] }>('/api/v1/time_categories'),

  // Admin: Time Categories
  getAdminTimeCategories: () =>
    fetchApi<{ time_categories: AdminTimeCategory[] }>('/api/v1/admin/time_categories'),

  createTimeCategory: (data: { name: string; description?: string }) =>
    fetchApi<{ time_category: AdminTimeCategory }>('/api/v1/admin/time_categories', {
      method: 'POST',
      body: JSON.stringify({ time_category: data }),
    }),

  updateTimeCategory: (id: number, data: Partial<{ name: string; description: string; is_active: boolean }>) =>
    fetchApi<{ time_category: AdminTimeCategory }>(`/api/v1/admin/time_categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ time_category: data }),
    }),

  deleteTimeCategory: (id: number) =>
    fetchApi<void>(`/api/v1/admin/time_categories/${id}`, {
      method: 'DELETE',
    }),

  // Service Types (for dropdowns)
  getServiceTypes: () =>
    fetchApi<ServiceTypesResponse>('/api/v1/service_types'),

  // Admin: Service Types
  getAdminServiceTypes: () =>
    fetchApi<ServiceTypesResponse>('/api/v1/admin/service_types'),

  createServiceType: (data: { name: string; description?: string; color?: string }) =>
    fetchApi<{ service_type: ServiceType }>('/api/v1/admin/service_types', {
      method: 'POST',
      body: JSON.stringify({ service_type: data }),
    }),

  updateServiceType: (id: number, data: Partial<{ name: string; description: string; color: string; is_active: boolean }>) =>
    fetchApi<{ service_type: ServiceType }>(`/api/v1/admin/service_types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ service_type: data }),
    }),

  deleteServiceType: (id: number) =>
    fetchApi<void>(`/api/v1/admin/service_types/${id}`, {
      method: 'DELETE',
    }),

  reorderServiceTypes: (positions: Array<{ id: number; position: number }>) =>
    fetchApi<void>('/api/v1/admin/service_types/reorder', {
      method: 'POST',
      body: JSON.stringify({ positions }),
    }),

  // Admin: Service Tasks
  getServiceTasks: (serviceTypeId: number) =>
    fetchApi<{ tasks: ServiceTask[] }>(`/api/v1/admin/service_types/${serviceTypeId}/tasks`),

  createServiceTask: (serviceTypeId: number, data: { name: string; description?: string }) =>
    fetchApi<{ task: ServiceTask }>(`/api/v1/admin/service_types/${serviceTypeId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ service_task: data }),
    }),

  updateServiceTask: (serviceTypeId: number, taskId: number, data: Partial<{ name: string; description: string; is_active: boolean }>) =>
    fetchApi<{ task: ServiceTask }>(`/api/v1/admin/service_types/${serviceTypeId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ service_task: data }),
    }),

  deleteServiceTask: (serviceTypeId: number, taskId: number) =>
    fetchApi<void>(`/api/v1/admin/service_types/${serviceTypeId}/tasks/${taskId}`, {
      method: 'DELETE',
    }),

  reorderServiceTasks: (serviceTypeId: number, positions: Array<{ id: number; position: number }>) =>
    fetchApi<void>(`/api/v1/admin/service_types/${serviceTypeId}/tasks/reorder`, {
      method: 'POST',
      body: JSON.stringify({ positions }),
    }),

  // Admin: System Settings
  getSystemSettings: () =>
    fetchApi<Record<string, string>>('/api/v1/admin/settings'),

  updateSystemSettings: (settings: Record<string, string>) =>
    fetchApi<Record<string, string>>('/api/v1/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  // Documents
  getDocuments: (taxReturnId: number) =>
    fetchApi<Document[]>(`/api/v1/tax_returns/${taxReturnId}/documents`),

  presignDocumentUpload: (taxReturnId: number, filename: string, contentType: string, fileSize?: number) =>
    fetchApi<PresignResponse>(`/api/v1/tax_returns/${taxReturnId}/documents/presign`, {
      method: 'POST',
      body: JSON.stringify({ filename, content_type: contentType, file_size: fileSize }),
    }),

  registerDocument: (taxReturnId: number, data: {
    filename: string;
    s3_key: string;
    content_type: string;
    file_size: number;
    document_type?: string;
  }) =>
    fetchApi<{ document: Document }>(`/api/v1/tax_returns/${taxReturnId}/documents`, {
      method: 'POST',
      body: JSON.stringify({ document: data }),
    }),

  getDocumentDownloadUrl: (taxReturnId: number, documentId: number) =>
    fetchApi<DownloadResponse>(`/api/v1/tax_returns/${taxReturnId}/documents/${documentId}/download`),

  deleteDocument: (taxReturnId: number, documentId: number) =>
    fetchApi<void>(`/api/v1/tax_returns/${taxReturnId}/documents/${documentId}`, {
      method: 'DELETE',
    }),

  // Employee Scheduling
  getSchedules: (params?: {
    week?: string;
    start_date?: string;
    end_date?: string;
    user_id?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.week) searchParams.set('week', params.week);
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    if (params?.user_id) searchParams.set('user_id', params.user_id.toString());
    const query = searchParams.toString();
    return fetchApi<SchedulesResponse>(`/api/v1/schedules${query ? `?${query}` : ''}`);
  },

  getMySchedule: () =>
    fetchApi<{ schedules: Schedule[] }>('/api/v1/schedules/my_schedule'),

  createSchedule: (data: {
    user_id: number;
    work_date: string;
    start_time: string;
    end_time: string;
    notes?: string;
  }) =>
    fetchApi<{ schedule: Schedule }>('/api/v1/schedules', {
      method: 'POST',
      body: JSON.stringify({ schedule: data }),
    }),

  bulkCreateSchedules: (schedules: Array<{
    user_id: number;
    work_date: string;
    start_time: string;
    end_time: string;
    notes?: string;
  }>) =>
    fetchApi<{ schedules: Schedule[] }>('/api/v1/schedules/bulk_create', {
      method: 'POST',
      body: JSON.stringify({ schedules }),
    }),

  updateSchedule: (id: number, data: Partial<{
    user_id: number;
    work_date: string;
    start_time: string;
    end_time: string;
    notes: string;
  }>) =>
    fetchApi<{ schedule: Schedule }>(`/api/v1/schedules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ schedule: data }),
    }),

  deleteSchedule: (id: number) =>
    fetchApi<void>(`/api/v1/schedules/${id}`, {
      method: 'DELETE',
    }),

  clearWeekSchedules: (week: string, userId?: number) => {
    const searchParams = new URLSearchParams();
    searchParams.set('week', week);
    if (userId) searchParams.set('user_id', userId.toString());
    return fetchApi<{ message: string }>(`/api/v1/schedules/clear_week?${searchParams.toString()}`, {
      method: 'DELETE',
    });
  },

  // Schedule Time Presets (for schedule form)
  getScheduleTimePresets: () =>
    fetchApi<ScheduleTimePresetsResponse>('/api/v1/schedule_time_presets'),

  // Schedule Time Presets Admin (CRUD)
  getAdminScheduleTimePresets: () =>
    fetchApi<ScheduleTimePresetsResponse>('/api/v1/admin/schedule_time_presets'),

  createScheduleTimePreset: (data: { label: string; start_time: string; end_time: string }) =>
    fetchApi<{ preset: ScheduleTimePreset }>('/api/v1/admin/schedule_time_presets', {
      method: 'POST',
      body: JSON.stringify({ preset: data }),
    }),

  updateScheduleTimePreset: (id: number, data: Partial<{ label: string; start_time: string; end_time: string; position: number; active: boolean }>) =>
    fetchApi<{ preset: ScheduleTimePreset }>(`/api/v1/admin/schedule_time_presets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ preset: data }),
    }),

  deleteScheduleTimePreset: (id: number) =>
    fetchApi<void>(`/api/v1/admin/schedule_time_presets/${id}`, {
      method: 'DELETE',
    }),

  reorderScheduleTimePresets: (positions: Array<{ id: number; position: number }>) =>
    fetchApi<{ success: boolean }>('/api/v1/admin/schedule_time_presets/reorder', {
      method: 'POST',
      body: JSON.stringify({ positions }),
    }),
};
