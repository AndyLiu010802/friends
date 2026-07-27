import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InsightPanel from './InsightPanel'
import { useIsMobile } from '@/lib/useIsMobile'
import type { FriendInsight } from '@/lib/insights'

vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: vi.fn() }))
beforeEach(() => vi.mocked(useIsMobile).mockReturnValue(false))

function ins(overrides: Partial<FriendInsight>): FriendInsight {
  return {
    id: 'i1', type: 'inactive', friendId: 'f1', friendName: '小王',
    text: '默认文本', priority: 2, fingerprint: 'fp', dismissible: true,
    ...overrides,
  }
}

const THREE = [
  ins({ id: 'a', priority: 3, text: '今天是小王生日 🎂', type: 'birthday', dismissible: false }),
  ins({ id: 'b', priority: 2, text: '你已 70 天没记录小李', friendId: 'f2' }),
  ins({ id: 'c', priority: 1, text: '小张的档案还很空', friendId: 'f3' }),
]

function setup(insights = THREE, mobile = false) {
  vi.mocked(useIsMobile).mockReturnValue(mobile)
  const onSelectFriend = vi.fn()
  const onQuickNote = vi.fn()
  const onDismiss = vi.fn()
  render(<InsightPanel insights={insights}
    onSelectFriend={onSelectFriend} onQuickNote={onQuickNote} onDismiss={onDismiss} />)
  return { onSelectFriend, onQuickNote, onDismiss }
}

describe('InsightPanel(星语提醒)', () => {
  it('按优先级分组渲染,组标题正确', () => {
    setup()
    expect(screen.getByText('今天必看')).toBeInTheDocument()
    expect(screen.getByText('值得留意')).toBeInTheDocument()
    expect(screen.getByText('顺手补全')).toBeInTheDocument()
    expect(screen.getByText(/小王生日/)).toBeInTheDocument()
  })

  it('空组不显示组标题', () => {
    setup([ins({ priority: 2 })])
    expect(screen.queryByText('今天必看')).not.toBeInTheDocument()
    expect(screen.getByText('值得留意')).toBeInTheDocument()
  })

  it('全空显示安静文案', () => {
    setup([])
    expect(screen.getByText(/很安静/)).toBeInTheDocument()
  })

  it('去看看触发 onSelectFriend', () => {
    const { onSelectFriend } = setup()
    fireEvent.click(screen.getAllByText('去看看')[0])
    expect(onSelectFriend).toHaveBeenCalledWith('f1')
  })

  it('记一笔触发 onQuickNote', () => {
    const { onQuickNote } = setup()
    fireEvent.click(screen.getAllByText('✎ 记一笔')[1])
    expect(onQuickNote).toHaveBeenCalledWith('f2')
  })

  it('知道了触发 onDismiss 并传整条信号', () => {
    const { onDismiss } = setup()
    fireEvent.click(screen.getAllByText('知道了')[0])
    expect(onDismiss).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }))
  })

  it('不可忽略的信号没有知道了按钮', () => {
    setup([ins({ dismissible: false, priority: 3 })])
    expect(screen.queryByText('知道了')).not.toBeInTheDocument()
  })

  it('手机:胶囊显示条数,展开后分组可见', () => {
    setup(THREE, true)
    const capsule = screen.getByRole('button', { name: /星语提醒 · 3/ })
    expect(screen.queryByText('今天必看')).not.toBeInTheDocument()
    fireEvent.click(capsule)
    expect(screen.getByText('今天必看')).toBeInTheDocument()
  })

  it('手机:去看看回调后面板收起', () => {
    const { onSelectFriend } = setup(THREE, true)
    fireEvent.click(screen.getByRole('button', { name: /星语提醒 · 3/ }))
    fireEvent.click(screen.getAllByText('去看看')[0])
    expect(onSelectFriend).toHaveBeenCalledWith('f1')
    expect(screen.queryByText('今天必看')).not.toBeInTheDocument()
  })

  it('手机:无信号时不渲染胶囊', () => {
    setup([], true)
    expect(screen.queryByRole('button', { name: /星语提醒/ })).not.toBeInTheDocument()
  })

  it('分组按 3→2→1 顺序渲染', () => {
    setup()
    const titles = screen.getAllByText(/今天必看|值得留意|顺手补全/).map(e => e.textContent)
    expect(titles).toEqual(['今天必看', '值得留意', '顺手补全'])
  })

  it('手机:知道了不收起面板', () => {
    const { onDismiss } = setup(THREE, true)
    fireEvent.click(screen.getByRole('button', { name: /星语提醒 · 3/ }))
    fireEvent.click(screen.getAllByText('知道了')[0])
    expect(onDismiss).toHaveBeenCalled()
    expect(screen.getByText('今天必看')).toBeInTheDocument()
  })
})
