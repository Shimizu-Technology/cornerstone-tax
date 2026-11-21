import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({ getWorkSummary: vi.fn(), downloadWorkSummary: vi.fn(), getPayPeriods: vi.fn() }))
vi.mock('../../lib/api', () => ({ api: apiMock }))

import WorkSummary from './WorkSummary'

const summary = {
  user: { id: 2, full_name: 'Sam Staff', email: 's@example.test' },
  start_date: '2026-11-16', end_date: '2026-11-29',
  days: [{ work_date: '2026-11-16', total_minutes: 65, total_hours: 1.08, total_label: '1h 5m', lines: [
    { entry_id: 1, work_date: '2026-11-16', time_range: null, client_id: 5, client_name: 'Alpha Co', system_kind: null, description: 'Bank recs', category: null, task: null, period: null, minutes: 45, hours: 0.75, approval_state: 'approved' },
    { entry_id: 1, work_date: '2026-11-16', time_range: null, client_id: null, client_name: 'Unassigned', system_kind: null, description: 'Meeting', category: null, task: null, period: null, minutes: 20, hours: 0.33, approval_state: 'pending' },
  ] }],
  clients: [
    { client_id: 5, client_name: 'Alpha Co', system_kind: null, minutes: 45, hours: 0.75, label: '45m', lines_count: 1 },
    { client_id: null, client_name: 'Unassigned', system_kind: null, minutes: 20, hours: 0.33, label: '20m', lines_count: 1 },
  ],
  total_minutes: 65, total_hours: 1.08, total_label: '1h 5m',
  counts: { entries: 1, lines: 2, pending_entries: 1, denied_entries: 0, open_clock_entries: 0, unassigned_minutes: 20 },
}

const payPeriods = {
  schedule: 'semi_monthly',
  label: 'Semi-monthly (1st–15th and 16th–end of month)',
  current: { start_date: '2026-11-16', end_date: '2026-11-30' },
  previous: { start_date: '2026-11-01', end_date: '2026-11-15' },
}

describe('WorkSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getWorkSummary.mockResolvedValue({ data: summary })
    apiMock.downloadWorkSummary.mockResolvedValue({ blob: new Blob(['x']), filename: 'Work_Summary.csv' })
    apiMock.getPayPeriods.mockResolvedValue({ data: payPeriods })
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x')
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  it('shows the lines per day and totals per client in hours and minutes', async () => {
    render(<WorkSummary currentUserId={2} isAdmin={false} users={[]} />)

    const totals = within(await screen.findByRole('table'))
    expect(totals.getByRole('row', { name: /Alpha Co 45 0.75 45m/ })).toBeInTheDocument()
    expect(totals.getByRole('row', { name: /Total 65 1.08 1h 5m/ })).toBeInTheDocument()
    expect(screen.getByText('Bank recs')).toBeInTheDocument()
    expect(screen.getByText('1 pending approval')).toBeInTheDocument()
    expect(screen.queryByLabelText('Person')).not.toBeInTheDocument()
  })

  it('lets admins pick a person and downloads CSV for that person', async () => {
    render(<WorkSummary currentUserId={1} isAdmin users={[{ id: 1, full_name: 'Dana Admin' }, { id: 2, full_name: 'Sam Staff' }]} />)
    await screen.findByRole('table')

    fireEvent.change(screen.getByLabelText('Person'), { target: { value: '2' } })
    await waitFor(() => expect(apiMock.getWorkSummary).toHaveBeenLastCalledWith(expect.objectContaining({ user_id: 2 })))
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }))

    await waitFor(() => expect(apiMock.downloadWorkSummary).toHaveBeenCalledWith('csv', expect.objectContaining({ user_id: 2 })))
  })

  it('opens on this pay period and offers the last one, from the pay schedule', async () => {
    render(<WorkSummary currentUserId={2} isAdmin={false} users={[]} />)

    await waitFor(() => expect(apiMock.getWorkSummary).toHaveBeenCalledWith({ start_date: '2026-11-16', end_date: '2026-11-30', user_id: undefined }))
    expect(apiMock.getWorkSummary).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Pay schedule: Semi-monthly (1st–15th and 16th–end of month).')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'last_pay_period' } })
    await waitFor(() => expect(apiMock.getWorkSummary).toHaveBeenLastCalledWith({ start_date: '2026-11-01', end_date: '2026-11-15', user_id: undefined }))
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('2026-11-01')
  })

  it('falls back to the last two weeks when the pay periods fail to load', async () => {
    apiMock.getPayPeriods.mockResolvedValue({ error: 'Network error' })
    render(<WorkSummary currentUserId={2} isAdmin={false} users={[]} />)

    await waitFor(() => expect(apiMock.getWorkSummary).toHaveBeenCalled())
    expect((screen.getByLabelText('Period') as HTMLSelectElement).value).toBe('two_weeks')
    expect(screen.queryByRole('option', { name: /pay period/ })).not.toBeInTheDocument()
  })

  it('keeps a period picked before the pay periods arrive, when they fail to load', async () => {
    let resolve: (value: unknown) => void = () => {}
    apiMock.getPayPeriods.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<WorkSummary currentUserId={2} isAdmin={false} users={[]} />)

    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'last_week' } })
    const from = (screen.getByLabelText('From') as HTMLInputElement).value
    const to = (screen.getByLabelText('To') as HTMLInputElement).value
    resolve({ error: 'Network error' })

    await waitFor(() => expect(apiMock.getWorkSummary).toHaveBeenCalled())
    expect((screen.getByLabelText('Period') as HTMLSelectElement).value).toBe('last_week')
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe(from)
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe(to)
  })

  it('keeps a date typed before the pay periods arrive, and never mixes it with the default', async () => {
    let resolve: (value: unknown) => void = () => {}
    apiMock.getPayPeriods.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<WorkSummary currentUserId={2} isAdmin={false} users={[]} />)

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-12-05' } })
    resolve({ data: payPeriods })

    await waitFor(() => expect(screen.getByText(/^Pay schedule:/)).toBeInTheDocument())
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('2026-12-05')
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Period') as HTMLSelectElement).value).toBe('custom')
    expect(apiMock.getWorkSummary).not.toHaveBeenCalled()
  })

  it('asks for the pay periods again once the loaded ones have ended', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-11-30T02:00:00Z')) // Nov 30 in Guam
      render(<WorkSummary currentUserId={2} isAdmin={false} users={[]} />)
      await waitFor(() => expect(apiMock.getWorkSummary).toHaveBeenCalledWith({ start_date: '2026-11-16', end_date: '2026-11-30', user_id: undefined }))

      vi.setSystemTime(new Date('2026-12-01T02:00:00Z')) // Dec 1 in Guam
      apiMock.getPayPeriods.mockResolvedValue({ data: { ...payPeriods,
        current: { start_date: '2026-12-01', end_date: '2026-12-15' }, previous: { start_date: '2026-11-16', end_date: '2026-11-30' } } })
      fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'last_pay_period' } })

      await waitFor(() => expect(apiMock.getPayPeriods).toHaveBeenCalledTimes(2))
      await waitFor(() => expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('2026-11-16'))
      expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('2026-11-30')
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the totals readable on a phone: spaced columns, minutes only from the sm breakpoint', async () => {
    render(<WorkSummary currentUserId={2} isAdmin={false} users={[]} />)

    const table = await screen.findByRole('table')
    const headers = within(table).getAllByRole('columnheader')
    expect(headers.map((header) => header.textContent)).toEqual(['Client', 'Minutes', 'Hours', 'h:m'])
    // CSS isn't applied in jsdom; the classes are what hides minutes below sm
    // and spaces the numbers (checked visually at 390px and 1440px).
    expect(headers[1]).toHaveClass('hidden', 'sm:table-cell')
    const alphaRow = within(table).getByRole('row', { name: /Alpha Co/ })
    const cells = within(alphaRow).getAllByRole('cell')
    expect(cells[0]).toHaveClass('hidden', 'sm:table-cell')
    cells.slice(1).forEach((cell) => expect(cell).toHaveClass('pl-4', 'whitespace-nowrap'))
    expect(cells.slice(1).map((cell) => cell.textContent)).toEqual(['0.75', '45m'])
  })
})

