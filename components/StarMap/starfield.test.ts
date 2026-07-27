import { describe, it, expect } from 'vitest'
import { buildStarfield } from './starfield'

describe('buildStarfield', () => {
  it('默认 1500 颗背景星', () => {
    const points = buildStarfield()
    expect(points.geometry.getAttribute('position').count).toBe(1500)
  })
  it('可传入更小数量（移动端降级）', () => {
    const points = buildStarfield(750)
    expect(points.geometry.getAttribute('position').count).toBe(750)
  })
})
