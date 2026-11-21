import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    window.sessionStorage.clear()
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
    // The header renders before the entries load; wait for the session itself.
    expect(await screen.findByRole('radio', { name: /Clock 9:00 AM–11:00 AM/ })).toHaveAttribute('aria-checked', 'true')
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

  it('keeps unsaved lines when switching days and back, and lists them meanwhile', async () => {
    apiMock.getTimeEntries.mockResolvedValue({ data: { time_entries: [] } })
    render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)

    fireEvent.change(await screen.findByLabelText('Work client'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Work description'), { target: { value: 'Bank recs' } })
    fireEvent.change(screen.getByLabelText('Work time'), { target: { value: '45' } })

    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    await waitFor(() => expect((screen.getByLabelText('Work client') as HTMLSelectElement).value).toBe(''))
    const unsaved = screen.getByLabelText('Other unsaved work')
    expect(unsaved).toHaveTextContent('day log')

    fireEvent.click(within(unsaved).getByRole('button'))
    await waitFor(() => expect((screen.getByLabelText('Work client') as HTMLSelectElement).value).toBe('2'))
    expect((screen.getByLabelText('Work description') as HTMLInputElement).value).toBe('Bank recs')
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument()
  })

  it('keeps a separate draft per clock session and marks the unsaved one', async () => {
    const second = { ...session, id: 51, start_time: '13:00', end_time: '15:00', formatted_start_time: '1:00 PM', formatted_end_time: '3:00 PM' }
    apiMock.getTimeEntries.mockResolvedValue({ data: { time_entries: [session, second] } })
    render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)

    const first = await screen.findByRole('radio', { name: /Clock 9:00 AM/ })
    fireEvent.change(screen.getByLabelText('Work client'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('radio', { name: /Clock 1:00 PM/ }))
    expect((screen.getByLabelText('Work client') as HTMLSelectElement).value).toBe('')
    expect(first).toHaveTextContent('unsaved')

    fireEvent.click(first)
    expect((screen.getByLabelText('Work client') as HTMLSelectElement).value).toBe('2')
  })

  it('keeps drafts across a remount (e.g. switching tabs) and warns before leaving the page', async () => {
    apiMock.getTimeEntries.mockResolvedValue({ data: { time_entries: [] } })
    const { unmount } = render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)
    fireEvent.change(await screen.findByLabelText('Work client'), { target: { value: '3' } })

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)

    unmount()
    render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)
    await waitFor(() => expect((screen.getByLabelText('Work client') as HTMLSelectElement).value).toBe('3'))
  })

  it('blocks switching days or sessions while a save is in flight', async () => {
    apiMock.getTimeEntries.mockResolvedValue({ data: { time_entries: [] } })
    let finish: (value: unknown) => void = () => undefined
    apiMock.createTimeEntry.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)

    fireEvent.change(await screen.findByLabelText('Work client'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Work time'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log day' }))

    expect(screen.getByRole('button', { name: 'Previous day' })).toBeDisabled()
    expect(screen.getByLabelText('Day')).toBeDisabled()
    expect(screen.getByRole('radio', { name: /My day/ })).toBeDisabled()
    finish({ data: { time_entry: { approval_status: 'pending' } } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Previous day' })).toBeEnabled())
    expect(window.sessionStorage.getItem('cst.logMyDay.drafts.7')).toBeNull()
  })

  it('reopens on the session or day log that has unsaved lines after a remount', async () => {
    apiMock.getTimeEntries.mockResolvedValue({ data: { time_entries: [session] } })
    const { unmount } = render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)
    fireEvent.click(await screen.findByRole('radio', { name: /Work off the clock/ }))
    fireEvent.change(screen.getByLabelText('Work client'), { target: { value: '3' } })

    unmount()
    render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)

    await waitFor(() => expect(screen.getByRole('radio', { name: /Work off the clock/ })).toHaveAttribute('aria-checked', 'true'))
    expect((screen.getByLabelText('Work client') as HTMLSelectElement).value).toBe('3')
  })

  describe('stale drafts', () => {
    const dayLog = {
      ...session, id: 60, entry_method: 'manual', duration_only: true, start_time: null, end_time: null,
      formatted_start_time: null, formatted_end_time: null, hours: 1, updated_at: '2026-11-16T01:00:00Z',
      work_lines: [{ ...session.work_lines[0], id: 9, minutes: 60, hours: 1 }],
    }

    it('blocks saving when the draft’s clock session was deleted, and never writes to the day log', async () => {
      apiMock.getTimeEntries.mockResolvedValue({ data: { time_entries: [session, dayLog] } })
      const { unmount } = render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)
      await screen.findByRole('radio', { name: /Clock 9:00 AM/ })
      fireEvent.click(screen.getByRole('radio', { name: /Clock 9:00 AM/ }))
      fireEvent.change(screen.getByLabelText('Work client'), { target: { value: '2' } })
      fireEvent.change(screen.getByLabelText('Work time'), { target: { value: '120' } })
      unmount()

      // An admin deleted the session; the day log is still there.
      apiMock.getTimeEntries.mockResolvedValue({ data: { time_entries: [dayLog] } })
      render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)

      expect(await screen.findByText('The clock session these lines were for no longer exists.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save session' })).toBeDisabled()
      // The stale session lines are not counted as a day log.
      expect(screen.getByText('Total logged').nextElementSibling).toHaveTextContent('1h')

      fireEvent.click(screen.getByRole('button', { name: 'Save my lines as a separate day log' }))
      await waitFor(() => expect(apiMock.createTimeEntry).toHaveBeenCalled())
      expect(apiMock.updateTimeEntry).not.toHaveBeenCalled()
      expect(apiMock.createTimeEntry.mock.calls[0][0].work_lines).toEqual([expect.objectContaining({ client_id: 2, exact_hours: 2 })])
    })

    it('blocks saving when the session changed on the server since the draft started, and can discard', async () => {
      apiMock.getTimeEntries.mockResolvedValue({ data: { time_entries: [{ ...session, updated_at: '2026-11-16T02:00:00Z' }] } })
      const { unmount } = render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)
      fireEvent.change(await screen.findByLabelText('Work client'), { target: { value: '3' } })
      unmount()

      apiMock.getTimeEntries.mockResolvedValue({ data: { time_entries: [{ ...session, updated_at: '2026-11-16T03:00:00Z' }] } })
      render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)

      expect(await screen.findByText('This entry was changed elsewhere after you started these lines.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save session' })).toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: 'Discard my lines' }))
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
      expect(apiMock.updateTimeEntry).not.toHaveBeenCalled()
    })

    it('blocks a new day log draft once a day log has been saved elsewhere', async () => {
      apiMock.getTimeEntries.mockResolvedValue({ data: { time_entries: [] } })
      const { unmount } = render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)
      fireEvent.change(await screen.findByLabelText('Work client'), { target: { value: '2' } })
      fireEvent.change(screen.getByLabelText('Work time'), { target: { value: '30' } })
      unmount()

      apiMock.getTimeEntries.mockResolvedValue({ data: { time_entries: [dayLog] } })
      render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)

      expect(await screen.findByText('A day log was saved for this day after you started these lines.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save day' })).toBeDisabled()
    })
  })

  it('wipes another person’s stored drafts when a different user opens Log my day', async () => {
    apiMock.getTimeEntries.mockResolvedValue({ data: { time_entries: [] } })
    const { unmount } = render(<LogMyDay userId={7} clients={clients} serviceTypes={[]} />)
    fireEvent.change(await screen.findByLabelText('Work description'), { target: { value: 'Private client note' } })
    expect(window.sessionStorage.getItem('cst.logMyDay.drafts.7')).toContain('Private client note')
    unmount()

    render(<LogMyDay userId={8} clients={clients} serviceTypes={[]} />)
    await screen.findByLabelText('Work description')

    expect(window.sessionStorage.getItem('cst.logMyDay.drafts.7')).toBeNull()
    expect((screen.getByLabelText('Work description') as HTMLInputElement).value).toBe('')
  })
})
