import { useState } from 'react'
import type { ServiceType } from '../../lib/api'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
    fireEvent.change(screen.getByLabelText('Line 3 comments'), { target: { value: 'Copy' } })
    expect((screen.getByLabelText('Line 2 comments') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Line 3 time') as HTMLInputElement).value).toBe('')
  })

  it('offers internal categories for internal work and asks for one when required', () => {
    render(<Harness required />)

    fireEvent.change(screen.getByLabelText('Work client'), { target: { value: '1' } })
    const categories = within(screen.getByLabelText(/^Work category/)).getAllByRole('option').map((option) => option.textContent)
    expect(categories).toEqual(['Choose category…', 'Office & errands'])
    fireEvent.change(screen.getByLabelText('Work time'), { target: { value: '20' } })

    expect(screen.getByText('Choose a category')).toBeInTheDocument()
  })

  it('asks a client line for a category, not for comments, when required', () => {
    render(<Harness required />)

    fireEvent.change(screen.getByLabelText('Work client'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Work time'), { target: { value: '30' } })
    const category = screen.getByLabelText(/^Work category/)
    expect(category).toHaveAttribute('aria-required', 'true')
    expect(category).toHaveAttribute('aria-invalid', 'true')
    expect(category).toHaveAccessibleDescription('Choose a category')
    expect(within(category).getAllByRole('option')[0]).toHaveTextContent('Choose category…')

    fireEvent.change(category, { target: { value: '10' } })
    // No comments, no task, no period: the line is complete.
    expect(document.querySelector('[id$="-problems"]')).toBeNull()
    expect(screen.getByLabelText('Work comments')).not.toHaveAttribute('aria-required')
  })

  it('marks the category optional, with a "No category" choice, before the cutover', () => {
    render(<Harness />)
    const label = document.querySelector(`label[for="${screen.getByLabelText(/^Work category/).id}"]`)
    expect(label).toHaveTextContent('Category (optional)')
    expect(within(screen.getByLabelText(/^Work category/)).getAllByRole('option')[0]).toHaveTextContent('No category')
    fireEvent.change(screen.getByLabelText('Work time'), { target: { value: '30' } })
    expect(document.querySelector('[id$="-problems"]')).toBeNull()
  })

  it('shows the fields in the owner\'s order: client, category, task, period, time, comments', () => {
    render(<Harness />)
    const line = screen.getByRole('listitem', { name: 'Work' })
    const fields = [
      screen.getByLabelText('Work client'),
      screen.getByLabelText(/^Work category/),
      screen.getByLabelText(/^Work task/),
      screen.getByLabelText('Work period'),
      screen.getByLabelText('Work time'),
      screen.getByLabelText('Work comments'),
      screen.getByRole('button', { name: 'Duplicate work' }),
    ]
    fields.forEach((field) => expect(line).toContainElement(field))
    for (let index = 1; index < fields.length; index += 1) {
      // Each field follows the previous one in the DOM (and so in focus order).
      expect(fields[index - 1].compareDocumentPosition(fields[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    // Task and period are inline: no toggle to open them.
    expect(screen.queryByRole('button', { name: /task and period|^period$/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Work task/)).toBeDisabled()
    expect(within(screen.getByLabelText(/^Work task/)).getAllByRole('option')[0]).toHaveTextContent('Category first')
  })

  it('titles the table columns Client, Category, Task, Period and Time, marking required ones', () => {
    const header = () => Array.from(document.querySelector('[data-testid="work-lines-editor"] > div[aria-hidden="true"]')!.children).map((cell) => cell.textContent)
    const { unmount } = render(<Harness />)
    expect(header()).toEqual(['Client', 'Category', 'Task', 'Period', 'Time'])
    unmount()
    render(<Harness required />)
    expect(header()).toEqual(['Client *', 'Category *', 'Task', 'Period', 'Time'])
  })

  it('marks Task required with "Require a task" on', () => {
    render(<Harness required taskRequired />)
    const header = Array.from(document.querySelector('[data-testid="work-lines-editor"] > div[aria-hidden="true"]')!.children).map((cell) => cell.textContent)
    expect(header).toEqual(['Client *', 'Category *', 'Task *', 'Period', 'Time'])
  })

  it('stars required labels (hidden from screen readers) and keeps "(optional)" on the rest', () => {
    render(<Harness required />)
    const labelFor = (field: HTMLElement) => document.querySelector(`label[for="${field.id}"]`)!
    expect(labelFor(screen.getByLabelText('Work client', { exact: true }))).toHaveTextContent('Client *')
    expect(labelFor(screen.getByLabelText('Work category'))).toHaveTextContent('Category *')
    expect(labelFor(screen.getByLabelText('Work task'))).toHaveTextContent('Task (optional)')
    expect(labelFor(screen.getByLabelText('Work period'))).toHaveTextContent('Period (optional)')
    expect(labelFor(screen.getByLabelText('Work category')).querySelector('[aria-hidden="true"]')).toHaveTextContent('*')
  })

  it('picks the period from one dropdown, newest first around the entry date', () => {
    function Dated() {
      const [lines, setLines] = useState<WorkLineDraft[]>([newDraft({ period_type: 'month', period_start: '2024-03-01' })])
      return <WorkLinesEditor lines={lines} onChange={setLines} targetMinutes={null} clients={clients} serviceTypes={serviceTypes} referenceDate="2026-11-18" mode="day" idPrefix="t" />
    }
    render(<Dated />)
    const period = screen.getByLabelText('Work period') as HTMLSelectElement
    const groupOptions = (name: string) => within(within(period).getByRole('group', { name })).getAllByRole('option').map((option) => option.textContent)
    // The saved March 2024 is out of range, so it leads the months.
    expect(groupOptions('Months')).toEqual(['March 2024', 'December 2026', 'November 2026', 'October 2026', 'September 2026', 'August 2026', 'July 2026', 'June 2026',
      'May 2026', 'April 2026', 'March 2026', 'February 2026', 'January 2026', 'December 2025', 'November 2025'])
    expect(groupOptions('Quarters')).toEqual(['1st Quarter 2027', '4th Quarter 2026', '3rd Quarter 2026', '2nd Quarter 2026', '1st Quarter 2026', '4th Quarter 2025'])
    expect(groupOptions('Years')).toEqual(['Year 2027', 'Year 2026', 'Year 2025', 'Year 2024'])
    expect(period.value).toBe('month:2024-03-01')

    fireEvent.change(period, { target: { value: 'quarter:2026-07-01' } })
    expect(period.value).toBe('quarter:2026-07-01')
    fireEvent.change(period, { target: { value: '' } })
    expect(period.value).toBe('')
  })

  it('disables the period with the rest of the line while saving', () => {
    render(<WorkLinesEditor lines={[newDraft()]} onChange={vi.fn()} targetMinutes={null} clients={clients} serviceTypes={serviceTypes} mode="day" idPrefix="t" disabled />)
    expect(screen.getByLabelText('Work period')).toBeDisabled()
  })

  it('marks only the field a problem is about as invalid', () => {
    render(<Harness required />)
    const client = screen.getByLabelText('Work client', { exact: true })
    const time = screen.getByLabelText('Work time', { exact: true })
    expect(client).toHaveAttribute('aria-invalid', 'true')
    expect(client).toHaveAccessibleDescription(/Choose a client/)
    expect(time).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(client, { target: { value: '2' } })
    expect(client).not.toHaveAttribute('aria-invalid')
    expect(client).not.toHaveAccessibleDescription(/Choose/)
    fireEvent.change(time, { target: { value: '30' } })
    expect(time).not.toHaveAttribute('aria-invalid')
    expect(time).toHaveAccessibleDescription('= 30m (0.50h)')
  })

  it('names each line\'s period for screen readers', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Add line' }))
    expect(screen.getByLabelText('Line 1 period')).toBeInTheDocument()
    expect(screen.getByLabelText('Line 2 period')).toBeInTheDocument()
  })

  it('says "No tasks" for a category without tasks', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText(/^Work category/), { target: { value: '10' } })
    expect(within(screen.getByLabelText('Work task')).getAllByRole('option')[0]).toHaveTextContent(/^No tasks$/)
  })

  it('clears a category that does not fit the new client', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Work client'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/^Work category/), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Work client'), { target: { value: '1' } })
    expect((screen.getByLabelText(/^Work category/) as HTMLSelectElement).value).toBe('')
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

  it('asks for the task when "Require a task" is on and the category has tasks', () => {
    const withTasks = [
      { ...serviceTypes[0], tasks: [{ id: 100, name: 'Bank reconciliation', description: null }] },
      serviceTypes[1],
    ]
    render(<Harness required taskRequired types={withTasks} />)

    fireEvent.change(screen.getByLabelText('Work client'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Work time'), { target: { value: '30' } })
    expect(screen.getByText('Choose a category')).toBeInTheDocument()

    const category = screen.getByLabelText(/^Work category/)
    expect(category).toHaveAttribute('aria-invalid', 'true')
    expect(category).toHaveAccessibleDescription(/Choose a category/)

    fireEvent.change(category, { target: { value: '10' } })
    expect(category).not.toHaveAttribute('aria-invalid')
    const task = screen.getByLabelText(/^Work task/)
    expect(task).toHaveAttribute('aria-required', 'true')
    expect(task).toHaveAttribute('aria-invalid', 'true')
    expect(task).toHaveAccessibleDescription('Choose a task')

    fireEvent.change(task, { target: { value: '100' } })
    expect(task).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByText('Choose a task')).not.toBeInTheDocument()
  })

  it('wraps long comments in a one-line field instead of cutting them off', () => {
    render(<Harness />)
    const description = screen.getByLabelText('Work comments')

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

  describe('row alignment', () => {
    const manyClients = Array.from({ length: 8 }, (_, index) => ({ id: 100 + index, name: `Client ${index + 1}`, client_type: 'business' }))

    function ManyClients() {
      const [lines, setLines] = useState<WorkLineDraft[]>([newDraft(), newDraft()])
      return (
        <WorkLinesEditor lines={lines} onChange={setLines} targetMinutes={null} clients={manyClients} serviceTypes={serviceTypes}
          suggestions={{ ...suggestions, recentClients: [{ id: 101, name: 'Tumon Watch & Clock Repair', client_type: 'business' }] }}
          mode="day" idPrefix="t" />
      )
    }

    it('puts the client select first in its cell so it lines up with the other fields, with the search under it', () => {
      render(<ManyClients />)
      const select = screen.getByLabelText('Line 1 client')
      const search = screen.getByLabelText('Search clients for line 1 client')

      // The select precedes the search box (DOCUMENT_POSITION_FOLLOWING = 4).
      expect(select.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(search).toHaveAttribute('aria-controls', select.id)
    })

    it('keeps every field labelled for screen readers when the table hides the visible labels', () => {
      render(<ManyClients />)
      for (const name of ['Line 1 client', 'Line 1 category', 'Line 1 task', 'Line 1 period', 'Line 1 time']) {
        const field = screen.getByLabelText(name)
        const label = document.querySelector(`label[for="${field.id}"]`)
        expect(label).not.toBeNull()
        // Hidden visually only on wide layouts; still in the accessibility tree.
        expect(label!.className).toContain('@4xl:sr-only')
        expect(label!.className).not.toMatch(/(^|\s)(hidden|md:hidden)(\s|$)/)
      }
      // Comments has no column title, so its small label stays visible.
      const comments = screen.getByLabelText('Line 1 comments')
      const commentsLabel = document.querySelector(`label[for="${comments.id}"]`)
      expect(commentsLabel).toHaveTextContent('Comments (optional)')
      expect(commentsLabel!.className).not.toContain('sr-only')
    })

    it('shows a long recent client name in full instead of truncating it', () => {
      render(<ManyClients />)
      const chip = screen.getAllByRole('button', { name: 'Tumon Watch & Clock Repair' })[0]
      expect(chip.className).not.toContain('truncate')
      expect(chip.className).toContain('whitespace-normal')
    })
  })

  describe('when the field changes width', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('grows to fit text that wraps after the field narrows', () => {
      let resized = () => {}
      vi.stubGlobal('ResizeObserver', class {
        constructor(callback: () => void) { resized = callback }
        observe() {}
        disconnect() {}
      })
      render(<Harness />)
      const description = screen.getByLabelText('Work comments') as HTMLTextAreaElement
      Object.defineProperty(description, 'clientWidth', { configurable: true, value: 600 })
      Object.defineProperty(description, 'scrollHeight', { configurable: true, value: 24 })
      fireEvent.change(description, { target: { value: 'Reconciled operating account and payroll clearing account' } })
      expect(description.style.height).toBe('24px')

      // Splitting the session moves the field into a narrower column without changing its text.
      Object.defineProperty(description, 'clientWidth', { configurable: true, value: 220 })
      Object.defineProperty(description, 'scrollHeight', { configurable: true, value: 72 })
      resized()
      expect(description.style.height).toBe('72px')
    })
  })
})

