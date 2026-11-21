import { useState } from 'react'
import type { ServiceType } from '../../lib/api'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import WorkLinesEditor from './WorkLinesEditor'
import { newDraft, type WorkLineDraft, type WorkLineSuggestions } from './workLinesModel'

const clients = [
  { id: 1, name: 'Internal – Cornerstone', client_type: 'business', system_kind: 'internal' },
  { id: 2, name: 'Alpha Co', client_type: 'business' },
  { id: 3, name: 'Pat Person', client_type: 'individual' },
]
const serviceTypes = [
  { id: 10, name: 'Bookkeeping', description: null, color: null, internal: false, tasks: [] },
  { id: 20, name: 'Office & errands', description: null, color: null, internal: true, tasks: [] },
]
const suggestions: WorkLineSuggestions = {
  recentClients: [{ id: 2, name: 'Alpha Co', client_type: 'business' }],
  descriptionsByClient: { '2': ['Prepared bank reconciliations'] },
  requiredFrom: null,
  taskRequired: false,
}

function Harness({ required = false, target = null as number | null, taskRequired = false, types = serviceTypes as ServiceType[] }) {
  const [lines, setLines] = useState<WorkLineDraft[]>([newDraft()])
  return (
    <WorkLinesEditor lines={lines} onChange={setLines} targetMinutes={target} clients={clients} serviceTypes={types}
      suggestions={{ ...suggestions, taskRequired }} required={required} mode="day" idPrefix="t" />
  )
}

describe('WorkLinesEditor (day grid)', () => {
  it('adds a row on Enter, duplicates the previous row and keeps a running total', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Alpha Co' }))
    fireEvent.click(screen.getByRole('button', { name: 'Prepared bank reconciliations' }))
    fireEvent.change(screen.getByLabelText('Work time'), { target: { value: '45' } })
    fireEvent.keyDown(screen.getByLabelText('Work time'), { key: 'Enter' })

    expect(screen.getByLabelText('Line 2 client')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Line 2 client'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Line 2 time'), { target: { value: '1h 30m' } })
    expect(screen.getByTestId('work-lines-remaining')).toHaveTextContent('Total 2h 15m')

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate previous' }))
    expect((screen.getByLabelText('Line 3 client') as HTMLSelectElement).value).toBe('3')
    // The copy is a new line with its own key: editing it leaves line 2 alone.
    fireEvent.change(screen.getByLabelText('Line 3 description'), { target: { value: 'Copy' } })
    expect((screen.getByLabelText('Line 2 description') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Line 3 time') as HTMLInputElement).value).toBe('')
  })

  it('offers internal categories for internal work and asks for one when required', () => {
    render(<Harness required />)

    fireEvent.change(screen.getByLabelText('Work client'), { target: { value: '1' } })
    const categories = within(screen.getByLabelText(/^Work category/)).getAllByRole('option').map((option) => option.textContent)
    expect(categories).toEqual(['Choose category…', 'Office & errands'])
    fireEvent.change(screen.getByLabelText('Work time'), { target: { value: '20' } })

    expect(screen.getByText('Say what you did · Choose a category for internal work')).toBeInTheDocument()
  })

  it('lists the recent clients first in the picker, then Cornerstone, businesses and individuals', () => {
    render(<Harness />)
    const groups = within(screen.getByLabelText('Work client')).getAllByRole('group').map((group) => group.getAttribute('label'))
    expect(groups).toEqual(['Recent', 'Cornerstone', 'Businesses', 'Individuals'])
  })

  it('shows the remaining time against a clock session', () => {
    render(<Harness target={60} />)
    fireEvent.change(screen.getByLabelText('Work time'), { target: { value: '0.75' } })
    fireEvent.click(within(screen.getByRole('group', { name: 'Work time unit' })).getByRole('button', { name: 'h' }))
    expect(screen.getByTestId('work-lines-remaining')).toHaveTextContent('15m left to assign')
    expect(screen.getByTestId('work-lines-remaining')).toHaveTextContent('Remaining 0.25h')
  })

  it('shows the task beside the category and asks for it when "Require a task" is on', () => {
    const withTasks = [
      { ...serviceTypes[0], tasks: [{ id: 100, name: 'Bank reconciliation', description: null }] },
      serviceTypes[1],
    ]
    render(<Harness required taskRequired types={withTasks} />)

    fireEvent.change(screen.getByLabelText('Work client'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Work description'), { target: { value: 'Reconciled' } })
    fireEvent.change(screen.getByLabelText('Work time'), { target: { value: '30' } })
    expect(screen.getByText('Choose a category and a task')).toBeInTheDocument()

    const category = screen.getByLabelText(/^Work category/)
    expect(category).toHaveAttribute('aria-invalid', 'true')
    expect(category).toHaveAccessibleDescription(/Choose a category and a task/)

    fireEvent.change(category, { target: { value: '10' } })
    expect(category).not.toHaveAttribute('aria-invalid')
    // Visible without opening "Task and period".
    const task = screen.getByLabelText(/^Task/)
    expect(task).toHaveAttribute('aria-required', 'true')
    expect(task).toHaveAttribute('aria-invalid', 'true')
    expect(task).toHaveAccessibleDescription('Choose a task')

    fireEvent.change(task, { target: { value: '100' } })
    expect(task).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByText('Choose a task')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Period' })).toBeInTheDocument()
  })

  it('wraps a long description in a one-line field instead of cutting it off', () => {
    render(<Harness />)
    const description = screen.getByLabelText('Work description')

    expect(description.tagName).toBe('TEXTAREA')
    expect(description).toHaveAttribute('rows', '1')
    const long = 'Reconciled operating account and payroll clearing account for October, then emailed the variance list'
    fireEvent.change(description, { target: { value: long } })
    expect((description as HTMLTextAreaElement).value).toBe(long)

    // Stays one line: Enter adds no line break, and pasted ones become spaces.
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    description.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
    fireEvent.change(description, { target: { value: 'First line\nsecond line' } })
    expect((description as HTMLTextAreaElement).value).toBe('First line second line')
  })
})

