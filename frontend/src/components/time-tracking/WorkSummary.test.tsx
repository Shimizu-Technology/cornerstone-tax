import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({ getWorkSummary: vi.fn(), downloadWorkSummary: vi.fn() }))
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

describe('WorkSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getWorkSummary.mockResolvedValue({ data: summary })
    apiMock.downloadWorkSummary.mockResolvedValue({ blob: new Blob(['x']), filename: 'Work_Summary.csv' })
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
})
