import { describe, it, expect } from 'vitest'
import { getBirthdayStatus } from './birthdayStatus'

const NOW = new Date(2026, 6, 1) // July 1, 2026 (local time, month is 0-indexed)

describe('getBirthdayStatus', () => {
  it('returns nulls when birthday is undefined', () => {
    const result = getBirthdayStatus(undefined, NOW)
    expect(result).toEqual({ daysUntil: null, label: null, isToday: false, isSoon: false })
  })
  it('returns nulls when birthday is malformed', () => {
    const result = getBirthdayStatus('not-a-date', NOW)
    expect(result.daysUntil).toBeNull()
  })
  it('detects today as the birthday', () => {
    const result = getBirthdayStatus('1990-07-01', NOW)
    expect(result.isToday).toBe(true)
    expect(result.isSoon).toBe(true)
    expect(result.label).toBe('今天生日 🎂')
    expect(result.daysUntil).toBe(0)
  })
  it('detects a birthday 3 days away as soon', () => {
    const result = getBirthdayStatus('1990-07-04', NOW)
    expect(result.daysUntil).toBe(3)
    expect(result.isSoon).toBe(true)
    expect(result.isToday).toBe(false)
    expect(result.label).toBe('3 天后生日')
  })
  it('does not flag a birthday 8 days away as soon', () => {
    const result = getBirthdayStatus('1990-07-09', NOW)
    expect(result.daysUntil).toBe(8)
    expect(result.isSoon).toBe(false)
    expect(result.label).toBeNull()
  })
  it('wraps to next year when the birthday already passed', () => {
    const result = getBirthdayStatus('1990-06-25', NOW)
    expect(result.isSoon).toBe(false)
    expect(result.daysUntil).toBeGreaterThan(300)
  })
})
