import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import OrreryEntry from './OrreryEntry'

vi.mock('gsap', () => ({ gsap: {
  fromTo: vi.fn(),
  to: vi.fn((_t: unknown, vars: { onComplete?: () => void }) => { vars.onComplete?.() }),
} }))

afterEach(() => vi.useRealTimers())

describe('OrreryEntry', () => {
  it('未就绪时显示加载文案', () => {
    render(<OrreryEntry ready={false} onEnter={() => {}} />)
    expect(screen.getByText('正在校准星轨…')).toBeInTheDocument()
  })

  it('就绪后显示进入提示，并在最短展示时长后自动进入', () => {
    vi.useFakeTimers()
    const onEnter = vi.fn()
    render(<OrreryEntry ready onEnter={onEnter} />)
    expect(screen.getByText('点击进入')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(2100) })
    expect(onEnter).toHaveBeenCalled()
  })

  it('品牌名为 友记', () => {
    render(<OrreryEntry ready={false} onEnter={() => {}} />)
    expect(screen.getByText('友记')).toBeInTheDocument()
  })
})
