import { describe, expect, it } from 'vitest'
import type { HoursReportFilters } from '../components/time-tracking/HoursReportWorkspace'
import { buildHoursReportParams, normalizeReportFilters } from './hoursReportParams'

const base: HoursReportFilters = {
  start_date: '2026-07-01',
  end_date: '2026-07-31',
  user_id: '',
  time_category_id: '',
  client_id: '',
  service_type_id: '',
  service_task_id: '',
  period_type: '',
  period_start: '',
  status: '',
  entry_method: '',
  overtime_status: '',
}

describe('normalizeReportFilters', () => {
  it('keeps the current category over a legacy one', () => {
    expect(normalizeReportFilters({ ...base, service_type_id: '3', time_category_id: '9' })).toMatchObject({ service_type_id: '3', time_category_id: '' })
    expect(normalizeReportFilters({ ...base, time_category_id: '9' })).toMatchObject({ time_category_id: '9' })
  })

  it('drops a task without its category', () => {
    expect(normalizeReportFilters({ ...base, service_task_id: '7' }).service_task_id).toBe('')
    expect(normalizeReportFilters({ ...base, service_type_id: '3', service_task_id: '7' }).service_task_id).toBe('7')
  })

  it('keeps only complete, aligned periods', () => {
    expect(normalizeReportFilters({ ...base, period_type: 'quarter' })).toMatchObject({ period_type: '', period_start: '' })
    expect(normalizeReportFilters({ ...base, period_start: '2026-07-01' })).toMatchObject({ period_type: '', period_start: '' })
    expect(normalizeReportFilters({ ...base, period_type: 'quarter', period_start: '2026-08-01' })).toMatchObject({ period_type: '', period_start: '' })
    expect(normalizeReportFilters({ ...base, period_type: 'week', period_start: '2026-07-01' })).toMatchObject({ period_type: '', period_start: '' })
    expect(normalizeReportFilters({ ...base, period_type: 'quarter', period_start: '2026-07-01' })).toMatchObject({ period_type: 'quarter', period_start: '2026-07-01' })
  })
})

describe('buildHoursReportParams', () => {
  it('builds the same normalized params for preview and download', () => {
    expect(buildHoursReportParams({ ...base, client_id: '5', service_type_id: '3', service_task_id: '7', time_category_id: '9', period_type: 'month', period_start: '2026-07-01' })).toEqual({
      start_date: '2026-07-01',
      end_date: '2026-07-31',
      approval_status: 'approved_or_standard',
      client_id: 5,
      service_type_id: 3,
      service_task_id: 7,
      period_type: 'month',
      period_start: '2026-07-01',
    })
  })
})
