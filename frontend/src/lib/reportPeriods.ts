import { formatDateISO } from './dateUtils'

export type ReportPeriodPreset = 'current_period' | 'previous_period' | 'this_month' | 'last_month' | 'year_to_date'

export interface ReportPeriod {
  start: string
  end: string
}

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
}

function halfMonthPeriod(date: Date): ReportPeriod {
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  const start = day <= 15 ? new Date(year, month, 1) : new Date(year, month, 16)
  const end = day <= 15 ? new Date(year, month, 15) : new Date(year, month + 1, 0)
  return { start: formatDateISO(start), end: formatDateISO(end) }
}

export function reportPeriodForPreset(preset: ReportPeriodPreset, now = new Date()): ReportPeriod {
  if (preset === 'current_period') return { ...halfMonthPeriod(now), end: formatDateISO(now) }

  if (preset === 'previous_period') {
    const previous = now.getDate() <= 15
      ? new Date(now.getFullYear(), now.getMonth() - 1, 20)
      : new Date(now.getFullYear(), now.getMonth(), 10)
    return halfMonthPeriod(previous)
  }

  if (preset === 'this_month') {
    return {
      start: formatDateISO(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: formatDateISO(now),
    }
  }

  if (preset === 'last_month') {
    return {
      start: formatDateISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      end: formatDateISO(new Date(now.getFullYear(), now.getMonth(), 0)),
    }
  }

  return {
    start: formatDateISO(new Date(now.getFullYear(), 0, 1)),
    end: formatDateISO(now),
  }
}

export function reportPeriodFromSearchParams(searchParams: URLSearchParams, fallback: ReportPeriod): ReportPeriod {
  const start = searchParams.get('start_date')
  const end = searchParams.get('end_date')
  return isIsoDate(start) && isIsoDate(end) && start <= end ? { start, end } : fallback
}
