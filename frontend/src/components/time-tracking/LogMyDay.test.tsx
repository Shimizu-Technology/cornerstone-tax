import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({
  getTimeEntries: vi.fn(),
  getWorkLineSuggestions: vi.fn(),
  createTimeEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
}))
vi.mock('../../lib/api', () => ({ api: apiMock }))

import LogMyDay from './LogMyDay'

const clients = [{ id: 2, name: 'Alpha Co', client_type: 'business' }, { id: 3, name: 'Beta Co', client_type: 'business' }]

const session = {
  id: 50, work_date: '2026-11-16', start_time: '09:00', end_time: '11:00', formatted_start_time: '9:00 AM', formatted_end_time: '11:00 AM',
  hours: 2, entry_method: 'clock', status: 'completed', approval_status: null, locked_at: null, duration_only: false,
  work_lines: [{ id: 1, position: 0, client: null, client_label: 'Unassigned', description: null, service_type: null, service_task: null, category_label: null, period_type: null, period_start: null, period_label: null, hours: 2, minutes: 120 }],
}

describe('LogMyDay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getWorkLineSuggestions.mockResolvedValue({ data: { recent_clients: [], descriptions_by_client: {}, work_details_required_from: null } })
    apiMock.createTimeEntry.mockResolvedValue({ data: { time_entry: { approval_status: 'pending' } } })
    apiMock.updateTimeEntry.mockResolvedValue({ data: { time_entry: { approval_status: null } } })
  })

  it('logs a day without clock times as one day log', async () => {
    apiMock.getTimeEntries.mockResolvedValue({ data: { time_entries: [] } })
    render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)

    fireEvent.change(await screen.findByLabelText('Work client'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Work description'), { target: { value: 'Bank recs' } })
    fireEvent.change(screen.getByLabelText('Work time'), { target: { value: '45' } })
    fireEvent.keyDown(screen.getByLabelText('Work time'), { key: 'Enter' })
    fireEvent.change(screen.getByLabelText('Line 2 client'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Line 2 time'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log day' }))

    await waitFor(() => expect(apiMock.createTimeEntry).toHaveBeenCalled())
    const payload = apiMock.createTimeEntry.mock.calls[0][0]
    expect(payload).not.toHaveProperty('start_time')
    expect(payload.work_lines.map((line: { client_id: number; minutes: number }) => [line.client_id, line.minutes])).toEqual([[2, 45], [3, 20]])
    expect(await screen.findByText(/pending until an admin approves/)).toBeInTheDocument()
  })

  it('splits a finished clock session and shows the clock time without a client', async () => {
    apiMock.getTimeEntries.mockResolvedValue({ data: { time_entries: [session] } })
    render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)

    expect(await screen.findByText('Clock time without a client')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Clock 9:00 AM–11:00 AM/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.change(screen.getByLabelText('Work client'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Work time'), { target: { value: '90' } })
    expect(screen.getByTestId('work-lines-remaining')).toHaveTextContent('30m left to assign')
    expect(screen.getByRole('button', { name: 'Save session' })).toBeDisabled()

    fireEvent.keyDown(screen.getByLabelText('Work time'), { key: 'Enter' })
    fireEvent.change(screen.getByLabelText('Line 2 client'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save session' }))

    await waitFor(() => expect(apiMock.updateTimeEntry).toHaveBeenCalled())
    expect(apiMock.updateTimeEntry.mock.calls[0][0]).toBe(50)
    expect(apiMock.updateTimeEntry.mock.calls[0][1].work_lines.map((line: { minutes: number }) => line.minutes)).toEqual([90, 30])
  })
})
