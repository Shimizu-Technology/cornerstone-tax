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
  clock_in_at: new Date().toISOString(),
  elapsed_minutes: 5,
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
  const fields = within(await screen.findByTestId('time-entry-work-fields'))
  await waitFor(() => expect(fields.getAllByRole('option', { name: 'Payroll' }).length).toBeGreaterThan(0))
  return fields
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
  })

  it('starts from the saved details and targets the open clock-in', async () => {
    const fields = await openClockOut()

    expect((fields.getByLabelText(/^Client/, { selector: 'select' }) as HTMLSelectElement).value).toBe('5')
    expect((fields.getByLabelText('Task') as HTMLSelectElement).value).toBe('11')

    // Changing the category clears the task; an emptied client is sent as an explicit clear.
    fireEvent.change(fields.getByLabelText(/^Client/, { selector: 'select' }), { target: { value: '' } })
    fireEvent.change(fields.getByLabelText('Category'), { target: { value: '2' } })
    submitClockOut()

    await waitFor(() => expect(apiMock.clockOut).toHaveBeenCalled())
    const [, , details, entryId] = apiMock.clockOut.mock.calls[0]
    expect(entryId).toBe(42)
    expect(details).toEqual({ client_id: null, service_type_id: 2, service_task_id: null, period_type: null, period_start: null })
  })

  it('prefills a month period from the Guam work date, not the UTC date', async () => {
    const fields = await openClockOut()

    fireEvent.change(fields.getByLabelText('Period type'), { target: { value: 'month' } })

    expect(fields.getByText('December 2026')).toBeInTheDocument()
  })

  it('keeps the draft when clock-out fails so the retry sends the same details', async () => {
    apiMock.clockOut.mockResolvedValueOnce({ error: 'Network error' }).mockResolvedValueOnce({ data: { time_entry: {} } })
    const fields = await openClockOut()

    fireEvent.change(fields.getByLabelText('Category'), { target: { value: '2' } })
    fireEvent.change(fields.getByLabelText('Task'), { target: { value: '21' } })
    fireEvent.change(fields.getByLabelText('Comments'), { target: { value: 'Payroll run' } })
    submitClockOut()
    expect((await screen.findAllByText('Network error')).length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('button', { name: /Clock Out/ })[0])
    const reopened = within(await screen.findByTestId('time-entry-work-fields'))
    expect((reopened.getByLabelText('Task') as HTMLSelectElement).value).toBe('21')
    submitClockOut()

    await waitFor(() => expect(apiMock.clockOut).toHaveBeenCalledTimes(2))
    expect(apiMock.clockOut.mock.calls[1][1]).toBe('Payroll run')
    expect(apiMock.clockOut.mock.calls[1][2]).toEqual(apiMock.clockOut.mock.calls[0][2])
  })
})
