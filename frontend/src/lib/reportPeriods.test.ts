import { describe, expect, it } from 'vitest'
import { reportPeriodForPreset, reportPeriodFromSearchParams } from './reportPeriods'

describe('report periods', () => {
  const now = new Date(2026, 8, 22, 10, 30)

  it('uses month-to-date and half-month-to-date for current periods', () => {
    expect(reportPeriodForPreset('this_month', now)).toEqual({ start: '2026-09-01', end: '2026-09-22' })
    expect(reportPeriodForPreset('current_period', now)).toEqual({ start: '2026-09-16', end: '2026-09-22' })
  })

  it('uses the complete prior half-month', () => {
    expect(reportPeriodForPreset('previous_period', now)).toEqual({ start: '2026-09-01', end: '2026-09-15' })
  })

  it('restores a valid unlimited custom range from the URL', () => {
    const params = new URLSearchParams('start_date=2025-01-01&end_date=2026-09-22')
    expect(reportPeriodFromSearchParams(params, { start: '2026-09-01', end: '2026-09-22' })).toEqual({ start: '2025-01-01', end: '2026-09-22' })
  })
})
