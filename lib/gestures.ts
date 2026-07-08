// 星图触屏手势的纯逻辑，不依赖 DOM/Three.js，便于单元测试。
// 接线方（StarMap）负责把 PointerEvent 坐标喂进来并消费返回值。

const TAP_THRESHOLD_PX = 5
const ZOOM_MIN = 3.5
const ZOOM_MAX = 16

export interface Point { x: number; y: number }

export function isTap(down: Point, up: Point, threshold = TAP_THRESHOLD_PX): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) < threshold
}

// 与滚轮缩放共用同一 clamp 区间（见 StarMap onWheel）。
export function applyZoom(currentZ: number, delta: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, currentZ + delta))
}

export interface PinchTracker {
  down(id: number, x: number, y: number): void
  /** 返回两指间距的变化量（旧 - 新，正值 = 两指靠近）；非捏合状态返回 0 */
  move(id: number, x: number, y: number): number
  up(id: number): void
  readonly isPinching: boolean
  /** 本轮手势（从第一指按下到全部抬起）是否出现过双指，用于抑制捏合尾部的误轻点 */
  readonly wasPinch: boolean
}

export function createPinchTracker(): PinchTracker {
  const pointers = new Map<number, Point>()
  let lastDist: number | null = null
  let pinched = false

  function dist(): number {
    const [a, b] = [...pointers.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  return {
    down(id, x, y) {
      pointers.set(id, { x, y })
      if (pointers.size === 2) {
        lastDist = dist()
        pinched = true
      }
    },
    move(id, x, y) {
      if (!pointers.has(id)) return 0
      pointers.set(id, { x, y })
      if (pointers.size !== 2 || lastDist === null) return 0
      const d = dist()
      const delta = lastDist - d
      lastDist = d
      return delta
    },
    up(id) {
      pointers.delete(id)
      lastDist = pointers.size === 2 ? dist() : null
      if (pointers.size === 0) pinched = false
    },
    get isPinching() { return pointers.size >= 2 },
    get wasPinch() { return pinched },
  }
}
