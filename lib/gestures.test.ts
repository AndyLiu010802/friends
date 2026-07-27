import { describe, it, expect } from 'vitest'
import { isTap, applyZoom, createPinchTracker } from './gestures'

describe('isTap', () => {
  it('位移小于阈值算轻点', () => {
    expect(isTap({ x: 100, y: 100 }, { x: 102, y: 103 })).toBe(true)
  })
  it('位移达到 5px 不算轻点', () => {
    expect(isTap({ x: 100, y: 100 }, { x: 105, y: 100 })).toBe(false)
  })
})

describe('applyZoom', () => {
  it('正常累加缩放增量', () => {
    expect(applyZoom(9, 1.5)).toBe(10.5)
  })
  it('下限 3.5', () => {
    expect(applyZoom(4, -2)).toBe(3.5)
  })
  it('上限 16', () => {
    expect(applyZoom(15, 5)).toBe(16)
  })
})

describe('createPinchTracker', () => {
  it('单指移动不产生缩放增量、不算捏合', () => {
    const t = createPinchTracker()
    t.down(1, 0, 0)
    expect(t.isPinching).toBe(false)
    expect(t.move(1, 10, 0)).toBe(0)
  })

  it('双指靠近产生正增量（缩小视野=拉远取反由调用方决定）', () => {
    const t = createPinchTracker()
    t.down(1, 0, 0)
    t.down(2, 100, 0)
    expect(t.isPinching).toBe(true)
    // 指 2 从 x=100 移到 x=80：两指间距 100 → 80，返回 lastDist - dist = 20
    expect(t.move(2, 80, 0)).toBe(20)
    // 再移回 90：间距 80 → 90，返回 -10
    expect(t.move(2, 90, 0)).toBe(-10)
  })

  it('第二指按下的那一刻不产生跳变增量', () => {
    const t = createPinchTracker()
    t.down(1, 0, 0)
    t.down(2, 50, 0)
    // down 之后第一次 move 位置不变，增量应为 0
    expect(t.move(2, 50, 0)).toBe(0)
  })

  it('抬起一指后回到单指状态，不再产生增量', () => {
    const t = createPinchTracker()
    t.down(1, 0, 0)
    t.down(2, 100, 0)
    t.up(2)
    expect(t.isPinching).toBe(false)
    expect(t.move(1, 30, 0)).toBe(0)
  })

  it('本轮手势曾出现过双指则 wasPinch 为 true，全部抬起后复位', () => {
    const t = createPinchTracker()
    t.down(1, 0, 0)
    t.down(2, 100, 0)
    t.up(2)
    expect(t.wasPinch).toBe(true) // 用于抑制捏合结束时的误轻点
    t.up(1)
    expect(t.wasPinch).toBe(false)
  })

  it('未知指针的 move 被忽略', () => {
    const t = createPinchTracker()
    expect(t.move(9, 1, 1)).toBe(0)
  })
})
