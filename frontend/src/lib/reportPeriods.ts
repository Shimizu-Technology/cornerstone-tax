export type ReportPeriodPreset = 'current_period' | 'previous_period' | 'this_month' | 'last_month' | 'year_to_date'

export interface ReportPeriod {
  start: string
  end: string
}

const BUSINESS_TIME_ZONE = 'Pacific/Guam'

function businessDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value])) as Record<string, string>
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) }
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function previousMonth(year: number, month: number) {
  const date = new Date(Date.UTC(year, month - 2, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

function halfMonthPeriod(year: number, month: number, day: number): ReportPeriod {
  return day <= 15
    ? { start: isoDate(year, month, 1), end: isoDate(year, month, 15) }
    : { start: isoDate(year, month, 16), end: isoDate(year, month, lastDayOfMonth(year, month)) }
}

export function reportPeriodForPreset(preset: ReportPeriodPreset, now = new Date()): ReportPeriod {
  const { year, month, day } = businessDateParts(now)
  const today = isoDate(year, month, day)
  if (preset === 'current_period') return { ...halfMonthPeriod(year, month, day), end: today }

  if (preset === 'previous_period') {
    if (day > 15) return halfMonthPeriod(year, month, 10)
    const previous = previousMonth(year, month)
    return halfMonthPeriod(previous.year, previous.month, 20)
  }

  if (preset === 'this_month') {
    return { start: isoDate(year, month, 1), end: today }
  }

  if (preset === 'last_month') {
    const previous = previousMonth(year, month)
    return { start: isoDate(previous.year, previous.month, 1), end: isoDate(previous.year, previous.month, lastDayOfMonth(previous.year, previous.month)) }
  }

  return { start: isoDate(year, 1, 1), end: today }
}

export function reportPeriodFromSearchParams(searchParams: URLSearchParams, fallback: ReportPeriod): ReportPeriod {
  const start = searchParams.get('start_date')
  const end = searchParams.get('end_date')
  return isIsoDate(start) && isIsoDate(end) && start <= end ? { start, end } : fallback
}
