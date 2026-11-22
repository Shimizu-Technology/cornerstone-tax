import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import EditTimeEntryModal from './EditTimeEntryModal'

const apiMock = vi.hoisted(() => ({
  updateTimeEntry: vi.fn(),
  deleteTimeEntry: vi.fn(),
  getWorkLineSuggestions: vi.fn(),
  getTimeEntry: vi.fn(),
}))

vi.mock('../../lib/api', () => ({
  api: apiMock,
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

const entry = {
  id: 3,
  work_date: '2026-05-05',
  start_time: '09:00',
  end_time: '17:00',
  break_minutes: 30,
  description: null,
  entry_method: 'manual' as const,
  status: 'completed' as const,
  locked_at: null,
  user: { id: 1, email: 'alice@example.com', full_name: 'Alice Smith' },
  time_category: null,
  breaks: [],
}

describe('EditTimeEntryModal', () => {
  beforeEach(() => {
    apiMock.updateTimeEntry.mockReset()
    apiMock.deleteTimeEntry.mockReset()
    apiMock.updateTimeEntry.mockResolvedValue({ data: { time_entry: {} } })
    apiMock.getWorkLineSuggestions.mockResolvedValue({ data: { recent_clients: [], descriptions_by_client: {}, work_details_required_from: null } })
  })

  it('does not submit an empty detailed breaks array for aggregate-only breaks', async () => {
    render(
      <EditTimeEntryModal
        isOpen
        entry={entry}
        canDelete
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )

    // Change only the end time: just that attendance field is sent.
    fireEvent.change(screen.getByDisplayValue('17:00'), { target: { value: '16:30' } })
    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => expect(apiMock.updateTimeEntry).toHaveBeenCalled())
    expect(apiMock.updateTimeEntry.mock.calls[0][1]).not.toHaveProperty('breaks')
    expect(apiMock.updateTimeEntry.mock.calls[0][1]).toEqual({ end_time: '16:30' })
    // Untouched work details are not sent, so a concurrent edit is never overwritten,
    // and the legacy category is never rewritten.
    for (const key of ['client_id', 'service_type_id', 'service_task_id', 'period_type', 'period_start', 'description', 'time_category_id', 'work_lines']) {
      expect(apiMock.updateTimeEntry.mock.calls[0][1]).not.toHaveProperty(key)
    }
  })

  it('collects and resubmits a correction reason for an exported entry', async () => {
    const onSaved = vi.fn()
    apiMock.updateTimeEntry
      .mockResolvedValueOnce({
        error: 'A correction reason is required because this entry was already exported to payroll.',
        code: 'correction_reason_required',
        export_references: ['CST-PAYROLL-20260817-ABC12345'],
      })
      .mockResolvedValueOnce({ data: { time_entry: {} } })

    render(
      <EditTimeEntryModal
        isOpen
        entry={entry}
        canDelete
        onClose={vi.fn()}
        onSaved={onSaved}
        onDeleted={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByDisplayValue('17:00'), { target: { value: '16:30' } })
    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    const reason = await screen.findByLabelText(/correction reason/i)
    expect(screen.getByText(/CST-PAYROLL-20260817-ABC12345/)).toBeInTheDocument()
    fireEvent.change(reason, { target: { value: 'Employee confirmed the corrected clock-out time.' } })
    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(apiMock.updateTimeEntry).toHaveBeenLastCalledWith(
      3,
      expect.any(Object),
      'Employee confirmed the corrected clock-out time.',
      expect.any(Object),
    )
  })

  it('uses the same correction reason when deleting an exported entry', async () => {
    const onDeleted = vi.fn()
    apiMock.deleteTimeEntry
      .mockResolvedValueOnce({
        error: 'A correction reason is required because this entry was already exported to payroll.',
        code: 'correction_reason_required',
        export_references: ['CST-REPORT-20260817-XYZ98765'],
      })
      .mockResolvedValueOnce({ data: undefined })

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <EditTimeEntryModal
        isOpen
        entry={entry}
        canDelete
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDeleted={onDeleted}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    const reason = await screen.findByLabelText(/correction reason/i)
    fireEvent.change(reason, { target: { value: 'Duplicate confirmed by payroll.' } })
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
    expect(apiMock.deleteTimeEntry).toHaveBeenLastCalledWith(3, 'Duplicate confirmed by payroll.')
  })

  it('sends the work lines only when they change, keeping the period pair together', async () => {
    const withPeriod = { ...entry, hours: 7.5, client: { id: 6, name: 'Jose Cruz' }, period_type: 'month', period_start: '2026-07-01', description: 'Bank rec' }
    render(
      <EditTimeEntryModal
        isOpen
        entry={withPeriod}
        clients={[{ id: 6, name: 'Jose Cruz' }]}
        canDelete
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Period month'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => expect(apiMock.updateTimeEntry).toHaveBeenCalled())
    const payload = apiMock.updateTimeEntry.mock.calls[0][1]
    expect(payload.work_lines).toEqual([
      { client_id: 6, description: 'Bank rec', service_type_id: null, service_task_id: null, period_type: 'month', period_start: '2026-08-01', minutes: 450 },
    ])
    expect(payload).not.toHaveProperty('client_id')
    expect(payload).not.toHaveProperty('description')
  })

  it('splits an entry across clients and blocks saving until no time is left over', async () => {
    const clients = [{ id: 6, name: 'Jose Cruz', client_type: 'individual' }, { id: 7, name: 'Alpha Co', client_type: 'business' }]
    render(
      <EditTimeEntryModal isOpen entry={{ ...entry, hours: 7.5, client: { id: 6, name: 'Jose Cruz' } }} clients={clients}
        canDelete onClose={vi.fn()} onSaved={vi.fn()} onDeleted={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Split across clients' }))
    expect((screen.getByLabelText('Line 1 time') as HTMLInputElement).value).toBe('450')
    fireEvent.change(screen.getByLabelText('Line 2 client'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Line 2 time'), { target: { value: '1.5h' } })

    expect(screen.getByTestId('work-lines-remaining')).toHaveTextContent('1h 30m over')
    expect(screen.getByRole('button', { name: /update/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Take 1h 30m from line 1' }))
    expect(screen.getByTestId('work-lines-remaining')).toHaveTextContent('All time is assigned')
    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => expect(apiMock.updateTimeEntry).toHaveBeenCalled())
    expect(apiMock.updateTimeEntry.mock.calls[0][1].work_lines.map((line: { client_id: number; minutes: number }) => [line.client_id, line.minutes]))
      .toEqual([[6, 360], [7, 90]])
  })

  it('shows a catalog load error with a retry inside the form', () => {
    const onRetryCatalog = vi.fn()
    render(
      <EditTimeEntryModal
        isOpen
        entry={entry}
        canDelete
        catalogError="Couldn't load categories. Check your connection and try again."
        onRetryCatalog={onRetryCatalog}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load categories")
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetryCatalog).toHaveBeenCalled()
  })

  it('reopens a split scaled into a short session and saves a description-only edit', async () => {
    const clients = [{ id: 6, name: 'C6', client_type: 'business' }, { id: 7, name: 'C7', client_type: 'business' }]
    const scaled = {
      ...entry, start_time: '09:00', end_time: '09:07', break_minutes: null, hours: 0.12,
      work_lines: [
        { id: 0, position: 0, client: { id: 6, name: 'C6' }, client_label: 'C6', description: 'Line 0', service_type: null, service_task: null, category_label: null, period_type: null, period_start: null, period_label: null, hours: 0.02, minutes: 1 },
        { id: 1, position: 1, client: { id: 7, name: 'C7' }, client_label: 'C7', description: 'Line 1', service_type: null, service_task: null, category_label: null, period_type: null, period_start: null, period_label: null, hours: 0.02, minutes: 1 },
        { id: 2, position: 2, client: { id: 6, name: 'C6' }, client_label: 'C6', description: 'Line 2', service_type: null, service_task: null, category_label: null, period_type: null, period_start: null, period_label: null, hours: 0.02, minutes: 1 },
        { id: 3, position: 3, client: { id: 7, name: 'C7' }, client_label: 'C7', description: 'Line 3', service_type: null, service_task: null, category_label: null, period_type: null, period_start: null, period_label: null, hours: 0.02, minutes: 1 },
        { id: 4, position: 4, client: { id: 6, name: 'C6' }, client_label: 'C6', description: 'Line 4', service_type: null, service_task: null, category_label: null, period_type: null, period_start: null, period_label: null, hours: 0.02, minutes: 1 },
        { id: 5, position: 5, client: { id: 7, name: 'C7' }, client_label: 'C7', description: 'Line 5', service_type: null, service_task: null, category_label: null, period_type: null, period_start: null, period_label: null, hours: 0.02, minutes: 1 }
      ],
    }
    render(<EditTimeEntryModal isOpen entry={scaled} clients={clients} canDelete onClose={vi.fn()} onSaved={vi.fn()} onDeleted={vi.fn()} />)

    // Six 0.02h lines show as 1+1+2+1+1+1 = 7 minutes: nothing is left over.
    expect(screen.getByTestId('work-lines-remaining')).toHaveTextContent('All time is assigned')
    fireEvent.change(screen.getByLabelText('Line 2 comments'), { target: { value: 'Filed checks' } })
    const update = screen.getByRole('button', { name: /update/i })
    expect(update).toBeEnabled()
    fireEvent.click(update)

    await waitFor(() => expect(apiMock.updateTimeEntry).toHaveBeenCalled())
    const payload = apiMock.updateTimeEntry.mock.calls[0][1]
    const sent = payload.work_lines
    // Untouched times go back as their exact stored hours, so no hours move
    // between clients (rounded display minutes would have sent 1,1,2,1,1,1).
    expect(sent.map((line: { exact_hours?: number; minutes?: number }) => [line.exact_hours, line.minutes])).toEqual(Array(6).fill([0.02, undefined]))
    const perClient = (lines: Array<{ client_id: number; hours: number }>) => lines.reduce<Record<number, number>>((totals, line) => {
      totals[line.client_id] = Math.round(((totals[line.client_id] ?? 0) + line.hours) * 100) / 100
      return totals
    }, {})
    expect(perClient(sent.map((line: { client_id: number; exact_hours: number }) => ({ client_id: line.client_id, hours: line.exact_hours }))))
      .toEqual(perClient(scaled.work_lines.map((line) => ({ client_id: line.client.id, hours: line.hours }))))
    expect(sent[1].description).toBe('Filed checks')
    // And no attendance fields: the times were not touched.
    expect(Object.keys(payload)).toEqual(['work_lines'])
  })

  it('targets the stored hours while the times are untouched (clock seconds)', async () => {
    const clockEntry = {
      ...entry, entry_method: 'clock' as const, start_time: '09:00', end_time: '10:00', break_minutes: null, hours: 0.99,
      work_lines: [{ id: 9, position: 0, client: { id: 6, name: 'C6' }, client_label: 'C6', description: 'Old', service_type: null, service_task: null, category_label: null, period_type: null, period_start: null, period_label: null, hours: 0.99, minutes: 59 }],
    }
    render(<EditTimeEntryModal isOpen entry={clockEntry} clients={[{ id: 6, name: 'C6' }]} canDelete onClose={vi.fn()} onSaved={vi.fn()} onDeleted={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Work comments'), { target: { value: 'Payroll run' } })
    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => expect(apiMock.updateTimeEntry).toHaveBeenCalled())
    const payload = apiMock.updateTimeEntry.mock.calls[0][1]
    expect(payload.work_lines).toEqual([
      expect.objectContaining({ description: 'Payroll run', minutes: 59 }),
    ])
    // A work-only edit leaves the clock times (and their seconds) alone.
    for (const key of ['work_date', 'start_time', 'end_time', 'break_minutes', 'breaks']) {
      expect(payload).not.toHaveProperty(key)
    }
  })

  it('closes without a request when nothing changed', async () => {
    const onSaved = vi.fn()
    render(<EditTimeEntryModal isOpen entry={entry} canDelete onClose={vi.fn()} onSaved={onSaved} onDeleted={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(apiMock.updateTimeEntry).not.toHaveBeenCalled()
  })

  it('sends the entry version and, on a 409, offers to keep the lines separately or discard them', async () => {
    apiMock.updateTimeEntry.mockResolvedValueOnce({ status: 409, code: 'version_conflict', error: 'This entry was changed elsewhere after you started. Nothing was saved.' })
    const createTimeEntry = vi.fn().mockResolvedValue({ data: { time_entry: {} } })
    Object.assign(apiMock, { createTimeEntry })
    const onSaved = vi.fn()
    const onConflict = vi.fn()
    apiMock.getTimeEntry.mockResolvedValue({ data: { time_entry: { ...entry, version: 6, work_lines: [
      { id: 1, position: 0, client: { id: 6, name: 'Jose Cruz' }, client_label: 'Jose Cruz', description: 'Saved in another tab', hours: 7.5, minutes: 450 },
    ] } } })
    const versioned = { ...entry, hours: 7.5, version: 4, client: { id: 6, name: 'Jose Cruz' } }
    render(<EditTimeEntryModal isOpen entry={versioned} clients={[{ id: 6, name: 'Jose Cruz' }]} canDelete onClose={vi.fn()} onSaved={onSaved} onDeleted={vi.fn()} onConflict={onConflict} />)

    fireEvent.change(screen.getByLabelText('Work comments'), { target: { value: 'Payroll run' } })
    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    expect(await screen.findByText('This entry was changed elsewhere after you opened it.')).toBeInTheDocument()
    expect(apiMock.updateTimeEntry.mock.calls[0][3]).toEqual({ expectedVersion: 4 })
    expect(onSaved).not.toHaveBeenCalled()
    // Refetched straight away: the caller reloads and the panel shows what is saved now.
    expect(onConflict).toHaveBeenCalled()
    expect(apiMock.getTimeEntry).toHaveBeenCalledWith(3)
    expect(await screen.findByLabelText('Lines saved now')).toHaveTextContent('Saved in another tab')

    fireEvent.click(screen.getByRole('button', { name: 'Save my lines as a separate day log' }))
    await waitFor(() => expect(createTimeEntry).toHaveBeenCalled())
    expect(createTimeEntry.mock.calls[0][0]).toMatchObject({ work_date: '2026-05-05', additional_day_log: true, user_id: 1 })
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })
})
