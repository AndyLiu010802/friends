import { describe, it, expect, vi, afterEach } from 'vitest'
import { updateAppBadge } from './appBadge'

afterEach(() => {
  // @ts-expect-error 清理测试挂上去的 API
  delete navigator.setAppBadge
  // @ts-expect-error 同样清理测试挂上去的 API
  delete navigator.clearAppBadge
})

describe('updateAppBadge', () => {
  it('count>0 时调用 setAppBadge', () => {
    const set = vi.fn().mockResolvedValue(undefined)
    const clear = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { setAppBadge: set, clearAppBadge: clear })
    updateAppBadge(3)
    expect(set).toHaveBeenCalledWith(3)
    expect(clear).not.toHaveBeenCalled()
  })

  it('count=0 时调用 clearAppBadge', () => {
    const set = vi.fn().mockResolvedValue(undefined)
    const clear = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { setAppBadge: set, clearAppBadge: clear })
    updateAppBadge(0)
    expect(clear).toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
  })

  it('不支持 Badging API 时不抛错', () => {
    expect(() => updateAppBadge(5)).not.toThrow()
  })

  it('API 抛错时静默', () => {
    Object.assign(navigator, {
      setAppBadge: vi.fn(() => { throw new Error('nope') }),
      clearAppBadge: vi.fn(),
    })
    expect(() => updateAppBadge(2)).not.toThrow()
  })
})
