import { describe, it, expect } from 'vitest'
import { generateStarConfig } from './starGen'

describe('generateStarConfig', () => {
  it('gives radiant kind to ENFP', () => {
    const cfg = generateStarConfig('ENFP', '双子座', [], [0,0,0])
    expect(cfg.kind).toBe('radiant')
  })
  it('gives nebula kind to INFJ', () => {
    const cfg = generateStarConfig('INFJ', '双鱼座', [], [0,0,0])
    expect(cfg.kind).toBe('nebula')
  })
  it('gives fire element gold core to 白羊座', () => {
    const cfg = generateStarConfig('ENFP', '白羊座', [], [0,0,0])
    expect(cfg.coreColor).toBe('#ef4444')
  })
  it('gives water element purple core to 双鱼座', () => {
    const cfg = generateStarConfig('INFJ', '双鱼座', [], [0,0,0])
    expect(cfg.coreColor).toBe('#7c3aed')
  })
  it('uses provided position', () => {
    const cfg = generateStarConfig('ENFP', '双子座', [], [1,2,3])
    expect(cfg.position).toEqual([1,2,3])
  })
  it('defaults to nebula kind when mbti is undefined', () => {
    const cfg = generateStarConfig(undefined, '双子座', [], [0,0,0])
    expect(cfg.kind).toBe('nebula')
  })
  it('defaults to neutral colors when zodiac is undefined', () => {
    const cfg = generateStarConfig('ENFP', undefined, [], [0,0,0])
    expect(cfg.coreColor).toBe('#94a3b8')
    expect(cfg.glowColor).toBe('#cbd5e1')
  })
  it('does not throw when both mbti and zodiac are undefined', () => {
    expect(() => generateStarConfig(undefined, undefined, [], [0,0,0])).not.toThrow()
  })
})
