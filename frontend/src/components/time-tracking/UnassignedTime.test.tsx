import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUnassignedTime = vi.fn()
vi.mock('../../lib/api', () => ({ api: { getUnassignedTime: (...args: unknown[]) => getUnassignedTime(...args) } }))

import UnassignedTime from './UnassignedTime'

const entry = {
  id: 7,
  work_date: '2026-11-16',
  formatted_start_time: '9:00 AM',
  formatted_end_time: '5:00 PM',
  hours: 8,
  entry_method: 'clock',
  approval_status: null,
  locked_at: null,
  user: { id: 3, full_name: 'Sam Staff', email: 's@example.com', display_name: 'Sam' },
  work_lines: [
    { id: 11, position: 0, client_label: 'Alpha Co', description: 'Bank recs', minutes: 360, hours: 6 },
    { id: 12, position: 1, client_label: 'Unassigned', description: null, minutes: 120, hours: 2 },
  ],
  line_issues: [{ id: 11, missing: [] }, { id: 12, missing: ['client', 'description'] }],
}

describe('UnassignedTime', () => {
  beforeEach(() => {
    getUnassignedTime.mockReset()
    getUnassignedTime.mockResolvedValue({
      data: {
        time_entries: [entry],
        summary: { entry_count: 1, hours: 2, by_user: [{ id: 3, name: 'Sam Staff', entry_count: 1, hours: 2 }], cutover_date: null },
        pagination: { current_page: 1, per_page: 50, total_count: 1, total_pages: 1 },
      },
    })
  })

  it('lists unassigned lines and opens the entry editor', async () => {
    const onEditEntry = vi.fn()
    render(<UnassignedTime users={[{ id: 3, full_name: 'Sam Staff' }]} onEditEntry={onEditEntry} />)

    expect(await screen.findByText('no client, no description')).toBeInTheDocument()
    expect(screen.getByText('2.00h in 1 entry')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Fix Sam Staff/ }))
    expect(onEditEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }))
  })

  it('filters by person and date', async () => {
    render(<UnassignedTime users={[{ id: 3, full_name: 'Sam Staff' }]} onEditEntry={vi.fn()} />)
    await screen.findByText('2.00h in 1 entry')

    fireEvent.change(screen.getByLabelText('Person'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-01' } })

    await waitFor(() => expect(getUnassignedTime).toHaveBeenLastCalledWith(expect.objectContaining({ user_id: 3, start_date: '2026-11-01', issue: 'client' })))
  })
})
