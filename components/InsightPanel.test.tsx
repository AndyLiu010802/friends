import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InsightPanel from './InsightPanel'
import { useIsMobile } from '@/lib/useIsMobile'

vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: vi.fn() }))
vi.mock('@/lib/insights', () => ({
  generateFriendInsights: vi.fn().mockReturnValue([
    { id: 'i1', friendId: 'f1', text: '小王的生日还有 3 天' },
    { id: 'i2', friendId: 'f2', text: '你已两个月没记录小李' },
  ]),
}))

beforeEach(() => vi.mocked(useIsMobile).mockReturnValue(false))

describe('InsightPanel', () => {
  it('桌面：直接展示洞察列表', () => {
    render(<InsightPanel friends={[]} onSelectFriend={() => {}} />)
    expect(screen.getByText(/小王的生日/)).toBeInTheDocument()
  })

  it('手机：默认只显示带条数的胶囊', () => {
    vi.mocked(useIsMobile).mockReturnValue(true)
    render(<InsightPanel friends={[]} onSelectFriend={() => {}} />)
    expect(screen.getByRole('button', { name: /今日星象 · 2/ })).toBeInTheDocument()
    expect(screen.queryByText(/小王的生日/)).not.toBeInTheDocument()
  })

  it('手机：点胶囊展开列表，点洞察回调并收起', () => {
    vi.mocked(useIsMobile).mockReturnValue(true)
    const onSelect = vi.fn()
    render(<InsightPanel friends={[]} onSelectFriend={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /今日星象 · 2/ }))
    fireEvent.click(screen.getByText(/小王的生日/))
    expect(onSelect).toHaveBeenCalledWith('f1')
    expect(screen.queryByText(/小王的生日/)).not.toBeInTheDocument()
  })
})
