import { describe, it, expect } from 'vitest'
import { getBirthdayStatus } from './birthdayStatus'

const NOW = new Date(2026, 6, 1) // July 1, 2026 (local time, month is 0-indexed)

describe('getBirthdayStatus', () => {
  it('returns nulls when birthday is undefined', () => {
    const result = getBirthdayStatus(undefined, NOW)
    expect(result).toEqual({ daysUntil: null, label: null, isToday: false, isSoon: false, isWithin14: false, nextBirthdayISO: null })
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

describe('isWithin14 与 nextBirthdayISO', () => {
  const now = new Date(2026, 6, 28) // 2026-07-28
  it('10 天后生日:isWithin14 为 true,isSoon 为 false', () => {
    const s = getBirthdayStatus('2000-08-07', now)
    expect(s.daysUntil).toBe(10)
    expect(s.isWithin14).toBe(true)
    expect(s.isSoon).toBe(false)
  })
  it('今天生日:isWithin14 为 true,nextBirthdayISO 是今天', () => {
    const s = getBirthdayStatus('2000-07-28', now)
    expect(s.isWithin14).toBe(true)
    expect(s.nextBirthdayISO).toBe('2026-07-28')
  })
  it('15 天后:isWithin14 为 false', () => {
    expect(getBirthdayStatus('2000-08-12', now).isWithin14).toBe(false)
  })
  it('已过的生日翻到明年:nextBirthdayISO 为明年日期', () => {
    expect(getBirthdayStatus('2000-01-05', now).nextBirthdayISO).toBe('2027-01-05')
  })
  it('无生日:两个新字段为 false/null', () => {
    const s = getBirthdayStatus(undefined, now)
    expect(s.isWithin14).toBe(false)
    expect(s.nextBirthdayISO).toBeNull()
  })
})
