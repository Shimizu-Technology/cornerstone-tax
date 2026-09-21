import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TimeTracking from './TimeTracking'

const apiMocks = vi.hoisted(() => ({
  getTimeEntries: vi.fn(),
  getTimeCategories: vi.fn(),
  getClients: vi.fn(),
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
    apiMocks.getUsers.mockResolvedValue({ data: { users: [] } })
    apiMocks.getCurrentUser.mockResolvedValue({ data: { user: { id: 1, is_admin: true } } })
    apiMocks.getPendingApprovals.mockResolvedValue({ data: { summary: null } })
    apiMocks.getTimePeriodLockStatus.mockResolvedValue({ data: { locked: false, lock: null } })
  })

  it('requests long ranges and clears stale totals when a report fails', async () => {
    apiMocks.getHoursReport
      .mockResolvedValueOnce({ data: successfulReport })
      .mockResolvedValueOnce({ error: 'Unable to load report' })

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Reports' }))

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
})
