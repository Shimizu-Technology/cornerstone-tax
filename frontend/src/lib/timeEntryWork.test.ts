import { describe, expect, it } from 'vitest'
import {
  categoryFilterValue,
  workLineSummary,
  workLineText,
  parsePeriodOptionValue,
  periodOptionGroups,
  periodOptionValue,
  clientOptionLabel,
  filterClientOptions,
  parseCategoryFilter,
  periodLabel,
  periodStartContaining,
  periodStartFor,
  sortClientOptions,
  categoriesForClient,
  workCategoryText,
  workSummary,
} from './timeEntryWork'

describe('periodLabel', () => {
  it('labels months, quarters and years the way staff read them', () => {
    expect(periodLabel('month', '2026-07-01')).toBe('July 2026')
    expect(periodLabel('month', '2026-11-01')).toBe('November 2026')
    expect(periodLabel('quarter', '2026-01-01')).toBe('1st Quarter 2026')
    expect(periodLabel('quarter', '2026-04-01')).toBe('2nd Quarter 2026')
    expect(periodLabel('quarter', '2026-07-01')).toBe('3rd Quarter 2026')
    expect(periodLabel('quarter', '2026-10-01')).toBe('4th Quarter 2026')
    expect(periodLabel('year', '2026-01-01')).toBe('2026')
  })

  it('returns null without a complete period', () => {
    expect(periodLabel(null, '2026-07-01')).toBeNull()
    expect(periodLabel('month', null)).toBeNull()
    expect(periodLabel('week', '2026-07-01')).toBeNull()
  })
})

describe('period starts', () => {
  it('finds the first day of the period containing a date', () => {
    expect(periodStartContaining('month', '2026-07-19')).toBe('2026-07-01')
    expect(periodStartContaining('quarter', '2026-08-19')).toBe('2026-07-01')
    expect(periodStartContaining('quarter', '2026-12-31')).toBe('2026-10-01')
    expect(periodStartContaining('year', '2026-08-19')).toBe('2026-01-01')
  })

  it('builds a start from the month or quarter number', () => {
    expect(periodStartFor('month', 2026, 11)).toBe('2026-11-01')
    expect(periodStartFor('quarter', 2026, 3)).toBe('2026-07-01')
    expect(periodStartFor('year', 2026)).toBe('2026-01-01')
  })
})

describe('client options', () => {
  const clients = [
    { id: 1, name: "MoSa's", business_name: "MoSa's", first_name: 'Maria', last_name: 'Santos', client_type: 'business' },
    { id: 2, name: 'Jose Cruz', business_name: null, first_name: 'Jose', last_name: 'Cruz', client_type: 'individual' },
    { id: 3, name: 'SCR', business_name: 'SCR', first_name: 'Sam', last_name: 'Reyes', client_type: 'business' },
  ]

  it('uses the server label and falls back to the contact name', () => {
    expect(clientOptionLabel(clients[0])).toBe("MoSa's")
    expect(clientOptionLabel({ id: 9, first_name: 'Ana', last_name: 'Reyes' })).toBe('Ana Reyes')
    expect(clientOptionLabel({ id: 10 })).toBe('Client #10')
  })

  it('sorts the internal client first, then businesses, then individuals', () => {
    const internal = { id: 4, name: 'Internal – Cornerstone', client_type: 'business', system_kind: 'internal' }
    expect(sortClientOptions([...clients, internal]).map(client => client.name)).toEqual(['Internal – Cornerstone', "MoSa's", 'SCR', 'Jose Cruz'])
  })

  it('offers internal categories only for internal work', () => {
    const categories = [{ id: 1, internal: false }, { id: 2, internal: true }]
    expect(categoriesForClient(categories, { id: 4, system_kind: 'internal' }).map(c => c.id)).toEqual([2])
    expect(categoriesForClient(categories, clients[0]).map(c => c.id)).toEqual([1])
    expect(categoriesForClient(categories, null).map(c => c.id)).toEqual([1, 2])
  })

  it('searches business name, first name and last name', () => {
    expect(filterClientOptions(clients, 'mosa').map(client => client.id)).toEqual([1])
    expect(filterClientOptions(clients, 'maria').map(client => client.id)).toEqual([1])
    expect(filterClientOptions(clients, 'reyes').map(client => client.id)).toEqual([3])
    expect(filterClientOptions(clients, 'jose cruz').map(client => client.id)).toEqual([2])
    expect(filterClientOptions(clients, '  ')).toHaveLength(3)
  })
})

describe('work category', () => {
  it('prefers the category and marks legacy time categories', () => {
    expect(workCategoryText({ service_type: { id: 1, name: 'Bookkeeping' }, time_category: { id: 4, name: 'Tax Prep' } })).toBe('Bookkeeping')
    expect(workCategoryText({ service_type: null, time_category: { id: 4, name: 'Tax Prep' } })).toBe('Tax Prep (legacy)')
    expect(workCategoryText({ service_type: null, time_category: null })).toBe('Uncategorized')
  })

  it('summarizes client, category, task and period in logging order', () => {
    expect(workSummary({
      client: { name: 'SCR' },
      service_type: { id: 2, name: 'Payroll' },
      service_task: { name: 'Payroll Return Preparation' },
      period_type: 'quarter',
      period_start: '2026-07-01',
    })).toBe('SCR · Payroll · Payroll Return Preparation · 3rd Quarter 2026')
    expect(workSummary({ client: null, service_type: null, time_category: null })).toBe('Internal · Uncategorized')
  })

  it('encodes category filters for current and legacy categories', () => {
    expect(categoryFilterValue('3', '')).toBe('st:3')
    expect(categoryFilterValue('', '9')).toBe('tc:9')
    expect(parseCategoryFilter('st:3')).toEqual({ service_type_id: '3', time_category_id: '' })
    expect(parseCategoryFilter('tc:9')).toEqual({ service_type_id: '', time_category_id: '9' })
    expect(parseCategoryFilter('')).toEqual({ service_type_id: '', time_category_id: '' })
  })
})

describe('workLineSummary and workLineText', () => {
  const line = {
    client_label: "MoSa's",
    service_type: { id: 1, name: 'Bookkeeping' },
    category_label: 'Bookkeeping',
    service_task: { name: 'Bank Reconciliation' },
    period_label: 'July 2026',
    description: null as string | null,
  }

  it("reads in the owner's order: client, category, task, period", () => {
    expect(workLineSummary(line)).toBe("MoSa's · Bookkeeping · Bank Reconciliation · July 2026")
    expect(workLineText(line)).toBe("MoSa's · Bookkeeping · Bank Reconciliation · July 2026")
  })

  it('adds the comments after the line', () => {
    expect(workLineText({ ...line, service_task: null, period_label: null, description: 'Filed late' })).toBe("MoSa's · Bookkeeping — Filed late")
  })

  it('leaves out a missing category and keeps a legacy label', () => {
    expect(workLineSummary({ client_label: 'SCR', service_type: null, category_label: null })).toBe('SCR')
    expect(workLineSummary({ client_label: 'SCR', service_type: null, category_label: 'Tax Prep (legacy)' })).toBe('SCR · Tax Prep (legacy)')
  })
})

describe('periodOptionGroups', () => {
  const labels = (reference: string, current?: { period_type: 'month' | 'quarter' | 'year' | ''; period_start: string }) =>
    Object.fromEntries(periodOptionGroups(reference, current).map((group) => [group.label, group.options.map((option) => option.label)]))

  it('lists next month back to 12 months ago across a year boundary', () => {
    const months = labels('2027-01-15').Months
    expect(months[0]).toBe('February 2027')
    expect(months[1]).toBe('January 2027')
    expect(months[2]).toBe('December 2026')
    expect(months.at(-1)).toBe('January 2026')
    expect(months).toHaveLength(14)
  })

  it('lists next quarter back 4 quarters, and next year back to 2 years ago', () => {
    const groups = labels('2026-12-31')
    expect(groups.Quarters).toEqual(['1st Quarter 2027', '4th Quarter 2026', '3rd Quarter 2026', '2nd Quarter 2026', '1st Quarter 2026', '4th Quarter 2025'])
    expect(groups.Years).toEqual(['Year 2027', 'Year 2026', 'Year 2025', 'Year 2024'])
  })

  it('keeps an out-of-range saved period at the top of its group, once', () => {
    expect(labels('2026-11-18', { period_type: 'year', period_start: '2019-01-01' }).Years[0]).toBe('Year 2019')
    expect(labels('2026-11-18', { period_type: 'quarter', period_start: '2026-07-01' }).Quarters.filter((label) => label === '3rd Quarter 2026')).toHaveLength(1)
  })

  it('round-trips the select value', () => {
    expect(periodOptionValue('quarter', '2026-07-01')).toBe('quarter:2026-07-01')
    expect(periodOptionValue('', '')).toBe('')
    expect(parsePeriodOptionValue('quarter:2026-07-01')).toEqual({ period_type: 'quarter', period_start: '2026-07-01' })
    expect(parsePeriodOptionValue('')).toEqual({ period_type: '', period_start: '' })
    expect(parsePeriodOptionValue('week:2026-07-01')).toEqual({ period_type: '', period_start: '' })
  })
})
