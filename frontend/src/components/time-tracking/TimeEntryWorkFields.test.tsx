import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ServiceType } from '../../lib/api'
import TimeEntryWorkFields from './TimeEntryWorkFields'
import { EMPTY_WORK_FIELDS, workFieldsPayload, type CurrentWorkSelection, type WorkFieldsValue } from './timeEntryWorkForm'

const serviceTypes: ServiceType[] = [
  {
    id: 1,
    name: 'Bookkeeping',
    description: null,
    color: null,
    position: 1,
    tasks: [
      { id: 12, name: 'Payroll Data Entry', description: null, position: 2 },
      { id: 11, name: 'Bank Reconciliation', description: null, position: 1 },
    ],
  },
  {
    id: 2,
    name: 'Payroll',
    description: null,
    color: null,
    position: 2,
    tasks: [{ id: 21, name: 'Payroll Processing', description: null, position: 1 }],
  },
]

const clients = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  name: index === 0 ? "MoSa's" : `Person ${index}`,
  business_name: index === 0 ? "MoSa's" : null,
  first_name: index === 0 ? 'Maria' : 'Pat',
  last_name: index === 0 ? 'Santos' : `Number${index}`,
  client_type: index === 0 ? 'business' : 'individual',
}))

function Harness({ initial = EMPTY_WORK_FIELDS, current = null, onValue }: { initial?: WorkFieldsValue; current?: CurrentWorkSelection | null; onValue?: (value: WorkFieldsValue) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <TimeEntryWorkFields
      idPrefix="test"
      value={value}
      onChange={(next) => { setValue(next); onValue?.(next) }}
      clients={clients}
      serviceTypes={serviceTypes}
      current={current}
      referenceDate="2026-08-14"
    />
  )
}

function optionNames(select: HTMLElement) {
  return within(select).getAllByRole('option').map(option => option.textContent)
}

describe('TimeEntryWorkFields', () => {
  it('keeps Task disabled until a category is chosen and lists only that category\'s tasks in order', () => {
    render(<Harness />)

    const task = screen.getByLabelText('Task') as HTMLSelectElement
    expect(task).toBeDisabled()
    expect(optionNames(screen.getByLabelText('Category'))).toEqual(['Select category…', 'Bookkeeping', 'Payroll'])

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '1' } })
    expect(task).not.toBeDisabled()
    expect(optionNames(task)).toEqual(['Select task…', 'Bank Reconciliation', 'Payroll Data Entry'])

    fireEvent.change(task, { target: { value: '11' } })
    expect(task.value).toBe('11')

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '2' } })
    expect(task.value).toBe('')
    expect(optionNames(task)).toEqual(['Select task…', 'Payroll Processing'])
  })

  it('records a quarter period and shows its label', () => {
    let latest = EMPTY_WORK_FIELDS
    render(<Harness onValue={(value) => { latest = value }} />)

    fireEvent.change(screen.getByLabelText('Period type'), { target: { value: 'quarter' } })
    // Prefilled from the work date (Aug 14 → 3rd quarter).
    expect(screen.getByText('3rd Quarter 2026')).toBeInTheDocument()
    expect(latest).toMatchObject({ period_type: 'quarter', period_start: '2026-07-01' })

    fireEvent.change(screen.getByLabelText('Period quarter'), { target: { value: '4' } })
    expect(latest.period_start).toBe('2026-10-01')

    fireEvent.change(screen.getByLabelText('Period type'), { target: { value: '' } })
    expect(latest).toMatchObject({ period_type: '', period_start: '' })
    expect(workFieldsPayload(latest)).toMatchObject({ period_type: null, period_start: null })
  })

  it('searches clients by business or contact name', () => {
    render(<Harness />)

    fireEvent.change(screen.getByLabelText('Search client list'), { target: { value: 'santos' } })
    expect(optionNames(screen.getByLabelText(/^Client/, { selector: 'select' }))).toEqual(['Internal – no client', "MoSa's"])
    expect(screen.getByText('1 match')).toBeInTheDocument()
  })

  it('keeps an entry\'s inactive category and task selectable when editing', () => {
    render(
      <Harness
        initial={{ ...EMPTY_WORK_FIELDS, service_type_id: '9', service_task_id: '90' }}
        current={{ service_type: { id: 9, name: 'Old Advisory' }, service_task: { id: 90, name: 'Retired task' } }}
      />,
    )

    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('9')
    expect(screen.getByRole('option', { name: 'Old Advisory (inactive)' })).toBeInTheDocument()
    expect((screen.getByLabelText('Task') as HTMLSelectElement).value).toBe('90')
  })

  it('never sends the legacy category and drops a task without a category', () => {
    expect(workFieldsPayload({ ...EMPTY_WORK_FIELDS, service_task_id: '11' })).toEqual({
      client_id: null,
      service_type_id: null,
      service_task_id: null,
      period_type: null,
      period_start: null,
      description: '',
    })
  })
})
