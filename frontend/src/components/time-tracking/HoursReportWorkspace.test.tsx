import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { HoursReportEmployee, HoursReportResponse, TimeEntry } from '../../lib/api'
import HoursReportWorkspace, { type HoursReportFilters } from './HoursReportWorkspace'

vi.mock('./ReportExportActions', () => ({ default: () => null }))

const filters: HoursReportFilters = {
  start_date: '2026-01-25',
  end_date: '2026-09-21',
  user_id: '42',
  time_category_id: '',
  client_id: '',
  status: '',
  entry_method: '',
  overtime_status: '',
}

const entry: TimeEntry = {
  id: 101,
  work_date: '2026-09-21',
  start_time: '08:00',
  end_time: '20:00',
  formatted_start_time: '8:00 AM',
  formatted_end_time: '8:00 PM',
  hours: 12,
  regular_hours: 8,
  overtime_hours: 4,
  break_minutes: 0,
  description: null,
  entry_method: 'manual',
  status: 'completed',
  admin_override: false,
  attendance_status: null,
  approval_status: 'approved',
  overtime_status: 'approved',
  clock_in_at: null,
  clock_out_at: null,
  approved_by: null,
  approved_at: null,
  approval_note: null,
  overtime_approved_by: null,
  overtime_approved_at: null,
  overtime_note: null,
  schedule: null,
  breaks: [],
  user: { id: 42, email: 'daena@example.com', display_name: 'Daena', full_name: 'Daena Mansapit' },
  time_category: null,
  client: null,
  tax_return: null,
  service_type: null,
  service_task: null,
  linked_operation_task: null,
  locked_at: null,
  created_at: '',
  updated_at: '',
  review_flags: ['uncategorized', 'missing_client', 'missing_description', 'long_shift'],
}

const reportEntry = {
  id: entry.id,
  work_date: entry.work_date,
  start_time: entry.start_time,
  end_time: entry.end_time,
  formatted_start_time: entry.formatted_start_time,
  formatted_end_time: entry.formatted_end_time,
  total_hours: entry.hours,
  regular_hours: entry.regular_hours || 0,
  overtime_hours: entry.overtime_hours || 0,
  break_minutes: 0,
  description: null,
  entry_method: 'manual',
  approval_status: 'approved',
  approved_by: null,
  approved_at: null,
  overtime_status: 'approved',
  overtime_approved_by: null,
  overtime_approved_at: null,
  locked_at: null,
  review_flags: entry.review_flags || [],
  time_category: null,
  client: null,
  tax_return: null,
  service_type: null,
  service_task: null,
  breaks: [],
}

const quality = {
  status: 'needs_review' as const,
  flagged_entries_count: 1,
  uncategorized_count: 1,
  missing_client_count: 1,
  missing_description_count: 1,
  long_shift_count: 1,
  overlapping_entry_count: 0,
  long_shift_threshold_hours: 12,
}

const employee: HoursReportEmployee = {
  id: 42,
  email: 'daena@example.com',
  first_name: 'Daena',
  last_name: 'Mansapit',
  display_name: 'Daena',
  full_name: 'Daena Mansapit',
  role: 'employee',
  status: 'terminated',
  total_hours: 660.38,
  regular_hours: 602.38,
  overtime_hours: 58,
  break_hours: 2,
  entries_count: 152,
  days_worked: 92,
  first_work_date: '2026-01-25',
  last_work_date: '2026-09-21',
  ready: true,
  issues: { pending_count: 0, denied_count: 0, pending_overtime_count: 0, denied_overtime_count: 0, open_clock_count: 0 },
  quality,
  excluded_entries: [],
  days: [{ work_date: entry.work_date, total_hours: 12, regular_hours: 8, overtime_hours: 4, break_hours: 0, entries: [reportEntry] }],
  categories: [{ id: null, name: 'Uncategorized', total_hours: 12, regular_hours: 8, overtime_hours: 4, break_hours: 0, entries_count: 1 }],
  clients: [{ id: null, name: 'No client', total_hours: 12, regular_hours: 8, overtime_hours: 4, break_hours: 0, entries_count: 1 }],
  services: [],
  weeks: [],
}

const report: HoursReportResponse = {
  start_date: filters.start_date,
  end_date: filters.end_date,
  context_start_date: '2026-01-25',
  context_end_date: '2026-09-26',
  generated_at: '2026-09-21T12:00:00Z',
  ready: true,
  quality,
  finalization: { status: 'not_finalized', label: 'Not finalized', selected_days: 240, finalized_days: 0, locks: [] },
  filters: {},
  overtime_policy: { daily_threshold_hours: 8, weekly_threshold_hours: 40 },
  summary: {
    employee_count: 1,
    total_hours: 660.38,
    regular_hours: 602.38,
    overtime_hours: 58,
    break_hours: 2,
    entries_count: 152,
    pending_count: 0,
    denied_count: 0,
    pending_overtime_count: 0,
    denied_overtime_count: 0,
    open_clock_count: 0,
  },
  employees: [employee],
}

function renderWorkspace(view: 'overview' | 'people' | 'daily' | 'review', onEditEntry = vi.fn()) {
  return render(
    <HoursReportWorkspace
      filters={filters}
      onFiltersChange={vi.fn()}
      report={report}
      entries={[entry]}
      loading={false}
      error={null}
      users={[{ id: 42, email: 'daena@example.com', display_name: 'Daena', employment_status: 'terminated' }]}
      categories={[]}
      clients={[]}
      exporting={null}
      onExport={vi.fn()}
      onOpenEmployee={vi.fn()}
      onEditEntry={onEditEntry}
      view={view}
      onViewChange={vi.fn()}
    />
  )
}

describe('HoursReportWorkspace', () => {
  it('shows exact totals and keeps approval readiness separate from quality review', () => {
    renderWorkspace('overview')

    expect(screen.getByText('660.38h')).toBeInTheDocument()
    expect(screen.getByText('Approval review complete')).toBeInTheDocument()
    expect(screen.getByText('1 entries need a look')).toBeInTheDocument()
    expect(screen.getByText('Flags do not remove hours from payroll totals.')).toBeInTheDocument()
  })

  it('keeps terminated employees visible with their historical range', () => {
    renderWorkspace('people')

    expect(screen.getByText('Daena Mansapit')).toBeInTheDocument()
    expect(screen.getAllByText('Terminated').length).toBeGreaterThan(0)
    expect(screen.getByText(/92 days · 152 entries/)).toBeInTheDocument()
  })

  it('groups daily entries and opens the existing correction flow', () => {
    const onEdit = vi.fn()
    renderWorkspace('daily', onEdit)

    fireEvent.click(screen.getByRole('button', { name: /Mon, Sep 21, 2026/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit entry' }))
    expect(onEdit).toHaveBeenCalledWith(entry)
  })

  it('explains quality flags without excluding approved time', () => {
    renderWorkspace('review')

    expect(screen.getByText('Approved entries with review flags')).toBeInTheDocument()
    expect(screen.getAllByText('No client assigned').length).toBeGreaterThan(0)
    expect(screen.getByText('These hours remain included in the totals.')).toBeInTheDocument()
  })
})
