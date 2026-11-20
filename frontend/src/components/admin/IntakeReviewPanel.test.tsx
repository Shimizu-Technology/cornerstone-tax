import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IntakeReviewPanel from './IntakeReviewPanel'

const apiMocks = vi.hoisted(() => ({
  getIntakeSubmission: vi.fn(),
  mergeIntakeSubmission: vi.fn(),
  keepIntakeSubmissionSeparate: vi.fn(),
}))

vi.mock('../../lib/api', () => ({ api: apiMocks }))

const detail = {
  id: 7,
  status: 'needs_review',
  submitted_at: '2026-11-20T10:00:00Z',
  reviewed_at: null,
  tax_year: 2026,
  client: { id: 20, full_name: 'Jane Doe', email: 'jane@example.com', archived: false },
  matched_client: { id: 10, full_name: 'Jane Doe', email: 'jane@example.com', archived: false },
  fields: [
    { key: 'phone', label: 'Phone', submitted: '671-555-0000', existing: '671-555-0199', differs: true },
    { key: 'bank_account_number', label: 'Bank account number', submitted: '••••5555', existing: '••••4321', differs: true },
    { key: 'email', label: 'Email', submitted: 'jane@example.com', existing: 'jane@example.com', differs: false },
  ],
  submitted_dependents: [{ name: 'Kid', date_of_birth: null, relationship: 'Child' }],
  existing_dependents: [],
  tax_return: { id: 30, tax_year: 2026, documents_count: 2, income_sources_count: 1 },
}

const review = {
  id: 7,
  submitted_at: '2026-11-20T10:00:00Z',
  role: 'existing' as const,
  other_client: { id: 20, full_name: 'Jane Doe' },
}

function renderPanel(onResolved = vi.fn()) {
  render(
    <MemoryRouter>
      <IntakeReviewPanel reviews={[review]} onResolved={onResolved} />
    </MemoryRouter>
  )
  return onResolved
}

describe('IntakeReviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getIntakeSubmission.mockResolvedValue({ data: { intake_submission: detail } })
  })

  it('renders nothing without pending reviews', () => {
    const { container } = render(
      <MemoryRouter>
        <IntakeReviewPanel reviews={[]} onResolved={vi.fn()} />
      </MemoryRouter>
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('merges only the fields staff tick', async () => {
    apiMocks.mergeIntakeSubmission.mockResolvedValue({ data: { intake_submission: detail, client_id: 10 } })
    const onResolved = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Review intake' }))
    await screen.findByRole('dialog')

    expect(screen.getByText('••••4321')).toBeInTheDocument()
    expect(screen.getByText(/Already the same: Email/)).toBeInTheDocument()
    expect(screen.getByLabelText('Phone')).not.toBeChecked()

    fireEvent.click(screen.getByLabelText('Phone'))
    fireEvent.click(screen.getByLabelText(/Add submitted dependents/))
    fireEvent.click(screen.getByRole('button', { name: 'Merge into Jane Doe' }))

    await waitFor(() => expect(onResolved).toHaveBeenCalled())
    expect(apiMocks.mergeIntakeSubmission).toHaveBeenCalledWith(7, { fields: ['phone'], include_dependents: true })
  })

  it('moves focus into the dialog, keeps Tab inside it and returns focus on Escape', async () => {
    renderPanel()
    const trigger = screen.getByRole('button', { name: 'Review intake' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = await screen.findByRole('dialog')
    await screen.findByLabelText('Phone')
    expect(dialog).toHaveFocus()

    const merge = screen.getByRole('button', { name: 'Merge into Jane Doe' })
    merge.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(screen.getByLabelText('Phone')).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(merge).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('holds focus on the dialog while saving disables every control', async () => {
    apiMocks.getIntakeSubmission.mockResolvedValue({
      data: { intake_submission: { ...detail, fields: detail.fields.map(field => ({ ...field, differs: false })), submitted_dependents: [] } },
    })
    apiMocks.keepIntakeSubmissionSeparate.mockReturnValue(new Promise(() => {}))
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Review intake' }))
    const dialog = await screen.findByRole('dialog')
    await screen.findByText(/Every submitted client field already matches/)
    fireEvent.click(screen.getByRole('button', { name: 'Keep as separate client' }))
    await screen.findByRole('button', { name: 'Saving…' })
    expect(dialog.querySelectorAll('button:not([disabled]), input:not([disabled])')).toHaveLength(0)

    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    window.dispatchEvent(tab)

    expect(tab.defaultPrevented).toBe(true)
    expect(dialog).toHaveFocus()
    outside.remove()
  })

  it('keeps the records apart and shows server errors', async () => {
    apiMocks.keepIntakeSubmissionSeparate
      .mockResolvedValueOnce({ error: 'This intake is no longer waiting for review' })
      .mockResolvedValueOnce({ data: { intake_submission: { ...detail, status: 'reviewed' } } })
    const onResolved = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Review intake' }))
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByRole('button', { name: 'Keep as separate client' }))
    expect(await screen.findByText('This intake is no longer waiting for review')).toBeInTheDocument()
    expect(onResolved).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Keep as separate client' }))
    await waitFor(() => expect(onResolved).toHaveBeenCalled())
    expect(apiMocks.mergeIntakeSubmission).not.toHaveBeenCalled()
  })
})
