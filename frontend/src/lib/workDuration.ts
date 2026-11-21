// Work-line durations. Staff type minutes ("45", "45m") or hours ("1.5h",
// "1h 30m", "1:30"). The UI keeps whole minutes; the server stores hours to
// two decimals and splits the entry total so lines add up exactly.

export type DurationUnit = 'minutes' | 'hours'

const BARE = /^\s*(\d+(?:\.\d+)?)\s*$/
const CLOCK = /^\s*(\d+):([0-5]\d)\s*$/
const UNITS = /^\s*(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:utes?|s)?)?)?\s*$/i

/**
 * Whole minutes for what was typed, or null when it isn't a duration.
 * A bare number uses `unit` (minutes unless the hours toggle is on).
 */
export function parseDurationMinutes(text: string, unit: DurationUnit = 'minutes'): number | null {
  const value = text.trim().replace(',', '.')
  if (!value) return null

  const bare = value.match(BARE)
  if (bare) {
    const number = Number(bare[1])
    return Math.round(unit === 'hours' ? number * 60 : number)
  }

  const clock = value.match(CLOCK)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])

  const units = value.match(UNITS)
  if (!units || (units[1] === undefined && units[2] === undefined)) return null
  return Math.round(Number(units[1] || 0) * 60 + Number(units[2] || 0))
}

/** "45m", "1h", "1h 30m"; negative values get a leading minus. */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : ''
  const total = Math.abs(Math.round(minutes))
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours === 0) return `${sign}${mins}m`
  if (mins === 0) return `${sign}${hours}h`
  return `${sign}${hours}h ${mins}m`
}

/** "1.50" decimal hours for whole minutes. */
export function minutesToHoursText(minutes: number): string {
  return (Math.round(minutes) / 60).toFixed(2)
}

/** Whole minutes for stored two-decimal hours (0.33 -> 20). */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60)
}
