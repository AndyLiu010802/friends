import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from './useIsMobile'

type Listener = (e: { matches: boolean }) => void

function stubMatchMedia(initial: boolean) {
  const listeners: Listener[] = []
  const mql = {
    matches: initial,
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    removeEventListener: (_: string, fn: Listener) => {
      const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1)
    },
  }
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql))
  return {
    fire(matches: boolean) { mql.matches = matches; listeners.forEach(fn => fn({ matches })) },
    listeners,
  }
}

beforeEach(() => vi.unstubAllGlobals())

describe('useIsMobile', () => {
  it('初始返回 matchMedia 当前值', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('media query 变化时更新', () => {
    const ctl = stubMatchMedia(false)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
    act(() => ctl.fire(true))
    expect(result.current).toBe(true)
  })

  it('卸载时移除监听', () => {
    const ctl = stubMatchMedia(false)
    const { unmount } = renderHook(() => useIsMobile())
    expect(ctl.listeners.length).toBe(1)
    unmount()
    expect(ctl.listeners.length).toBe(0)
  })
})
