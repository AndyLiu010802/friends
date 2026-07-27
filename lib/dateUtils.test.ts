import { describe, it, expect } from 'vitest'
import { parseDateOnly, daysBetween } from './dateUtils'

describe('parseDateOnly', () => {
  it('parses a YYYY-MM-DD string into a local Date at midnight', () => {
    const d = parseDateOnly('2026-07-01')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(6)
    expect(d!.getDate()).toBe(1)
  })
  it('returns null for malformed input', () => {
    expect(parseDateOnly('not-a-date')).toBeNull()
    expect(parseDateOnly('2026-13-40')).toBeNull()
    expect(parseDateOnly('')).toBeNull()
  })
})

describe('daysBetween', () => {
  it('returns 0 for the same day', () => {
    expect(daysBetween(new Date(2026, 5, 1), new Date(2026, 5, 1))).toBe(0)
  })
  it('returns a positive count when b is after a', () => {
    expect(daysBetween(new Date(2026, 5, 1), new Date(2026, 5, 11))).toBe(10)
  })
  it('returns a negative count when b is before a', () => {
    expect(daysBetween(new Date(2026, 5, 11), new Date(2026, 5, 1))).toBe(-10)
  })
  it('ignores time-of-day when counting days', () => {
    const a = new Date(2026, 5, 1, 23, 0)
    const b = new Date(2026, 5, 2, 1, 0)
    expect(daysBetween(a, b)).toBe(1)
  })
})
