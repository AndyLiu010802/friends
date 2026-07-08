import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import FirstRunHint from './FirstRunHint'
import { useIsMobile } from '@/lib/useIsMobile'

vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: vi.fn() }))
beforeEach(() => { localStorage.clear(); vi.mocked(useIsMobile).mockReturnValue(false) })
afterEach(() => vi.useRealTimers())

describe('FirstRunHint', () => {
  it('首次显示提示并写入标记', () => {
    render(<FirstRunHint />)
    expect(screen.getByText(/拖动旋转/)).toBeInTheDocument()
    expect(localStorage.getItem('youji-hint-seen')).toBe('1')
  })

  it('已看过则不再显示', () => {
    localStorage.setItem('youji-hint-seen', '1')
    render(<FirstRunHint />)
    expect(screen.queryByText(/拖动旋转/)).not.toBeInTheDocument()
  })

  it('5 秒后消失', () => {
    vi.useFakeTimers()
    render(<FirstRunHint />)
    act(() => { vi.advanceTimersByTime(5200) })
    expect(screen.queryByText(/拖动旋转/)).not.toBeInTheDocument()
  })

  it('移动端提示双指缩放', () => {
    vi.mocked(useIsMobile).mockReturnValue(true)
    render(<FirstRunHint />)
    expect(screen.getByText(/双指缩放/)).toBeInTheDocument()
  })
})
