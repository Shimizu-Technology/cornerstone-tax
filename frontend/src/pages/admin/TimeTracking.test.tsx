import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TimeTracking from './TimeTracking'
import { formatDateISO } from '../../lib/dateUtils'

const apiMocks = vi.hoisted(() => ({
  getTimeEntries: vi.fn(),
  getTimeCategories: vi.fn(),
  getClients: vi.fn(),
  getClientOptions: vi.fn(),
  getServiceTypes: vi.fn(),
  createTimeEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
  getUsers: vi.fn(),
  getCurrentUser: vi.fn(),
  getPendingApprovals: vi.fn(),
  getTimePeriodLockStatus: vi.fn(),
  getHoursReport: vi.fn(),
  downloadHoursReport: vi.fn(),
  getWorkLineSuggestions: vi.fn(),
  getUnassignedTime: vi.fn(),
  getTimeEntry: vi.fn(),
}))

vi.mock('../../lib/api', () => ({ api: apiMocks }))
vi.mock('../../components/ui/MotionComponents', () => ({
  FadeUp: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('../../components/ui/FadeIn', () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('../../components/time-tracking/ClockInOutCard', () => ({ default: () => null }))
vi.mock('../../components/time-tracking/ApprovalQueue', () => ({ default: () => null }))
vi.mock('../../components/time-tracking/WhosWorking', () => ({ default: () => null }))
vi.mock('../../components/time-tracking/ReportExportActions', () => ({ default: () => null }))

const successfulReport = {
  start_date: '2026-09-01',
  end_date: '2026-09-21',
  context_start_date: '2026-08-30',
  context_end_date: '2026-09-26',
  generated_at: '2026-09-21T00:00:00Z',
  filters: {},
  overtime_policy: { daily_threshold_hours: 8, weekly_threshold_hours: 40 },
  ready: true,
  quality: {
    status: 'clear',
    flagged_entries_count: 0,
    uncategorized_count: 0,
    missing_client_count: 0,
    missing_description_count: 0,
    long_shift_count: 0,
    overlapping_entry_count: 0,
    long_shift_threshold_hours: 12,
  },
  finalization: {
    status: 'not_finalized',
    label: 'Not finalized',
    selected_days: 21,
    finalized_days: 0,
    locks: [],
  },
  summary: {
    employee_count: 1,
    total_hours: 130.3,
    regular_hours: 116.6,
    overtime_hours: 13.7,
    break_hours: 0,
    entries_count: 40,
    pending_count: 0,
    denied_count: 0,
    pending_overtime_count: 0,
    denied_overtime_count: 0,
    open_clock_count: 0,
  },
  employees: [],
}

function renderPage(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <TimeTracking />
    </MemoryRouter>
  )
}

describe('TimeTracking reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getTimeEntries.mockResolvedValue({ data: { time_entries: [], summary: { total_hours: 0, total_break_hours: 0, entry_count: 0 } } })
    apiMocks.getTimeCategories.mockResolvedValue({ data: { time_categories: [] } })
    apiMocks.getClients.mockResolvedValue({ data: { clients: [] } })
    apiMocks.getClientOptions.mockResolvedValue({ data: { clients: [] } })
    apiMocks.getServiceTypes.mockResolvedValue({ data: { service_types: [] } })
    apiMocks.getUsers.mockResolvedValue({ data: { users: [] } })
    apiMocks.getCurrentUser.mockResolvedValue({ data: { user: { id: 1, is_admin: true } } })
    apiMocks.getPendingApprovals.mockResolvedValue({ data: { summary: null } })
    apiMocks.getTimePeriodLockStatus.mockResolvedValue({ data: { locked: false, lock: null } })
  })

  it('requests long ranges and clears stale totals when a report fails', async () => {
    apiMocks.getHoursReport
      .mockResolvedValueOnce({ data: successfulReport })
      .mockResolvedValueOnce({ error: 'Unable to load report' })

    renderPage('/admin/time?tab=reports&start_date=2026-09-01&end_date=2026-09-21')

    expect(await screen.findByText('130.30h')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-12-31' } })

    await waitFor(() => {
      expect(apiMocks.getHoursReport).toHaveBeenLastCalledWith(expect.objectContaining({
        start_date: '2026-09-01',
        end_date: '2026-12-31',
      }))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load report')
    expect(screen.queryByText('130.30h')).not.toBeInTheDocument()
  })

  it('does not let an older long-running report replace newer filter results', async () => {
    let resolveFirstReport: (value: { data: typeof successfulReport }) => void = () => undefined
    const firstReport = new Promise<{ data: typeof successfulReport }>((resolve) => {
      resolveFirstReport = resolve
    })
    const newerReport = {
      ...successfulReport,
      end_date: '2026-12-31',
      summary: { ...successfulReport.summary, total_hours: 55.5, entries_count: 12 },
    }
    apiMocks.getHoursReport
      .mockReturnValueOnce(firstReport)
      .mockResolvedValueOnce({ data: newerReport })

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Reports' }))
    await waitFor(() => expect(apiMocks.getHoursReport).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-12-31' } })
    expect(await screen.findByText('55.50h')).toBeInTheDocument()

    await act(async () => {
      resolveFirstReport({ data: successfulReport })
      await firstReport
    })

    expect(screen.getByText('55.50h')).toBeInTheDocument()
    expect(screen.queryByText('130.30h')).not.toBeInTheDocument()
  })

  it('opens a shareable reports URL with its period, status, and section restored', async () => {
    apiMocks.getHoursReport.mockResolvedValue({ data: successfulReport })

    renderPage('/admin/time?tab=reports&start_date=2026-01-25&end_date=2026-09-21&status=terminated&report_view=people')

    expect(await screen.findByRole('button', { name: /People/ })).toHaveAttribute('aria-current', 'page')
    await waitFor(() => expect(apiMocks.getHoursReport).toHaveBeenCalledWith(expect.objectContaining({
      start_date: '2026-01-25',
      end_date: '2026-09-21',
      status: 'terminated',
    })))
  })

  it('drops report URL filters the controls cannot show', async () => {
    apiMocks.getHoursReport.mockResolvedValue({ data: successfulReport })

    renderPage('/admin/time?tab=reports&start_date=2026-07-01&end_date=2026-07-31&service_type_id=3&time_category_id=9&period_type=quarter')

    await waitFor(() => expect(apiMocks.getHoursReport).toHaveBeenCalled())
    const params = apiMocks.getHoursReport.mock.calls[0][0]
    expect(params).toMatchObject({ service_type_id: 3 })
    expect(params).not.toHaveProperty('time_category_id')
    expect(params).not.toHaveProperty('period_type')
  })

  it('drops a task filter that has no category', async () => {
    apiMocks.getHoursReport.mockResolvedValue({ data: successfulReport })

    renderPage('/admin/time?tab=reports&start_date=2026-07-01&end_date=2026-07-31&service_task_id=7&time_category_id=9')

    await waitFor(() => expect(apiMocks.getHoursReport).toHaveBeenCalled())
    const params = apiMocks.getHoursReport.mock.calls[0][0]
    expect(params).not.toHaveProperty('service_task_id')
    expect(params).toMatchObject({ time_category_id: 9 })
  })

  it('restores category, task and period report filters from the URL', async () => {
    apiMocks.getHoursReport.mockResolvedValue({ data: successfulReport })

    renderPage('/admin/time?tab=reports&start_date=2026-07-01&end_date=2026-07-31&service_type_id=3&service_task_id=7&period_type=quarter&period_start=2026-07-01')

    await waitFor(() => expect(apiMocks.getHoursReport).toHaveBeenCalledWith(expect.objectContaining({
      service_type_id: 3,
      service_task_id: 7,
      period_type: 'quarter',
      period_start: '2026-07-01',
    })))
  })
})

const serviceTypes = [
  {
    id: 2,
    name: 'Payroll',
    description: null,
    color: null,
    position: 2,
    tasks: [
      { id: 21, name: 'Payroll Processing', description: null, position: 1 },
      { id: 22, name: 'Payroll Return Preparation', description: null, position: 2 },
    ],
  },
  {
    id: 1,
    name: 'Bookkeeping',
    description: null,
    color: null,
    position: 1,
    tasks: [
      { id: 12, name: 'Payroll Data Entry', description: null, position: 2 },
      { id: 11, name: 'Bank Reconciliation', description: null, position: 1 },
    ],
  },
]

const clientOptions = [
  { id: 5, name: "MoSa's", client_type: 'business', business_name: "MoSa's", first_name: 'Maria', last_name: 'Santos' },
  { id: 6, name: 'Jose Cruz', client_type: 'individual', business_name: null, first_name: 'Jose', last_name: 'Cruz' },
]

function emptyEntryResponse(entries: unknown[] = []) {
  return { data: { time_entries: entries, summary: { total_hours: 0, total_break_hours: 0, entry_count: entries.length } } }
}

describe('TimeTracking log time', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getTimeEntries.mockResolvedValue(emptyEntryResponse())
    apiMocks.getTimeCategories.mockResolvedValue({ data: { time_categories: [{ id: 9, name: 'Tax Prep', description: null }] } })
    apiMocks.getClientOptions.mockResolvedValue({ data: { clients: clientOptions } })
    apiMocks.getServiceTypes.mockResolvedValue({ data: { service_types: serviceTypes } })
    apiMocks.getUsers.mockResolvedValue({ data: { users: [] } })
    apiMocks.getCurrentUser.mockResolvedValue({ data: { user: { id: 1, is_admin: false } } })
    apiMocks.getPendingApprovals.mockResolvedValue({ data: { summary: null } })
    apiMocks.getTimePeriodLockStatus.mockResolvedValue({ data: { locked: false, lock: null } })
    apiMocks.createTimeEntry.mockResolvedValue({ data: { time_entry: {} } })
    apiMocks.updateTimeEntry.mockResolvedValue({ data: { time_entry: {} } })
    apiMocks.getWorkLineSuggestions.mockResolvedValue({ data: { recent_clients: [], descriptions_by_client: {}, work_details_required_from: null } })
  })

  it('asks for the client, what was done, then the category, with task and period optional', async () => {
    renderPage('/admin/time')
    fireEvent.click(await screen.findByRole('button', { name: 'Log Time' }))

    const editor = within(await screen.findByTestId('work-lines-editor'))
    const labels = [
      editor.getByLabelText('Client', { selector: 'select' }),
      editor.getByLabelText('What I did'),
      editor.getByLabelText(/^Category/),
    ]
    labels.slice(1).forEach((element, index) => {
      expect(labels[index].compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
    expect(editor.getByRole('option', { name: 'No client (unassigned)' })).toBeInTheDocument()
    // Legacy time categories are not offered for new entries.
    expect(editor.queryByRole('option', { name: /Tax Prep/ })).not.toBeInTheDocument()
    // Inputs are 16px on phones so iOS does not zoom.
    expect(editor.getByLabelText('What I did').className).toContain('text-base')
  })

  it('lists businesses before individuals in the client picker', async () => {
    renderPage('/admin/time')
    fireEvent.click(await screen.findByRole('button', { name: 'Log Time' }))

    const clientSelect = await within(await screen.findByTestId('work-lines-editor')).findByLabelText('Client', { selector: 'select' })
    await waitFor(() => expect(within(clientSelect).getAllByRole('option').map(option => option.textContent)).toEqual([
      'No client (unassigned)', "MoSa's", 'Jose Cruz',
    ]))
    expect(within(clientSelect).getAllByRole('group').map(group => group.getAttribute('label'))).toEqual(['Businesses', 'Individuals'])
  })

  it('submits the chosen client, category, task and period as one work line', async () => {
    renderPage('/admin/time')
    fireEvent.click(await screen.findByRole('button', { name: 'Log Time' }))
    const editor = within(await screen.findByTestId('work-lines-editor'))

    await waitFor(() => expect(editor.getAllByRole('option', { name: "MoSa's" }).length).toBeGreaterThan(0))
    fireEvent.change(editor.getByLabelText('Client', { selector: 'select' }), { target: { value: '5' } })
    fireEvent.change(editor.getByLabelText('What I did'), { target: { value: 'July bank rec' } })
    fireEvent.change(editor.getByLabelText(/^Category/), { target: { value: '1' } })
    fireEvent.click(editor.getByRole('button', { name: 'Task and period' }))
    fireEvent.change(editor.getByLabelText(/^Task/), { target: { value: '11' } })
    fireEvent.change(editor.getByLabelText('Period type'), { target: { value: 'month' } })
    fireEvent.change(editor.getByLabelText('Period month'), { target: { value: '7' } })
    fireEvent.change(editor.getByLabelText('Period year'), { target: { value: '2026' } })
    expect(editor.getByText('July 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(apiMocks.createTimeEntry).toHaveBeenCalled())
    const payload = apiMocks.createTimeEntry.mock.calls[0][0]
    expect(payload.work_lines).toEqual([{
      client_id: 5, description: 'July bank rec', service_type_id: 1, service_task_id: 11,
      period_type: 'month', period_start: '2026-07-01', minutes: 540,
    }])
    expect(payload).not.toHaveProperty('time_category_id')
  })

  it('shows and keeps the legacy category when editing an old entry', async () => {
    const legacyEntry = {
      id: 77,
      work_date: formatDateISO(new Date()),
      start_time: '09:00',
      end_time: '10:00',
      formatted_start_time: '9:00 AM',
      formatted_end_time: '10:00 AM',
      hours: 1,
      break_minutes: null,
      description: 'Old work',
      entry_method: 'manual',
      status: 'completed',
      approval_status: 'approved',
      overtime_status: 'none',
      approved_by: null,
      approval_note: null,
      locked_at: null,
      user: { id: 1, email: 'alice@example.com', display_name: 'Alice', full_name: 'Alice Smith' },
      time_category: { id: 9, name: 'Tax Prep' },
      client: { id: 6, name: 'Jose Cruz' },
      tax_return: null,
      service_type: null,
      service_task: null,
      period_type: null,
      period_start: null,
      period_label: null,
      breaks: [],
      work_lines: [{ id: 1, position: 0, client: { id: 6, name: 'Jose Cruz' }, client_label: 'Jose Cruz', description: 'Old work', service_type: null, service_task: null, category_label: 'Tax Prep (legacy)', period_type: null, period_start: null, period_label: null, hours: 1, minutes: 60 }],
    }
    apiMocks.getTimeEntries.mockResolvedValue(emptyEntryResponse([legacyEntry]))

    renderPage('/admin/time')
    expect(await screen.findByTitle(/Tax Prep \(legacy\)/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Jose Cruz'))

    const editor = within(await screen.findByTestId('work-lines-editor'))
    expect(screen.getByText(/Legacy category:/)).toBeInTheDocument()
    expect((editor.getByLabelText('Client', { selector: 'select' }) as HTMLSelectElement).value).toBe('6')
    expect((editor.getByLabelText('What I did') as HTMLInputElement).value).toBe('Old work')

    // Nothing changed: the modal closes without sending anything, so neither
    // the legacy category nor the clock times can be rewritten.
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    await waitFor(() => expect(screen.queryByTestId('work-lines-editor')).not.toBeInTheDocument())
    expect(apiMocks.updateTimeEntry).not.toHaveBeenCalled()

    // A description-only edit sends just the work lines, no attendance fields.
    fireEvent.click(screen.getByText('Jose Cruz'))
    const reopened = within(await screen.findByTestId('work-lines-editor'))
    fireEvent.change(reopened.getByLabelText('What I did'), { target: { value: 'Old work, filed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    await waitFor(() => expect(apiMocks.updateTimeEntry).toHaveBeenCalled())
    const payload = apiMocks.updateTimeEntry.mock.calls[0][1]
    expect(Object.keys(payload)).toEqual(['work_lines'])
    expect(payload.work_lines).toEqual([expect.objectContaining({ client_id: 6, description: 'Old work, filed', minutes: 60 })])
  })

  it('shows the conflict panel when the entry changed elsewhere (409)', async () => {
    const entry = {
      id: 78, work_date: formatDateISO(new Date()), start_time: '09:00', end_time: '10:00', formatted_start_time: '9:00 AM', formatted_end_time: '10:00 AM',
      hours: 1, version: 3, break_minutes: null, description: 'Old work', entry_method: 'manual', status: 'completed', approval_status: 'approved',
      overtime_status: 'none', approved_by: null, approval_note: null, locked_at: null,
      user: { id: 1, email: 'alice@example.com', display_name: 'Alice', full_name: 'Alice Smith' },
      time_category: null, client: { id: 6, name: 'Jose Cruz' }, tax_return: null, service_type: null, service_task: null,
      period_type: null, period_start: null, period_label: null, breaks: [],
      work_lines: [{ id: 1, position: 0, client: { id: 6, name: 'Jose Cruz' }, client_label: 'Jose Cruz', description: 'Old work', service_type: null, service_task: null, category_label: null, period_type: null, period_start: null, period_label: null, hours: 1, minutes: 60 }],
    }
    apiMocks.getTimeEntries.mockResolvedValue(emptyEntryResponse([entry]))
    apiMocks.updateTimeEntry.mockResolvedValueOnce({ status: 409, code: 'version_conflict', error: 'Changed elsewhere' })
    apiMocks.getTimeEntry.mockResolvedValue({ data: { time_entry: { ...entry, version: 5, work_lines: [{ ...entry.work_lines[0], description: 'Saved in another tab' }] } } })

    renderPage('/admin/time')
    fireEvent.click(await screen.findByText('Jose Cruz'))
    const editor = within(await screen.findByTestId('work-lines-editor'))
    fireEvent.change(editor.getByLabelText('What I did'), { target: { value: 'New note' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    const callsBefore = apiMocks.getTimeEntries.mock.calls.length
    expect(await screen.findByText('This entry was changed elsewhere after you opened it.')).toBeInTheDocument()
    expect(apiMocks.updateTimeEntry.mock.calls[0][3]).toEqual({ expectedVersion: 3 })
    // Refetched straight away: the entry list and the panel's "saved now" lines.
    await waitFor(() => expect(apiMocks.getTimeEntries.mock.calls.length).toBeGreaterThan(callsBefore))
    expect(apiMocks.getTimeEntry).toHaveBeenCalledWith(78)
    expect(await screen.findByLabelText('Lines saved now')).toHaveTextContent('Saved in another tab')
    expect(screen.getByRole('button', { name: 'Discard my lines' })).toBeInTheDocument()
  })

  it('shows a retry when categories or clients fail to load', async () => {
    apiMocks.getServiceTypes
      .mockResolvedValueOnce({ error: 'Server error' })
      .mockResolvedValueOnce({ data: { service_types: serviceTypes } })

    renderPage('/admin/time')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't load categories")
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(apiMocks.getServiceTypes).toHaveBeenCalledTimes(2)
    // Clients loaded the first time and are not refetched.
    expect(apiMocks.getClientOptions).toHaveBeenCalledTimes(1)
  })
})

describe('TimeTracking unassigned time', () => {
  it('opens the entry editor from the Unassigned tab', async () => {
    vi.clearAllMocks()
    const entry = {
      id: 88, work_date: '2026-11-16', start_time: '09:00', end_time: '17:00', formatted_start_time: '9:00 AM', formatted_end_time: '5:00 PM',
      hours: 8, break_minutes: null, description: null, entry_method: 'clock', status: 'completed', approval_status: null,
      overtime_status: 'none', approved_by: null, approval_note: null, locked_at: null,
      user: { id: 2, email: 'sam@example.com', display_name: 'Sam', full_name: 'Sam Staff' },
      time_category: null, client: null, tax_return: null, service_type: null, service_task: null, breaks: [],
      work_lines: [{ id: 5, position: 0, client: null, client_label: 'Unassigned', description: null, minutes: 480, hours: 8 }],
      line_issues: [{ id: 5, missing: ['client'] }],
    }
    apiMocks.getTimeEntries.mockResolvedValue({ data: { time_entries: [], summary: { total_hours: 0, total_break_hours: 0, entry_count: 0 } } })
    apiMocks.getTimeCategories.mockResolvedValue({ data: { time_categories: [] } })
    apiMocks.getClientOptions.mockResolvedValue({ data: { clients: [] } })
    apiMocks.getServiceTypes.mockResolvedValue({ data: { service_types: [] } })
    apiMocks.getUsers.mockResolvedValue({ data: { users: [] } })
    apiMocks.getCurrentUser.mockResolvedValue({ data: { user: { id: 1, is_admin: true } } })
    apiMocks.getPendingApprovals.mockResolvedValue({ data: { summary: null } })
    apiMocks.getTimePeriodLockStatus.mockResolvedValue({ data: { locked: false, lock: null } })
    apiMocks.getWorkLineSuggestions.mockResolvedValue({ data: { recent_clients: [], descriptions_by_client: {}, work_details_required_from: null } })
    apiMocks.getUnassignedTime.mockResolvedValue({ data: {
      time_entries: [entry],
      summary: { entry_count: 1, hours: 8, by_user: [], cutover_date: null },
      pagination: { current_page: 1, per_page: 50, total_count: 1, total_pages: 1 },
    } })

    renderPage('/admin/time?tab=unassigned')
    fireEvent.click(await screen.findByRole('button', { name: /^Fix Sam Staff/ }))

    expect(await screen.findByRole('heading', { name: 'Edit Time Entry' })).toBeInTheDocument()
  })
})
