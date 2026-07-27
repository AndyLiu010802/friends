import { describe, it, expect } from 'vitest'
import { getZodiac } from './zodiac'

describe('getZodiac', () => {
  it('returns 白羊座 for March 21', () => {
    expect(getZodiac('2000-03-21')).toBe('白羊座')
  })
  it('returns 双鱼座 for March 20', () => {
    expect(getZodiac('2000-03-20')).toBe('双鱼座')
  })
  it('returns 摩羯座 for December 22', () => {
    expect(getZodiac('2000-12-22')).toBe('摩羯座')
  })
  it('returns 射手座 for November 22', () => {
    expect(getZodiac('2000-11-22')).toBe('射手座')
  })
})
