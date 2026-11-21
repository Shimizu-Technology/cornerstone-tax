import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StuckClockEntries from './StuckClockEntries'

const apiMocks = vi.hoisted(() => ({ getStuckClockEntries: vi.fn(), markTimeEntryCompleted: vi.fn() }))
vi.mock('../../lib/api', () => ({ api: apiMocks }))

const stuck = {
  id: 175, user: { id: 9, full_name: 'Sam Stuck' }, work_date: '2026-04-27', formatted_start_time: '9:00 AM',
  formatted_end_time: '12:38 PM', hours: 3.63, status: 'clocked_in', version: 4,
}

describe('StuckClockEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getStuckClockEntries.mockResolvedValue({ data: { time_entries: [stuck] } })
    apiMocks.markTimeEntryCompleted.mockResolvedValue({ data: { time_entry: { ...stuck, status: 'completed', approval_status: 'pending' } } })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })
  afterEach(() => vi.restoreAllMocks())

  it('lists the entry and marks it completed with its version, after confirming', async () => {
    const onResolved = vi.fn()
    render(<StuckClockEntries onResolved={onResolved} />)

    const list = await screen.findByRole('list', { name: 'Entries left clocked in' })
    expect(within(list).getByText(/9:00 AM–12:38 PM · 3.63h · still clocked in/)).toBeInTheDocument()
    fireEvent.click(within(list).getByRole('button', { name: /Mark Sam Stuck on .* completed/ }))

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('keeps these times and goes to Pending Approvals'))
    await waitFor(() => expect(apiMocks.markTimeEntryCompleted).toHaveBeenCalledWith(175, 4))
    expect(await screen.findByRole('status')).toHaveTextContent("Marked Sam Stuck's entry completed. It's now in Pending Approvals.")
    expect(screen.queryByRole('list', { name: 'Entries left clocked in' })).not.toBeInTheDocument()
    expect(onResolved).toHaveBeenCalled()
  })

  it('does nothing when the confirmation is cancelled', async () => {
    vi.mocked(window.confirm).mockReturnValue(false)
    render(<StuckClockEntries />)

    fireEvent.click(await screen.findByRole('button', { name: /Mark Sam Stuck/ }))

    expect(apiMocks.markTimeEntryCompleted).not.toHaveBeenCalled()
  })

  it('shows a failure and reloads the list', async () => {
    apiMocks.markTimeEntryCompleted.mockResolvedValue({ error: 'This entry changed since you loaded it. Refresh and try again.' })
    render(<StuckClockEntries />)

    fireEvent.click(await screen.findByRole('button', { name: /Mark Sam Stuck/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This entry changed since you loaded it.')
    expect(apiMocks.getStuckClockEntries).toHaveBeenCalledTimes(2)
  })

  it('renders nothing when no entry is stuck', async () => {
    apiMocks.getStuckClockEntries.mockResolvedValue({ data: { time_entries: [] } })
    const { container } = render(<StuckClockEntries />)

    await waitFor(() => expect(apiMocks.getStuckClockEntries).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
