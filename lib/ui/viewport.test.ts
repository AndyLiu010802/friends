import { describe, it, expect } from 'vitest'
import { clampToViewport } from './viewport'

describe('clampToViewport', () => {
  it('视口内的位置原样返回', () => {
    expect(clampToViewport(100, 100, 260, 300, 1200, 800)).toEqual({ x: 100, y: 100 })
  })
  it('超出右/下边缘时收回到边距内', () => {
    expect(clampToViewport(1100, 700, 260, 300, 1200, 800)).toEqual({ x: 1200 - 260 - 12, y: 800 - 300 - 12 })
  })
  it('负坐标收回到边距', () => {
    expect(clampToViewport(-50, -50, 260, 300, 1200, 800)).toEqual({ x: 12, y: 12 })
  })
})
