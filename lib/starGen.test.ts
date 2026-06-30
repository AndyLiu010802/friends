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
})
