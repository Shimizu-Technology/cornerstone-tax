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
  entries: [{ id: 11, version: 4 }, { id: 12, version: 2 }, { id: 13, version: 7 }],
  count: 3,
  hours: 7.5,
  oldest_work_date: '2026-11-03',
  newest_work_date: '2026-11-10',
  by_user: [
    { id: 1, name: 'Avery Alpha', entry_count: 2, hours: 5 },
    { id: 2, name: 'Casey Clock', entry_count: 1, hours: 2.5 },
  ],
  needs_work_details_count: 1,
  total_count: 3,
  batch_limit: 500,
}

describe('ApprovalQueue: approve unscheduled-only entries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    apiMocks.getPendingApprovals.mockResolvedValue({ data: { pending_entries: [], summary: null } })
    apiMocks.getTimeCategories.mockResolvedValue({ data: { time_categories: [] } })
    apiMocks.getWorkLineSuggestions.mockResolvedValue({ data: null })
    apiMocks.getUnscheduledOnlyApprovals.mockResolvedValue({ data: preview })
    apiMocks.approveUnscheduledOnly.mockResolvedValue({ data: { approved_count: 1, skipped_count: 2, changed_count: 1, ineligible_count: 1, approved_entry_ids: [11] } })
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

    // Each entry goes back with the version it was previewed at.
    await waitFor(() => expect(apiMocks.approveUnscheduledOnly).toHaveBeenCalledWith([{ id: 11, version: 4 }, { id: 12, version: 2 }, { id: 13, version: 7 }]))
    expect(await screen.findByText('Approved 1 entry. 1 changed since the preview and stayed in the queue. 1 no longer qualified (for example, its period was locked) and stayed in the queue.')).toBeInTheDocument()
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
    apiMocks.getUnscheduledOnlyApprovals.mockResolvedValue({ data: { ...preview, entry_ids: [], entries: [], count: 0, hours: 0, by_user: [], needs_work_details_count: 0 } })
    render(<ApprovalQueue />)

    fireEvent.click(await screen.findByRole('button', { name: 'Approve unscheduled-only entries' }))
    const dialog = await screen.findByRole('dialog', { name: 'Approve unscheduled-only entries' })

    expect(within(dialog).getByText('No pending entries are waiting only for a missing schedule.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Approve 0 entries' })).toBeDisabled()
  })

  it('previews a batch of 500 out of 501 and approves exactly that batch', async () => {
    const batch = Array.from({ length: 500 }, (_, index) => ({ id: index + 1, version: 1 }))
    apiMocks.getUnscheduledOnlyApprovals.mockResolvedValue({ data: {
      ...preview, entry_ids: batch.map((row) => row.id), entries: batch, count: 500, hours: 1000, total_count: 501,
      by_user: [{ id: 1, name: 'Avery Alpha', entry_count: 500, hours: 1000 }], needs_work_details_count: 0,
    } })
    apiMocks.approveUnscheduledOnly.mockResolvedValue({ data: { approved_count: 500, skipped_count: 0, changed_count: 0, ineligible_count: 0, approved_entry_ids: [] } })
    render(<ApprovalQueue />)

    fireEvent.click(await screen.findByRole('button', { name: 'Approve unscheduled-only entries' }))
    const dialog = await screen.findByRole('dialog', { name: 'Approve unscheduled-only entries' })
    expect(within(dialog).getByText('This approves the oldest 500 of 501. Run it again afterwards for the rest.')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve 500 entries' }))

    await waitFor(() => expect(apiMocks.approveUnscheduledOnly).toHaveBeenCalledTimes(1))
    expect(apiMocks.approveUnscheduledOnly.mock.calls[0][0]).toHaveLength(500)
  })

  it('shows a failed confirmation inside the sheet and clears it on retry', async () => {
    apiMocks.approveUnscheduledOnly
      .mockResolvedValueOnce({ error: 'Approve at most 500 entries at a time' })
      .mockResolvedValueOnce({ data: { approved_count: 3, skipped_count: 0, changed_count: 0, ineligible_count: 0, approved_entry_ids: [11, 12, 13] } })
    render(<ApprovalQueue />)

    fireEvent.click(await screen.findByRole('button', { name: 'Approve unscheduled-only entries' }))
    const dialog = await screen.findByRole('dialog', { name: 'Approve unscheduled-only entries' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve 3 entries' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Approve at most 500 entries at a time')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve 3 entries' }))
    await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument())
    expect(await screen.findByText('Approved 3 entries.')).toBeInTheDocument()
  })
})
