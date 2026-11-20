import { describe, expect, it } from 'vitest'
import { formatMinutes, hoursToMinutes, parseDurationMinutes } from './workDuration'

describe('parseDurationMinutes', () => {
  it('reads minutes and hours the way staff type them', () => {
    expect(parseDurationMinutes('45')).toBe(45)
    expect(parseDurationMinutes('45m')).toBe(45)
    expect(parseDurationMinutes('45 min')).toBe(45)
    expect(parseDurationMinutes('1.5h')).toBe(90)
    expect(parseDurationMinutes('1h 30m')).toBe(90)
    expect(parseDurationMinutes('1:30')).toBe(90)
    expect(parseDurationMinutes('1,5', 'hours')).toBe(90)
    expect(parseDurationMinutes('1.5', 'hours')).toBe(90)
  })

  it('returns null for empty or unreadable input', () => {
    expect(parseDurationMinutes('')).toBeNull()
    expect(parseDurationMinutes('abc')).toBeNull()
    expect(parseDurationMinutes('h')).toBeNull()
  })
})

describe('formatMinutes', () => {
  it('formats hours and minutes', () => {
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(95)).toBe('1h 35m')
    expect(formatMinutes(-15)).toBe('-15m')
    expect(hoursToMinutes(0.33)).toBe(20)
  })
})
