import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import SearchOverlay from './SearchOverlay'
import { useIsMobile } from '@/lib/useIsMobile'
import type { Friend } from '@/lib/types'

vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: vi.fn() }))
beforeEach(() => vi.mocked(useIsMobile).mockReturnValue(false))

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

const friends = [
  baseFriend({ id:'a', name:'阿明', likes:['火锅'] }),
  baseFriend({ id:'b', name:'小红', nickname:'红红' }),
]

function setup(props: Partial<ComponentProps<typeof SearchOverlay>> = {}) {
  const onOpenChange = vi.fn()
  const onPick = vi.fn()
  render(<SearchOverlay friends={friends} open onOpenChange={onOpenChange} onPick={onPick} {...props} />)
  return { onOpenChange, onPick }
}

describe('SearchOverlay', () => {
  it('open=false 时不渲染', () => {
    setup({ open: false })
    expect(screen.queryByPlaceholderText(/寻找/)).not.toBeInTheDocument()
  })

  it('空查询列出全部好友', () => {
    setup()
    expect(screen.getByText('阿明')).toBeInTheDocument()
    expect(screen.getByText('小红')).toBeInTheDocument()
  })

  it('输入过滤并显示命中原因', () => {
    setup()
    fireEvent.change(screen.getByPlaceholderText(/寻找/), { target: { value: '火锅' } })
    expect(screen.getByText('阿明')).toBeInTheDocument()
    expect(screen.queryByText('小红')).not.toBeInTheDocument()
    expect(screen.getByText(/喜欢:火锅/)).toBeInTheDocument()
  })

  it('点击行触发 onPick 并关闭', () => {
    const { onPick, onOpenChange } = setup()
    fireEvent.click(screen.getByText('阿明'))
    expect(onPick).toHaveBeenCalledWith('a')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('键盘 ↓ + Enter 选中第二项', () => {
    const { onPick } = setup()
    const input = screen.getByPlaceholderText(/寻找/)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith('b')
  })

  it('IME 组词中的 Enter 不触发选中', () => {
    const { onPick } = setup()
    const input = screen.getByPlaceholderText(/寻找/)
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(onPick).not.toHaveBeenCalled()
  })

  it('Esc 关闭', () => {
    const { onOpenChange } = setup()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('Esc 关闭时标记事件已处理(preventDefault)', () => {
    setup()
    const notPrevented = fireEvent.keyDown(window, { key: 'Escape' })
    expect(notPrevented).toBe(false)
  })

  it('关闭状态下 Ctrl+K 打开', () => {
    const { onOpenChange } = setup({ open: false })
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('焦点在 input 内时 Ctrl+K 不劫持', () => {
    render(<input data-testid="outside" />)
    const { onOpenChange } = setup({ open: false })
    fireEvent.keyDown(screen.getByTestId('outside'), { key: 'k', ctrlKey: true })
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('无好友显示空宇宙提示', () => {
    setup({ friends: [] })
    expect(screen.getByText(/宇宙还空着/)).toBeInTheDocument()
    expect(screen.getByText(/新纪录/)).toBeInTheDocument()
  })

  it('无匹配显示没有找到', () => {
    setup()
    fireEvent.change(screen.getByPlaceholderText(/寻找/), { target: { value: 'zzz' } })
    expect(screen.getByText(/没有找到/)).toBeInTheDocument()
    expect(screen.getByText(/新纪录/)).toBeInTheDocument()
  })
})
