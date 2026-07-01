import { describe, it, expect } from 'vitest'
import { isLonelyStar } from './lonelyStar'
import type { Friend } from './types'

function baseFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'f1', name: 'Test', important: false,
    likes: [], dislikes: [], hobbies: [],
    portraits: [], memories: [], relationships: [],
    starConfig: { kind:'nebula', coreColor:'#94a3b8', glowColor:'#cbd5e1', size:1, twinkleSpeed:2, position:[0,0,0] },
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  }
}

describe('isLonelyStar', () => {
  it('is true when there are no memories and no relationships', () => {
    expect(isLonelyStar(baseFriend())).toBe(true)
  })
  it('is false when there are memories', () => {
    const memories = [{ id:'m1', date:'2026-01-01', title:'t', content:'', tags:[], media:[] }]
    expect(isLonelyStar(baseFriend({ memories }))).toBe(false)
  })
  it('is false when there are relationships', () => {
    const relationships = [{ friendId:'f2', label:'同学', closeness: 2 as const }]
    expect(isLonelyStar(baseFriend({ relationships }))).toBe(false)
  })
})
