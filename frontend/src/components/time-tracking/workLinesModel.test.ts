import { describe, expect, it } from 'vitest'
import { attendanceChanges, cumulativeMinutes, draftsFromEntry, linesPayload } from './workLinesModel'

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
    expect(payload.map((row) => row.hours)).toEqual([0.02, 0.02, 0.02, 0.02, 0.02, 0.02])
    expect(payload.every((row) => row.minutes === undefined)).toBe(true)
  })

  it('sends minutes for a line whose time was edited', () => {
    const drafts = draftsFromEntry({ hours: 1, work_lines: [line(0, 6, 0.5), line(1, 7, 0.5)] })
    drafts[0] = { ...drafts[0], durationText: '20' }
    drafts[1] = { ...drafts[1], durationText: '40' }
    expect(linesPayload(drafts, 60).map((row) => [row.hours, row.minutes])).toEqual([[undefined, 20], [undefined, 40]])
  })
})

describe('attendanceChanges', () => {
  it('includes only fields that differ from the saved entry', () => {
    expect(attendanceChanges({ workDate: ['2026-11-16', '2026-11-16'], startTime: ['08:00', '08:00'], endTime: ['08:07', '08:07'], breakMinutes: [null, null] })).toEqual({})
    expect(attendanceChanges({ workDate: ['2026-11-17', '2026-11-16'], startTime: ['08:00', '08:00'], endTime: ['09:00', '08:07'], breakMinutes: [15, null] }))
      .toEqual({ work_date: '2026-11-17', end_time: '09:00', break_minutes: 15 })
  })
})
