import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { HoursReportEntry, TimeEntry, WorkLine } from '../../lib/api'
import { entryComments } from '../../lib/timeEntryWork'
import EntryWorkDetails, { EntryWorkCompact, ReportEntryWork } from './EntryWorkDetails'

const line = (patch: Partial<WorkLine>): WorkLine => ({
  id: 1, position: 0, client: null, client_label: 'Unassigned', description: null, service_type: null, service_task: null,
  category_label: null, period_type: null, period_start: null, period_label: null, hours: 1, minutes: 60, ...patch,
})

const entry = (patch: Partial<TimeEntry>): TimeEntry => ({
  id: 7, work_date: '2026-11-20', status: 'completed', entry_method: 'manual', hours: 2, client: null, service_type: null,
  service_task: null, time_category: null, tax_return: null, period_type: null, period_start: null, period_label: null, description: null,
  work_lines: [], ...patch,
} as unknown as TimeEntry)

const mosas = line({ id: 1, client: { id: 2, name: "MoSa's" }, client_label: "MoSa's", service_type: { id: 12, name: 'Bookkeeping', color: null }, category_label: 'Bookkeeping', service_task: { id: 5, name: 'Bank Reconciliation' }, period_type: 'month', period_start: '2026-07-01', period_label: 'July 2026', description: 'Bank recs', minutes: 90 })
const scr = line({ id: 2, position: 1, client: { id: 3, name: 'SCR' }, client_label: 'SCR', service_type: { id: 13, name: 'Payroll', color: null }, category_label: 'Payroll', period_type: 'quarter', period_start: '2026-07-01', period_label: '3rd Quarter 2026', description: 'Payroll return', minutes: 30 })
// The entry-level fields mirror line 1 (MoSa's).
const splitEntry = entry({ client: { id: 2, name: "MoSa's" }, description: 'Bank recs; Payroll return', work_lines: [mosas, scr] } as Partial<TimeEntry>)

describe('EntryWorkDetails (Time Entries card)', () => {
  it('shows a split entry as one row per line, never "Internal · Uncategorized"', () => {
    render(<EntryWorkDetails entry={splitEntry} />)

    const rows = within(screen.getByRole('list', { name: 'Work lines' })).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent("MoSa'sBookkeepingBank ReconciliationJuly 20261h 30mBank recs")
    expect(rows[0]).toHaveAttribute('title', "MoSa's · Bookkeeping · Bank Reconciliation · July 2026")
    expect(rows[1]).toHaveTextContent('SCRPayroll3rd Quarter 202630mPayroll return')
    expect(screen.queryByText(/Internal/)).not.toBeInTheDocument()
    expect(entryComments(splitEntry)).toBeNull()
  })

  it('says "No client" on a split line without one, and shows no chip for a missing category', () => {
    render(<EntryWorkDetails entry={entry({ work_lines: [mosas, line({ id: 2, position: 1, description: 'Errands', minutes: 60 })] })} />)
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[1]).getByText('No client')).toHaveClass('text-amber-700')
    expect(rows[1]).toHaveTextContent(/^No client1hErrands$/)
    expect(screen.queryByText('Uncategorized')).not.toBeInTheDocument()
    expect(screen.queryByText('Unassigned')).not.toBeInTheDocument()
  })

  it('shows a split line with a legacy category as the category, marked Legacy', () => {
    render(<EntryWorkDetails entry={entry({ work_lines: [mosas, line({ id: 2, position: 1, client: { id: 3, name: 'SCR' }, client_label: 'SCR', category_label: 'Tax Prep (legacy)' })] })} />)
    expect(screen.getAllByRole('listitem')[1]).toHaveTextContent(/^SCRTax PrepLegacy1h$/)
  })

  it('renders one line of a split entry from the line, not the entry (a client-filtered report)', () => {
    // Filtered to SCR: the entry-level client is still MoSa's (line 1).
    const slice = entry({ client: { id: 2, name: "MoSa's" }, service_type: { id: 12, name: 'Bookkeeping' }, description: 'Bank recs; Payroll return', work_lines: [scr] } as Partial<TimeEntry>)
    render(<EntryWorkDetails entry={slice} />)
    expect(screen.getByTestId('entry-work')).toHaveTextContent(/^SCRPayroll3rd Quarter 2026$/)
    expect(entryComments(slice)).toBe('Payroll return')
  })

  it('keeps the single-line look: client, category, task and period chips', () => {
    const internal = line({ client: { id: 1, name: 'Internal – Cornerstone' }, client_label: 'Internal – Cornerstone', service_type: { id: 8, name: 'Office & errands', color: null }, category_label: 'Office & errands', period_type: 'month', period_start: '2026-11-01' })
    render(<EntryWorkDetails entry={entry({ client: { id: 1, name: 'Internal – Cornerstone' }, work_lines: [internal] } as Partial<TimeEntry>)} />)
    // The period falls back to the type and start when there's no label.
    expect(screen.getByTestId('entry-work')).toHaveTextContent(/^Internal – CornerstoneOffice & errandsNovember 2026$/)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('adds the tax return year to the entry\'s own client only', () => {
    const { unmount } = render(<EntryWorkDetails entry={entry({ client: { id: 2, name: "MoSa's" }, tax_return: { id: 4, tax_year: 2025 }, work_lines: [mosas] } as Partial<TimeEntry>)} />)
    expect(screen.getByText("MoSa's (2025)")).toBeInTheDocument()
    unmount()
    // A report filtered to SCR returns the SCR line of an entry whose return is MoSa's.
    render(<EntryWorkDetails entry={entry({ client: { id: 2, name: "MoSa's" }, tax_return: { id: 4, tax_year: 2025 }, work_lines: [scr] } as Partial<TimeEntry>)} />)
    expect(screen.getByText('SCR')).toBeInTheDocument()
    expect(screen.queryByText(/2025/)).not.toBeInTheDocument()
  })

  it('uses the entry fields for a legacy entry without lines', () => {
    render(<EntryWorkDetails entry={entry({ client: { id: 2, name: "MoSa's" }, time_category: { id: 9, name: 'Tax Prep' }, work_lines: [] } as Partial<TimeEntry>)} />)
    expect(screen.getByTestId('entry-work')).toHaveTextContent(/^MoSa'sTax PrepLegacy$/)
  })

  it('says "No client" for a finished entry without one', () => {
    render(<EntryWorkDetails entry={entry({})} />)
    expect(screen.getByText('No client')).toHaveClass('text-amber-700')
    expect(screen.getByText('Uncategorized')).toBeInTheDocument()
    expect(screen.queryByText(/Internal/)).not.toBeInTheDocument()
  })

  it.each(['clocked_in', 'on_break'] as const)('says "No client yet" for a %s clock with no client, and no "Uncategorized"', (status) => {
    render(<EntryWorkDetails entry={entry({ status, entry_method: 'clock', work_lines: [] })} />)
    expect(screen.getByTestId('entry-work')).toHaveTextContent(/^No client yet$/)
  })

  it('shows a running clock\'s client when it is known', () => {
    render(<EntryWorkDetails entry={entry({ status: 'clocked_in', entry_method: 'clock', client: { id: 2, name: "MoSa's" } })} />)
    expect(screen.getByTestId('entry-work')).toHaveTextContent(/^MoSa's$/)
  })
})

describe('EntryWorkCompact (desktop Week view cell)', () => {
  const rowsOf = () => screen.getAllByTestId('week-work-line').map((row) => row.textContent)

  it('shows each line\'s client and time, with every line in full for screen readers and the tooltip', () => {
    render(<EntryWorkCompact entry={splitEntry} />)
    // The visible rows have a hidden separator, so they never read as "SCR30m".
    expect(rowsOf()).toEqual(["MoSa's, 1h 30m", 'SCR, 30m'])
    const cell = screen.getByTestId('week-work-lines')
    expect(cell.querySelector('[aria-hidden="true"]')).toContainElement(screen.getAllByTestId('week-work-line')[0])
    expect(cell.querySelector('.sr-only:last-child')).toHaveTextContent(
      "2 work lines: MoSa's · Bookkeeping · Bank Reconciliation · July 2026 — Bank recs, 1h 30m; SCR · Payroll · 3rd Quarter 2026 — Payroll return, 30m.",
    )
    expect(cell).toHaveAttribute('title', "MoSa's · Bookkeeping · Bank Reconciliation · July 2026 — Bank recs, 1h 30m\nSCR · Payroll · 3rd Quarter 2026 — Payroll return, 30m")
  })

  it('shows three lines and "+N more", and keeps the fourth for screen readers', () => {
    const lines = [mosas, scr, line({ id: 3, position: 2 }), line({ id: 4, position: 3, client: { id: 3, name: 'SCR' }, client_label: 'SCR', description: 'Fourth' })]
    render(<EntryWorkCompact entry={entry({ work_lines: lines })} />)
    expect(rowsOf()).toEqual(["MoSa's, 1h 30m", 'SCR, 30m', 'No client, 1h'])
    expect(screen.getByText('+1 more')).toBeInTheDocument()
    expect(within(screen.getAllByTestId('week-work-line')[2]).getByText('No client')).toHaveClass('text-amber-700')
    expect(screen.getByTestId('week-work-lines').querySelector('.sr-only:last-child')).toHaveTextContent(/SCR — Fourth, 1h\.$/)
  })

  it('shows a single line as client, category / task and period', () => {
    const { container } = render(<EntryWorkCompact entry={entry({ client: { id: 2, name: "MoSa's" }, work_lines: [mosas] } as Partial<TimeEntry>)} />)
    expect(Array.from(container.children).map((row) => row.textContent)).toEqual(["MoSa's", 'Bookkeeping / Bank Reconciliation', 'July 2026'])
  })

  it('marks a legacy category on an entry without lines', () => {
    const { container } = render(<EntryWorkCompact entry={entry({ client: { id: 2, name: "MoSa's" }, time_category: { id: 9, name: 'Tax Prep' } } as Partial<TimeEntry>)} />)
    expect(Array.from(container.children).map((row) => row.textContent)).toEqual(["MoSa's", 'Tax Prep (legacy)'])
  })

  it('marks a legacy category on a single line', () => {
    const { container } = render(<EntryWorkCompact entry={entry({ work_lines: [line({ client: { id: 3, name: 'SCR' }, client_label: 'SCR', category_label: 'Tax Prep (legacy)' })] })} />)
    expect(Array.from(container.children).map((row) => row.textContent)).toEqual(['SCR', 'Tax Prep (legacy)'])
  })

  it.each(['clocked_in', 'on_break'] as const)('says "No client yet" for a %s clock without a client', (status) => {
    const { container } = render(<EntryWorkCompact entry={entry({ status, entry_method: 'clock' })} />)
    expect(Array.from(container.children).map((row) => row.textContent)).toEqual(['No client yet'])
  })

  it('says "No client" in amber for a finished entry without one', () => {
    render(<EntryWorkCompact entry={entry({})} />)
    expect(screen.getByText('No client')).toHaveClass('text-amber-700')
  })
})

describe('ReportEntryWork (hours report)', () => {
  const reportLine = (source: WorkLine) => {
    const { hours, ...rest } = source
    return { ...rest, total_hours: hours, regular_hours: hours, overtime_hours: 0 }
  }
  const reportEntry = (patch: Partial<HoursReportEntry>) => ({ ...splitEntry, entry_method: 'manual', ...patch } as unknown as HoursReportEntry)

  it('lists the lines of a split entry', () => {
    render(<ReportEntryWork entry={reportEntry({ work_lines: [reportLine(mosas), reportLine(scr)] })} showComments />)
    expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      "MoSa's · Bookkeeping · Bank Reconciliation · July 2026 — Bank recs · 1h 30m",
      'SCR · Payroll · 3rd Quarter 2026 — Payroll return · 30m',
    ])
  })

  it('shows a client-filtered slice by its own line, not the entry-level client', () => {
    render(<ReportEntryWork entry={reportEntry({ work_lines: [reportLine(scr)] })} showComments />)
    expect(screen.getByText('SCR · Payroll · 3rd Quarter 2026 · manual')).toBeInTheDocument()
    expect(screen.getByText('Payroll return')).toBeInTheDocument()
    expect(screen.queryByText(/MoSa's/)).not.toBeInTheDocument()
  })
})
