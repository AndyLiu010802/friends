import { describe, it, expect } from 'vitest'
import { selectMemoriesForAtlas } from './selectMemoriesForAtlas'
import type { Friend, Memory } from '../types'

function makeFriend(memories: Memory[]): Friend {
  return {
    id: 'f1', name: 'Test', important: false, likes: [], dislikes: [], hobbies: [],
    portraits: [], memories, relationships: [],
    starConfig: { kind: 'nebula', coreColor: '#000', glowColor: '#000', size: 1, twinkleSpeed: 2, position: [0, 0, 0] },
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  }
}

function makeMemory(overrides: Partial<Memory> & { id: string }): Memory {
  return { date: '2026-01-01', title: 't', content: 'c', tags: [], media: [], ...overrides }
}

describe('selectMemoriesForAtlas', () => {
  it('returns an empty array for a friend with no memories', () => {
    expect(selectMemoriesForAtlas(makeFriend([]))).toEqual([])
  })

  it('caps the result at 30 memories', () => {
    const memories = Array.from({ length: 45 }, (_, i) =>
      makeMemory({ id: `m${i}`, date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}` })
    )
    expect(selectMemoriesForAtlas(makeFriend(memories)).length).toBeLessThanOrEqual(30)
  })

  it('includes a memory matching a priority keyword even if it is not among the 15 most recent', () => {
    const filler = Array.from({ length: 20 }, (_, i) =>
      makeMemory({ id: `filler${i}`, date: `2026-05-${String(i + 1).padStart(2, '0')}` })
    )
    const giftMemory = makeMemory({ id: 'gift', date: '2026-01-01', content: '她提到想要一份生日礼物' })
    const result = selectMemoriesForAtlas(makeFriend([...filler, giftMemory]))
    expect(result.some(m => m.id === 'gift')).toBe(true)
  })

  it('includes the earliest memory even when it is far outside the 15 most recent', () => {
    const recent = Array.from({ length: 20 }, (_, i) =>
      makeMemory({ id: `r${i}`, date: `2026-03-${String(i + 1).padStart(2, '0')}` })
    )
    const earliest = makeMemory({ id: 'earliest', date: '2015-01-01' })
    const result = selectMemoriesForAtlas(makeFriend([...recent, earliest]))
    expect(result.some(m => m.id === 'earliest')).toBe(true)
  })
})
