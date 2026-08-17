import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import EditTimeEntryModal from './EditTimeEntryModal'

const apiMock = vi.hoisted(() => ({
  updateTimeEntry: vi.fn(),
  deleteTimeEntry: vi.fn(),
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
  })

  it('does not submit an empty detailed breaks array for aggregate-only breaks', async () => {
    render(
      <EditTimeEntryModal
        isOpen
        entry={entry}
        categories={[]}
        canDelete
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => expect(apiMock.updateTimeEntry).toHaveBeenCalled())
    expect(apiMock.updateTimeEntry.mock.calls[0][1]).not.toHaveProperty('breaks')
    expect(apiMock.updateTimeEntry.mock.calls[0][1]).toMatchObject({ break_minutes: 30 })
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
        categories={[]}
        canDelete
        onClose={vi.fn()}
        onSaved={onSaved}
        onDeleted={vi.fn()}
      />,
    )

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
        categories={[]}
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
})
