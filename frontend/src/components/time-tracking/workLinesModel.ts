import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { ServiceType, WorkLine, WorkLineInput } from '../../lib/api'
import { isInternalClient, isPeriodType, type ClientOption, type PeriodType } from '../../lib/timeEntryWork'
import { formatMinutes, parseDurationMinutes, type DurationUnit } from '../../lib/workDuration'

/** One editable work line. Time is kept as typed text plus a unit toggle. */
export interface WorkLineDraft {
  key: string
  client_id: string
  description: string
  service_type_id: string
  service_task_id: string
  period_type: PeriodType | ''
  period_start: string
  durationText: string
  unit: DurationUnit
}

let keySeed = 0
const nextKey = () => `line-${Date.now().toString(36)}-${(keySeed += 1)}`

export function newDraft(patch: Partial<WorkLineDraft> = {}): WorkLineDraft {
  return {
    key: nextKey(),
    client_id: '',
    description: '',
    service_type_id: '',
    service_task_id: '',
    period_type: '',
    period_start: '',
    durationText: '',
    unit: 'minutes',
    ...patch,
  }
}

/** Copy a line's work (not its time) for "Duplicate previous". */
export function duplicateDraft(line: WorkLineDraft): WorkLineDraft {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { key, ...work } = line
  return newDraft({ ...work, durationText: '' })
}

interface EntryLike {
  hours?: number
  description?: string | null
  client?: { id: number } | null
  service_type?: { id: number } | null
  service_task?: { id: number } | null
  period_type?: string | null
  period_start?: string | null
  work_lines?: WorkLine[]
}

/**
 * Whole minutes to show for each stored line, rounded cumulatively from the
 * lines' decimal hours so they always add up to the entry's minutes. Per-line
 * rounding would not: six 0.02h lines are 6 x 1m = 6m, but 0.12h is 7m.
 */
export function cumulativeMinutes(hoursList: number[]): number[] {
  let cumulativeHours = 0
  let previous = 0
  return hoursList.map((hours) => {
    cumulativeHours += hours
    const rounded = Math.round(Math.round(cumulativeHours * 100) / 100 * 60)
    const minutes = rounded - previous
    previous = rounded
    return minutes
  })
}

export function draftFromLine(line: WorkLine, minutes: number = line.minutes): WorkLineDraft {
  return newDraft({
    client_id: line.client?.id.toString() || '',
    description: line.description || '',
    service_type_id: line.service_type?.id.toString() || '',
    service_task_id: line.service_task?.id.toString() || '',
    period_type: isPeriodType(line.period_type) ? line.period_type : '',
    period_start: isPeriodType(line.period_type) ? line.period_start || '' : '',
    durationText: String(minutes),
  })
}

/** The entry's lines as drafts; an entry without lines becomes one line. */
export function draftsFromEntry(entry: EntryLike | null | undefined): WorkLineDraft[] {
  if (entry?.work_lines && entry.work_lines.length > 0) {
    const minutes = cumulativeMinutes(entry.work_lines.map((line) => line.hours))
    return entry.work_lines.map((line, index) => draftFromLine(line, minutes[index]))
  }
  return [newDraft({
    client_id: entry?.client?.id.toString() || '',
    description: entry?.description || '',
    service_type_id: entry?.service_type?.id.toString() || '',
    service_task_id: entry?.service_task?.id.toString() || '',
    period_type: isPeriodType(entry?.period_type) ? entry!.period_type as PeriodType : '',
    period_start: isPeriodType(entry?.period_type) ? entry?.period_start || '' : '',
    durationText: entry?.hours ? String(Math.round(entry.hours * 60)) : '',
  })]
}

export function draftMinutes(line: WorkLineDraft): number | null {
  return parseDurationMinutes(line.durationText, line.unit)
}

const toId = (value: string) => (value ? Number(value) : null)

/**
 * API payload. With a single line and a known session length, that line
 * carries the whole session (whatever its typed time).
 */
export function linesPayload(lines: WorkLineDraft[], targetMinutes: number | null, singleCoversTarget = true): WorkLineInput[] {
  const single = singleCoversTarget && lines.length === 1 && targetMinutes !== null
  return lines.map((line) => {
    const hasPeriod = isPeriodType(line.period_type) && Boolean(line.period_start)
    return {
      client_id: toId(line.client_id),
      description: line.description.trim(),
      service_type_id: toId(line.service_type_id),
      service_task_id: line.service_type_id ? toId(line.service_task_id) : null,
      period_type: hasPeriod ? line.period_type as PeriodType : null,
      period_start: hasPeriod ? line.period_start : null,
      minutes: single ? targetMinutes! : draftMinutes(line) ?? 0,
    }
  })
}

export interface LineCheck {
  /** Field-level messages per line key. */
  problems: Record<string, string[]>
  totalMinutes: number
  /** target - total; null when there is no target (a day log). */
  remainingMinutes: number | null
  canSubmit: boolean
  /** One sentence for the footer. */
  summary: string
}

export function checkLines(
  lines: WorkLineDraft[],
  {
    targetMinutes,
    required,
    clients,
    singleCoversTarget = true,
  }: {
    targetMinutes: number | null
    required: boolean
    clients: ClientOption[]
    serviceTypes?: ServiceType[]
    /** A lone line takes the whole target (session mode); false in the day grid. */
    singleCoversTarget?: boolean
  },
): LineCheck {
  const single = singleCoversTarget && lines.length === 1 && targetMinutes !== null
  const problems: Record<string, string[]> = {}
  let totalMinutes = 0

  lines.forEach((line) => {
    const issues: string[] = []
    const minutes = single ? targetMinutes! : draftMinutes(line)
    // A session shorter than a minute has nothing to split.
    if (single && minutes === 0) { /* nothing to check */ }
    else if (minutes === null) issues.push(line.durationText.trim() ? 'Time must be minutes (45) or hours (1.5h)' : 'Add the time')
    else if (minutes <= 0) issues.push('Time must be more than 0')
    else totalMinutes += minutes

    if (required) {
      const client = clients.find((option) => String(option.id) === line.client_id)
      if (!line.client_id) issues.push('Choose a client')
      if (!line.description.trim()) issues.push('Say what you did')
      if (client && isInternalClient(client) && !line.service_type_id) issues.push('Choose a category for internal work')
    }
    if (issues.length) problems[line.key] = issues
  })

  const remainingMinutes = targetMinutes === null ? null : targetMinutes - totalMinutes
  const balanced = remainingMinutes === null || remainingMinutes === 0
  const clean = Object.keys(problems).length === 0
  let summary: string
  if (remainingMinutes === null) summary = `Total ${formatMinutes(totalMinutes)}`
  else if (remainingMinutes === 0) summary = 'All time is assigned'
  else if (remainingMinutes > 0) summary = `${formatMinutes(remainingMinutes)} left to assign`
  else summary = `${formatMinutes(-remainingMinutes)} over — reduce a line`

  return { problems, totalMinutes, remainingMinutes, canSubmit: balanced && clean && lines.length > 0, summary }
}

export interface WorkLineSuggestions {
  recentClients: ClientOption[]
  descriptionsByClient: Record<string, string[]>
  requiredFrom: string | null
}

const EMPTY_SUGGESTIONS: WorkLineSuggestions = { recentClients: [], descriptionsByClient: {}, requiredFrom: null }

/** Recent clients and descriptions for the editor; empty until loaded. */
export function useWorkLineSuggestions(enabled = true, userId?: number | null): WorkLineSuggestions {
  const [suggestions, setSuggestions] = useState<WorkLineSuggestions>(EMPTY_SUGGESTIONS)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void api.getWorkLineSuggestions(userId ?? undefined).then((response) => {
      if (cancelled || !response.data) return
      setSuggestions({
        recentClients: response.data.recent_clients,
        descriptionsByClient: response.data.descriptions_by_client,
        requiredFrom: response.data.work_details_required_from ?? null,
      })
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [enabled, userId])

  return suggestions
}

/** Whether the client/description cutover applies to this work date. */
export function detailsRequired(requiredFrom: string | null | undefined, workDate: string | null | undefined): boolean {
  return Boolean(requiredFrom && workDate && workDate >= requiredFrom)
}
