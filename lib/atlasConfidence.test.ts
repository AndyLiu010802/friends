import { describe, it, expect } from 'vitest'
import { calculateAtlasConfidence } from './atlasConfidence'
import type { Friend } from './types'

function makeFriend(overrides: Partial<Friend>): Friend {
  return {
    id: 'f1', name: 'Test', important: false, likes: [], dislikes: [], hobbies: [],
    portraits: [], memories: [], relationships: [],
    starConfig: { kind: 'nebula', coreColor: '#000', glowColor: '#000', size: 1, twinkleSpeed: 2, position: [0, 0, 0] },
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  }
}

describe('calculateAtlasConfidence', () => {
  it('returns low for a friend with only a name', () => {
    expect(calculateAtlasConfidence(makeFriend({})).level).toBe('low')
  })

  it('returns medium for a friend with 3+ memories', () => {
    const memories = Array.from({ length: 3 }, (_, i) => ({
      id: `m${i}`, date: '2026-01-01', title: 't', content: 'c', tags: [], media: [],
    }))
    expect(calculateAtlasConfidence(makeFriend({ memories })).level).toBe('medium')
  })

  it('returns medium for a friend with rich profile fields but few memories', () => {
    const friend = makeFriend({ notes: '很聊得来', likes: ['咖啡'], hobbies: ['爬山'] })
    expect(calculateAtlasConfidence(friend).level).toBe('medium')
  })

  it('returns high for a friend with 8+ memories and a rich profile', () => {
    const memories = Array.from({ length: 8 }, (_, i) => ({
      id: `m${i}`, date: '2026-01-01', title: 't', content: 'c', tags: [], media: [],
    }))
    const friend = makeFriend({ memories, notes: '很聊得来', likes: ['咖啡'], hobbies: ['爬山'] })
    expect(calculateAtlasConfidence(friend).level).toBe('high')
  })

  it('returns medium (not high) for 8+ memories but a thin profile', () => {
    const memories = Array.from({ length: 8 }, (_, i) => ({
      id: `m${i}`, date: '2026-01-01', title: 't', content: 'c', tags: [], media: [],
    }))
    expect(calculateAtlasConfidence(makeFriend({ memories })).level).toBe('medium')
  })
})
