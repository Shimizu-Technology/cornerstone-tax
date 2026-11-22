import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TimeEntry, WorkLine } from '../../lib/api'
import EntryWorkDetails from './EntryWorkDetails'

const line = (patch: Partial<WorkLine>): WorkLine => ({
  id: 1, position: 0, client: null, client_label: 'Unassigned', description: null, service_type: null, service_task: null,
  category_label: null, period_type: null, period_start: null, period_label: null, hours: 1, minutes: 60, ...patch,
})

const entry = (patch: Partial<TimeEntry>): TimeEntry => ({
  id: 7, work_date: '2026-11-20', status: 'completed', entry_method: 'manual', hours: 2, client: null, service_type: null,
  service_task: null, time_category: null, period_type: null, period_start: null, period_label: null, description: null,
  work_lines: [], ...patch,
} as unknown as TimeEntry)

describe('EntryWorkDetails (Time Entries card)', () => {
  it('shows a split entry as one row per line, never "Internal · Uncategorized"', () => {
    render(<EntryWorkDetails entry={entry({
      description: 'Bank recs; Payroll return',
      work_lines: [
        line({ id: 1, client: { id: 2, name: "MoSa's" }, client_label: "MoSa's", service_type: { id: 12, name: 'Bookkeeping', color: null }, category_label: 'Bookkeeping', service_task: { id: 5, name: 'Bank Reconciliation' }, period_label: 'July 2026', description: 'Bank recs', minutes: 90 }),
        line({ id: 2, position: 1, client: { id: 3, name: 'SCR' }, client_label: 'SCR', service_type: { id: 13, name: 'Payroll', color: null }, category_label: 'Payroll', period_label: '3rd Quarter 2026', description: 'Payroll return', minutes: 30 }),
      ],
    })} />)

    const rows = within(screen.getByRole('list', { name: 'Work lines' })).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent("MoSa'sBookkeepingBank ReconciliationJuly 20261h 30mBank recs")
    expect(rows[0]).toHaveAttribute('title', "MoSa's · Bookkeeping · Bank Reconciliation · July 2026")
    expect(rows[1]).toHaveTextContent('SCRPayroll3rd Quarter 202630mPayroll return')
    expect(screen.queryByText(/Internal/)).not.toBeInTheDocument()
    expect(screen.queryByText('Uncategorized')).not.toBeInTheDocument()
  })

  it('says "No client" on a split line without a client', () => {
    render(<EntryWorkDetails entry={entry({
      work_lines: [
        line({ id: 1, client: { id: 2, name: "MoSa's" }, client_label: "MoSa's", minutes: 60 }),
        line({ id: 2, position: 1, description: 'Errands', minutes: 60 }),
      ],
    })} />)
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[1]).getByText('No client')).toHaveClass('text-amber-700')
    expect(screen.queryByText('Unassigned')).not.toBeInTheDocument()
  })

  it('keeps the single-line look: client, category, task and period chips', () => {
    render(<EntryWorkDetails entry={entry({
      client: { id: 1, name: 'Internal – Cornerstone' }, service_type: { id: 8, name: 'Office & errands' }, period_label: 'November 2026',
      work_lines: [line({ client: { id: 1, name: 'Internal – Cornerstone' }, client_label: 'Internal – Cornerstone' })],
    } as Partial<TimeEntry>)} />)
    const work = screen.getByTestId('entry-work')
    expect(work).toHaveTextContent('Internal – CornerstoneOffice & errandsNovember 2026')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('says "No client" for a finished entry without one', () => {
    render(<EntryWorkDetails entry={entry({})} />)
    expect(screen.getByText('No client')).toHaveClass('text-amber-700')
    expect(screen.getByText('Uncategorized')).toBeInTheDocument()
    expect(screen.queryByText(/Internal/)).not.toBeInTheDocument()
  })

  it('says "No client yet" for a running clock with no client, and no "Uncategorized"', () => {
    render(<EntryWorkDetails entry={entry({ status: 'clocked_in', entry_method: 'clock', work_lines: [] })} />)
    expect(screen.getByTestId('entry-work')).toHaveTextContent(/^No client yet$/)
  })

  it('shows a running clock\'s client when it is known', () => {
    render(<EntryWorkDetails entry={entry({ status: 'clocked_in', entry_method: 'clock', client: { id: 2, name: "MoSa's" } })} />)
    expect(screen.getByTestId('entry-work')).toHaveTextContent(/^MoSa's$/)
  })
})
