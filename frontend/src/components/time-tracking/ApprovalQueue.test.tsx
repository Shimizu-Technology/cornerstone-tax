import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ApprovalQueue from './ApprovalQueue'

const apiMocks = vi.hoisted(() => ({
  getPendingApprovals: vi.fn(),
  getTimeCategories: vi.fn(),
  getUnscheduledOnlyApprovals: vi.fn(),
  approveUnscheduledOnly: vi.fn(),
  getWorkLineSuggestions: vi.fn(),
}))

vi.mock('../../lib/api', () => ({ api: apiMocks }))

const preview = {
  entry_ids: [11, 12, 13],
  count: 3,
  hours: 7.5,
  oldest_work_date: '2026-11-03',
  newest_work_date: '2026-11-10',
  by_user: [
    { id: 1, name: 'Avery Alpha', entry_count: 2, hours: 5 },
    { id: 2, name: 'Casey Clock', entry_count: 1, hours: 2.5 },
  ],
  needs_work_details_count: 1,
}

describe('ApprovalQueue: approve unscheduled-only entries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    apiMocks.getPendingApprovals.mockResolvedValue({ data: { pending_entries: [], summary: null } })
    apiMocks.getTimeCategories.mockResolvedValue({ data: { time_categories: [] } })
    apiMocks.getWorkLineSuggestions.mockResolvedValue({ data: null })
    apiMocks.getUnscheduledOnlyApprovals.mockResolvedValue({ data: preview })
    apiMocks.approveUnscheduledOnly.mockResolvedValue({ data: { approved_count: 2, skipped_count: 1, approved_entry_ids: [11, 12] } })
  })

  it('previews the count per person, then approves exactly the previewed entries on confirm', async () => {
    const onUpdate = vi.fn()
    render(<ApprovalQueue onUpdate={onUpdate} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Approve unscheduled-only entries' }))

    const dialog = await screen.findByRole('dialog', { name: 'Approve unscheduled-only entries' })
    expect(within(dialog).getByText(/3 entries · 7.50h/)).toBeInTheDocument()
    const people = within(within(dialog).getByRole('list', { name: 'Entries by person' })).getAllByRole('listitem').map((row) => row.textContent)
    expect(people).toEqual(['Avery Alpha2 · 5.00h', 'Casey Clock1 · 2.50h'])
    expect(within(dialog).getByText(/1 more still need work details/)).toBeInTheDocument()
    expect(apiMocks.approveUnscheduledOnly).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve 3 entries' }))

    await waitFor(() => expect(apiMocks.approveUnscheduledOnly).toHaveBeenCalledWith([11, 12, 13]))
    expect(await screen.findByText('Approved 2 entries. 1 changed since the preview and stayed in the queue.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Approve unscheduled-only entries' })).not.toBeInTheDocument()
    expect(onUpdate).toHaveBeenCalled()
  })

  it('approves nothing when cancelled', async () => {
    render(<ApprovalQueue />)

    fireEvent.click(await screen.findByRole('button', { name: 'Approve unscheduled-only entries' }))
    const dialog = await screen.findByRole('dialog', { name: 'Approve unscheduled-only entries' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog', { name: 'Approve unscheduled-only entries' })).not.toBeInTheDocument()
    expect(apiMocks.approveUnscheduledOnly).not.toHaveBeenCalled()
  })

  it('says so when nothing qualifies, with the confirm button off', async () => {
    apiMocks.getUnscheduledOnlyApprovals.mockResolvedValue({ data: { ...preview, entry_ids: [], count: 0, hours: 0, by_user: [], needs_work_details_count: 0 } })
    render(<ApprovalQueue />)

    fireEvent.click(await screen.findByRole('button', { name: 'Approve unscheduled-only entries' }))
    const dialog = await screen.findByRole('dialog', { name: 'Approve unscheduled-only entries' })

    expect(within(dialog).getByText('No pending entries are waiting only for a missing schedule.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Approve 0 entries' })).toBeDisabled()
  })
})
