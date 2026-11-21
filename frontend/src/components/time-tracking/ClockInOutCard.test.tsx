import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClockInOutCard from './ClockInOutCard'

const apiMock = vi.hoisted(() => ({
  getClockStatus: vi.fn(),
  clockOut: vi.fn(),
  clockIn: vi.fn(),
  startBreak: vi.fn(),
  endBreak: vi.fn(),
  getServiceTypes: vi.fn(),
  getClientOptions: vi.fn(),
  getWorkLineSuggestions: vi.fn(),
}))
vi.mock('../../lib/api', () => ({ api: apiMock }))
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => ({ children, ...props }: { children?: ReactNode }) => <div {...(props as object)}>{children}</div> }),
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

const serviceTypes = [
  { id: 1, name: 'Bookkeeping', description: null, color: null, position: 1, tasks: [{ id: 11, name: 'Bank Reconciliation', description: null, position: 1 }] },
  { id: 2, name: 'Payroll', description: null, color: null, position: 2, tasks: [{ id: 21, name: 'Payroll Processing', description: null, position: 1 }] },
]

const clockedIn = {
  clocked_in: true,
  status: 'clocked_in',
  entry_id: 42,
  work_date: '2026-12-01',
  work_details: {
    client: { id: 5, name: "MoSa's" },
    service_type: { id: 1, name: 'Bookkeeping' },
    service_task: { id: 11, name: 'Bank Reconciliation' },
    time_category: null,
    period_type: null,
    period_start: null,
    description: null,
  },
  clock_in_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  elapsed_minutes: 120,
  break_minutes: 0,
  active_break: false,
  active_break_started_at: null,
  breaks: [],
  schedule: null,
  can_clock_in: false,
  clock_in_blocked_reason: 'already_clocked_in',
}

async function openClockOut() {
  render(<ClockInOutCard />)
  fireEvent.click((await screen.findAllByRole('button', { name: /Clock Out/ }))[0])
  const sheet = within(await screen.findByRole('dialog', { name: 'Clock out' }))
  await waitFor(() => expect(sheet.getAllByRole('option', { name: 'Payroll' }).length).toBeGreaterThan(0))
  return sheet
}

function submitClockOut() {
  const buttons = screen.getAllByRole('button', { name: /^Clock Out/ })
  fireEvent.click(buttons[buttons.length - 1])
}

describe('ClockInOutCard clock-out', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getClockStatus.mockResolvedValue({ data: clockedIn })
    apiMock.getServiceTypes.mockResolvedValue({ data: { service_types: serviceTypes } })
    apiMock.getClientOptions.mockResolvedValue({ data: { clients: [{ id: 5, name: "MoSa's" }, { id: 6, name: 'Jose Cruz' }] } })
    apiMock.clockOut.mockResolvedValue({ data: { time_entry: {} } })
    apiMock.getWorkLineSuggestions.mockResolvedValue({ data: { recent_clients: [], descriptions_by_client: {}, work_details_required_from: null } })
  })

  it('starts from the saved details and sends the whole session as one line', async () => {
    const sheet = await openClockOut()

    expect((sheet.getByLabelText('Client', { selector: 'select' }) as HTMLSelectElement).value).toBe('5')
    expect((sheet.getByLabelText(/^Category/) as HTMLSelectElement).value).toBe('1')
    expect(sheet.getByText(/the whole session/)).toBeInTheDocument()

    fireEvent.change(sheet.getByLabelText('Client', { selector: 'select' }), { target: { value: '' } })
    fireEvent.change(sheet.getByLabelText(/^Category/), { target: { value: '2' } })
    fireEvent.change(sheet.getByLabelText('What I did'), { target: { value: 'Payroll run' } })
    submitClockOut()

    await waitFor(() => expect(apiMock.clockOut).toHaveBeenCalled())
    const [, , , entryId, lines] = apiMock.clockOut.mock.calls[0]
    expect(entryId).toBe(42)
    expect(lines).toEqual([
      { client_id: null, description: 'Payroll run', service_type_id: 2, service_task_id: null, period_type: null, period_start: null, minutes: 120 },
    ])
  })

  it('prefills a month period from the Guam work date, not the UTC date', async () => {
    const sheet = await openClockOut()

    // The saved task keeps "Task and period" open.
    expect(sheet.getByRole('button', { name: 'Hide task and period' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.change(sheet.getByLabelText('Period type'), { target: { value: 'month' } })

    expect(sheet.getByText('December 2026')).toBeInTheDocument()
  })

  it('splits the session across clients and blocks clock-out until nothing is left', async () => {
    const sheet = await openClockOut()

    fireEvent.click(sheet.getByRole('button', { name: 'Split across clients' }))
    fireEvent.change(sheet.getByLabelText('Line 2 client'), { target: { value: '6' } })
    fireEvent.change(sheet.getByLabelText('Line 2 time'), { target: { value: '30' } })
    expect(sheet.getByTestId('work-lines-remaining')).toHaveTextContent('30m over')
    expect(screen.getAllByRole('button', { name: /^Clock Out/ }).at(-1)).toBeDisabled()

    fireEvent.click(sheet.getByRole('button', { name: 'Take 30m from line 1' }))
    expect(sheet.getByTestId('work-lines-remaining')).toHaveTextContent('All time is assigned')
    submitClockOut()

    await waitFor(() => expect(apiMock.clockOut).toHaveBeenCalled())
    const lines = apiMock.clockOut.mock.calls[0][4]
    expect(lines.map((line: { client_id: number; minutes: number }) => [line.client_id, line.minutes])).toEqual([[5, 90], [6, 30]])
  })

  it('accepts hours with the unit toggle on a decimal keypad', async () => {
    const sheet = await openClockOut()

    fireEvent.click(sheet.getByRole('button', { name: 'Split across clients' }))
    const time = sheet.getByLabelText('Line 2 time')
    expect(time).toHaveAttribute('inputmode', 'decimal')
    fireEvent.click(within(sheet.getByRole('group', { name: 'Line 2 time unit' })).getByRole('button', { name: 'h' }))
    fireEvent.change(time, { target: { value: '0.5' } })

    expect(sheet.getByText('= 30m (0.50h)')).toBeInTheDocument()
  })

  it('keeps the draft when clock-out fails so the retry sends the same details', async () => {
    apiMock.clockOut.mockResolvedValueOnce({ error: 'Network error' }).mockResolvedValueOnce({ data: { time_entry: {} } })
    const sheet = await openClockOut()

    fireEvent.change(sheet.getByLabelText(/^Category/), { target: { value: '2' } })
    fireEvent.change(sheet.getByLabelText('What I did'), { target: { value: 'Payroll run' } })
    submitClockOut()
    expect((await screen.findAllByText('Network error')).length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('button', { name: /Clock Out/ })[0])
    const reopened = within(await screen.findByRole('dialog', { name: 'Clock out' }))
    expect((reopened.getByLabelText('What I did') as HTMLInputElement).value).toBe('Payroll run')
    submitClockOut()

    await waitFor(() => expect(apiMock.clockOut).toHaveBeenCalledTimes(2))
    expect(apiMock.clockOut.mock.calls[1][4]).toEqual(apiMock.clockOut.mock.calls[0][4])
  })

  it('keeps focus in the field while typing several characters', async () => {
    const sheet = await openClockOut()
    const field = sheet.getByLabelText('What I did') as HTMLInputElement

    field.focus()
    for (const text of ['B', 'Ba', 'Ban', 'Bank', 'Bank r', 'Bank rec']) {
      fireEvent.change(field, { target: { value: text } })
      expect(field).toHaveFocus()
    }
    expect(field.value).toBe('Bank rec')
  })
})

describe('ClockInOutCard without a shift', () => {
  const notClockedIn = {
    ...clockedIn, clocked_in: false, status: null, entry_id: null, work_date: null, work_details: null,
    clock_in_at: null, elapsed_minutes: null, can_clock_in: true, clock_in_blocked_reason: 'no_schedule',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getServiceTypes.mockResolvedValue({ data: { service_types: serviceTypes } })
    apiMock.getClientOptions.mockResolvedValue({ data: { clients: [] } })
    apiMock.getWorkLineSuggestions.mockResolvedValue({ data: null })
  })

  it('says unscheduled time needs approval', async () => {
    apiMock.getClockStatus.mockResolvedValue({ data: notClockedIn })
    render(<ClockInOutCard />)

    expect(await screen.findByText(/your time will be sent for manager approval/)).toBeInTheDocument()
    expect(screen.getByText('No shift scheduled — time will need approval')).toBeInTheDocument()
  })

  it('says it won’t for someone on flexible hours', async () => {
    apiMock.getClockStatus.mockResolvedValue({ data: { ...notClockedIn, flexible_hours: true } })
    render(<ClockInOutCard />)

    expect(await screen.findByText('You’re on flexible hours, so this time won’t need approval.')).toBeInTheDocument()
    expect(screen.getByText('No shift scheduled — flexible hours, no approval needed')).toBeInTheDocument()
    expect(screen.queryByText(/manager approval/)).not.toBeInTheDocument()
  })
})
