import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import QuickNoteOverlay from './QuickNoteOverlay'
import { useIsMobile } from '@/lib/useIsMobile'
import { extractMemory } from '@/lib/quickMemory'
import { getFriends } from '@/lib/store'
import type { Friend } from '@/lib/types'

vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ pushFriend: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/quickMemory', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/quickMemory')>()),
  extractMemory: vi.fn(),
}))

function baseFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'f1', name: 'Test', important: false,
    likes: [], dislikes: [], hobbies: [],
    portraits: [], memories: [], relationships: [],
    starConfig: { kind:'nebula', coreColor:'#94a3b8', glowColor:'#cbd5e1', size:1, twinkleSpeed:2, position:[0,0,0] },
    createdAt: '2026-01-01', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
const friends = [baseFriend({ id:'a', name:'阿明' }), baseFriend({ id:'b', name:'小红' })]

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('yj_friends', JSON.stringify(friends))
  vi.mocked(useIsMobile).mockReturnValue(false)
  vi.mocked(extractMemory).mockResolvedValue(null)
})

function setup(props: Partial<ComponentProps<typeof QuickNoteOverlay>> = {}) {
  const onOpenChange = vi.fn()
  const onSaved = vi.fn()
  render(<QuickNoteOverlay friends={friends} open onOpenChange={onOpenChange} onSaved={onSaved} {...props} />)
  return { onOpenChange, onSaved }
}

describe('QuickNoteOverlay', () => {
  it('open=false 不渲染', () => {
    setup({ open: false })
    expect(screen.queryByText(/记一笔/)).not.toBeInTheDocument()
  })

  it('第一步选人:点好友进入记录步', () => {
    setup()
    fireEvent.click(screen.getByText('阿明'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByText(/阿明/)).toBeInTheDocument()
  })

  it('defaultFriendId 直达记录步,可换人返回', () => {
    setup({ defaultFriendId: 'b' })
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    fireEvent.click(screen.getByText('换人'))
    expect(screen.getByText('阿明')).toBeInTheDocument()
  })

  it('保存走降级并回调 onSaved,localStorage 落库', async () => {
    const { onSaved } = setup({ defaultFriendId: 'a' })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '一起吃了火锅。很开心' } })
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('a'))
    const stored = getFriends().find(f => f.id === 'a')!
    expect(stored.memories).toHaveLength(1)
    expect(stored.memories[0].title).toBe('一起吃了火锅')
    expect(screen.getByText(/已记入/)).toBeInTheDocument()
  })

  it('空内容保存按钮禁用', () => {
    setup({ defaultFriendId: 'a' })
    expect(screen.getByText('保存')).toBeDisabled()
  })

  it('Esc 关闭并 preventDefault', () => {
    const { onOpenChange } = setup()
    const notPrevented = fireEvent.keyDown(window, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(notPrevented).toBe(false)
  })

  it('关闭状态 Ctrl+J 打开;输入框聚焦时不劫持', () => {
    const { onOpenChange } = setup({ open: false })
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true })
    expect(onOpenChange).toHaveBeenCalledWith(true)
    onOpenChange.mockClear()
    render(<input data-testid="outside" />)
    fireEvent.keyDown(screen.getByTestId('outside'), { key: 'j', ctrlKey: true })
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('IME 组词中的按键不处理', () => {
    const { onOpenChange } = setup({ open: false })
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true, isComposing: true })
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('无好友显示空宇宙提示', () => {
    setup({ friends: [] })
    expect(screen.getByText(/宇宙还空着/)).toBeInTheDocument()
  })
})
