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
  })

  it('asks for client, category, task, period and comments in that order', async () => {
    renderPage('/admin/time')
    fireEvent.click(await screen.findByRole('button', { name: 'Log Time' }))

    const fields = within(await screen.findByTestId('time-entry-work-fields'))
    const labels = [
      fields.getByLabelText(/^Client/),
      fields.getByLabelText('Category'),
      fields.getByLabelText('Task'),
      fields.getByLabelText('Period type'),
      fields.getByLabelText('Comments'),
    ]
    labels.slice(1).forEach((element, index) => {
      expect(labels[index].compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
    expect(screen.queryByText('Description')).not.toBeInTheDocument()
    expect(fields.getByRole('option', { name: 'Internal – no client' })).toBeInTheDocument()
    // Legacy time categories are not offered for new entries.
    expect(fields.queryByRole('option', { name: /Tax Prep/ })).not.toBeInTheDocument()
  })

  it('labels clients by business name and sorts them', async () => {
    renderPage('/admin/time')
    fireEvent.click(await screen.findByRole('button', { name: 'Log Time' }))

    const clientSelect = await screen.findByLabelText(/^Client/, { selector: '#log-time-client' })
    await waitFor(() => expect(within(clientSelect).getAllByRole('option').map(option => option.textContent)).toEqual([
      'Internal – no client', 'Jose Cruz', "MoSa's",
    ]))
  })

  it('submits the chosen client, category, task and period', async () => {
    renderPage('/admin/time')
    fireEvent.click(await screen.findByRole('button', { name: 'Log Time' }))
    const fields = within(await screen.findByTestId('time-entry-work-fields'))

    await waitFor(() => expect(fields.getAllByRole('option', { name: "MoSa's" }).length).toBeGreaterThan(0))
    fireEvent.change(fields.getByLabelText(/^Client/, { selector: 'select' }), { target: { value: '5' } })
    fireEvent.change(fields.getByLabelText('Category'), { target: { value: '1' } })
    fireEvent.change(fields.getByLabelText('Task'), { target: { value: '11' } })
    fireEvent.change(fields.getByLabelText('Period type'), { target: { value: 'month' } })
    fireEvent.change(fields.getByLabelText('Period month'), { target: { value: '7' } })
    fireEvent.change(fields.getByLabelText('Period year'), { target: { value: '2026' } })
    expect(fields.getByText('July 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(apiMocks.createTimeEntry).toHaveBeenCalled())
    const payload = apiMocks.createTimeEntry.mock.calls[0][0]
    expect(payload).toMatchObject({
      client_id: 5,
      service_type_id: 1,
      service_task_id: 11,
      period_type: 'month',
      period_start: '2026-07-01',
    })
    expect(payload).not.toHaveProperty('time_category_id')
    expect(payload.description).toBeUndefined()
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
    }
    apiMocks.getTimeEntries.mockResolvedValue(emptyEntryResponse([legacyEntry]))

    renderPage('/admin/time')
    expect(await screen.findByTitle(/Tax Prep \(legacy\)/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Jose Cruz'))

    const fields = within(await screen.findByTestId('time-entry-work-fields'))
    expect(fields.getByText('Tax Prep')).toBeInTheDocument()
    expect(fields.getByText(/Legacy category/)).toBeInTheDocument()
    expect((fields.getByLabelText(/^Client/, { selector: 'select' }) as HTMLSelectElement).value).toBe('6')
    expect((fields.getByLabelText('Comments') as HTMLTextAreaElement).value).toBe('Old work')

    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    await waitFor(() => expect(apiMocks.updateTimeEntry).toHaveBeenCalled())
    const payload = apiMocks.updateTimeEntry.mock.calls[0][1]
    // Nothing in the work details changed, so none of them (and never the legacy category) are sent.
    for (const key of ['time_category_id', 'client_id', 'service_type_id', 'service_task_id', 'period_type', 'period_start', 'description']) {
      expect(payload).not.toHaveProperty(key)
    }
    expect(payload).toMatchObject({ start_time: '09:00', end_time: '10:00' })
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
