import { describe, expect, it } from 'vitest'
import { attendanceChanges, checkLines, cumulativeMinutes, draftsFromEntry, linesPayload, newDraft, requirementHint } from './workLinesModel'

describe('cumulativeMinutes', () => {
  it('rounds cumulatively so minutes add up to the stored total', () => {
    expect(cumulativeMinutes([0.02, 0.02, 0.02, 0.02, 0.02, 0.02])).toEqual([1, 1, 2, 1, 1, 1])
    expect(cumulativeMinutes([0.33, 0.34, 0.33])).toEqual([20, 20, 20])
    expect(cumulativeMinutes([0.75, 1.5])).toEqual([45, 90])
  })
})

describe('linesPayload', () => {
  const line = (id: number, client: number, hours: number) => ({
    id, position: id, client: { id: client, name: `C${client}` }, client_label: `C${client}`, description: `Line ${id}`,
    service_type: null, service_task: null, category_label: null, period_type: null, period_start: null, period_label: null, hours, minutes: Math.round(hours * 60),
  })

  it('sends untouched lines back with their exact stored hours', () => {
    const drafts = draftsFromEntry({ hours: 0.12, work_lines: [0, 1, 2, 3, 4, 5].map((index) => line(index, index % 2 ? 7 : 6, 0.02)) })
    drafts[1] = { ...drafts[1], description: 'Changed' }
    const payload = linesPayload(drafts, 7)
    expect(payload.map((row) => row.exact_hours)).toEqual([0.02, 0.02, 0.02, 0.02, 0.02, 0.02])
    expect(payload.every((row) => row.minutes === undefined && row.hours === undefined)).toBe(true)
  })

  it('sends minutes for a line whose time was edited', () => {
    const drafts = draftsFromEntry({ hours: 1, work_lines: [line(0, 6, 0.5), line(1, 7, 0.5)] })
    drafts[0] = { ...drafts[0], durationText: '20' }
    drafts[1] = { ...drafts[1], durationText: '40' }
    expect(linesPayload(drafts, 60).map((row) => [row.exact_hours, row.minutes])).toEqual([[undefined, 20], [undefined, 40]])
  })
})

describe('mixed edits (exact and changed lines)', () => {
  it('sends changed lines as minutes and every untouched line as its exact stored hours', () => {
    const stored = [0.08, 0.08, 0.14, 0.05, 0.17, 0.19]
    const drafts = draftsFromEntry({
      hours: 0.71,
      work_lines: stored.map((hours, index) => ({
        id: index, position: index, client: { id: 6, name: 'C6' }, client_label: 'C6', description: `Line ${index}`,
        service_type: null, service_task: null, category_label: null, period_type: null, period_start: null, period_label: null, hours, minutes: Math.round(hours * 60),
      })),
    })
    expect(drafts.map((draft) => draft.durationText)).toEqual(['5', '5', '8', '3', '10', '12'])

    drafts[0] = { ...drafts[0], durationText: '4' }
    drafts[1] = { ...drafts[1], durationText: '6' }
    const payload = linesPayload(drafts, 43)

    expect(payload.map((row) => row.minutes ?? null)).toEqual([4, 6, null, null, null, null])
    expect(payload.map((row) => row.exact_hours ?? null)).toEqual([null, null, 0.14, 0.05, 0.17, 0.19])
  })
})

describe('attendanceChanges', () => {
  it('includes only fields that differ from the saved entry', () => {
    expect(attendanceChanges({ workDate: ['2026-11-16', '2026-11-16'], startTime: ['08:00', '08:00'], endTime: ['08:07', '08:07'], breakMinutes: [null, null] })).toEqual({})
    expect(attendanceChanges({ workDate: ['2026-11-17', '2026-11-16'], startTime: ['08:00', '08:00'], endTime: ['09:00', '08:07'], breakMinutes: [15, null] }))
      .toEqual({ work_date: '2026-11-17', end_time: '09:00', break_minutes: 15 })
  })
})

describe('checkLines: the work-details rule (client, category, then task)', () => {
  const serviceTypes = [
    { id: 10, name: 'Bookkeeping', description: null, color: null, tasks: [{ id: 100, name: 'Bank reconciliation', description: null }] },
    { id: 20, name: 'Office & errands', description: null, color: null, internal: true, tasks: [] },
  ]
  const check = (patch: Parameters<typeof newDraft>[0], { taskRequired = false, required = true } = {}) => {
    const line = newDraft({ client_id: '2', durationText: '30', ...patch })
    return checkLines([line], { targetMinutes: null, required, serviceTypes, taskRequired }).problems[line.key] ?? []
  }

  it('accepts a client line with a category and no comments', () => {
    expect(check({ service_type_id: '10' })).toEqual([])
  })

  it('asks for a category on every line, client or internal', () => {
    expect(check({})).toEqual(['Choose a category'])
    expect(check({ client_id: '1' })).toEqual(['Choose a category'])
    expect(check({ client_id: '1', service_type_id: '20' })).toEqual([])
  })

  it('lists the problems in field order: client, category, then time', () => {
    expect(check({ client_id: '', durationText: '' })).toEqual(['Choose a client', 'Choose a category', 'Add the time'])
  })

  it('never asks for comments or a period', () => {
    expect(check({ service_type_id: '10', description: '', period_type: '' })).toEqual([])
  })

  it('requires nothing but the time before the cutover', () => {
    expect(check({ client_id: '' }, { required: false })).toEqual([])
    expect(check({}, { required: false, taskRequired: true })).toEqual([])
  })

  it('with "Require a task" on, asks for a task when the category has tasks', () => {
    expect(check({}, { taskRequired: true })).toEqual(['Choose a category'])
    expect(check({ service_type_id: '10' }, { taskRequired: true })).toEqual(['Choose a task'])
    expect(check({ service_type_id: '10', service_task_id: '100' }, { taskRequired: true })).toEqual([])
    expect(check({ client_id: '1', service_type_id: '20' }, { taskRequired: true })).toEqual([])
  })

  it('keeps the task optional when "Require a task" is off', () => {
    expect(check({ service_type_id: '10' })).toEqual([])
  })
})

describe('requirementHint', () => {
  it('names the required fields in the owner\'s order', () => {
    expect(requirementHint(false)).toBe('Pick the client and category for each line. Task, period and comments are optional.')
    expect(requirementHint(true)).toBe('Pick the client, category and task for each line. Period and comments are optional.')
  })
})
