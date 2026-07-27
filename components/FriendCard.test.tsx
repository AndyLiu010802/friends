import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FriendCard from './FriendCard'
import type { Friend } from '@/lib/types'

const friend: Friend = {
  id: 'f1', name: '小王', important: false,
  likes: [], dislikes: [], hobbies: [],
  portraits: [], memories: [], relationships: [],
  starConfig: { kind: 'nebula', coreColor: '#7c3aed', glowColor: '#ec4899',
    size: 1, twinkleSpeed: 2, position: [0, 0, 0] },
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

describe('FriendCard', () => {
  it('默认 floating：使用传入的定位样式', () => {
    render(<FriendCard friend={friend} style={{ left: 123, top: 45 }} />)
    const card = screen.getByTestId('friend-card')
    expect(card).toHaveStyle({ left: '123px', top: '45px' })
  })

  it('sheet：贴底全宽，忽略指针定位', () => {
    render(<FriendCard friend={friend} variant="sheet" style={{ left: 123, top: 45 }} />)
    const card = screen.getByTestId('friend-card')
    expect(card).toHaveStyle({ left: '0px', right: '0px', bottom: '0px' })
    expect(card).not.toHaveStyle({ top: '45px' })
  })

  it('sheet 也能渲染名字与操作链接', () => {
    render(<FriendCard friend={friend} variant="sheet" />)
    expect(screen.getByText('小王')).toBeInTheDocument()
    expect(screen.getByText('编辑')).toBeInTheDocument()
  })
})
