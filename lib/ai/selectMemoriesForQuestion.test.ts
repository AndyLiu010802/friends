import { describe, it, expect } from 'vitest'
import { selectRelevantMemoriesForQuestion } from './selectMemoriesForQuestion'
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

describe('selectRelevantMemoriesForQuestion', () => {
  it('always includes the 5 most recent memories regardless of the question', () => {
    const memories = Array.from({ length: 10 }, (_, i) =>
      makeMemory({ id: `m${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}` })
    )
    const result = selectRelevantMemoriesForQuestion(makeFriend(memories), '随便问问')
    const mostRecentFive = ['m9', 'm8', 'm7', 'm6', 'm5']
    mostRecentFive.forEach(id => expect(result.some(m => m.id === id)).toBe(true))
  })

  it('includes gift/like-keyword memories when the question mentions 礼物', () => {
    const other = Array.from({ length: 5 }, (_, i) =>
      makeMemory({ id: `o${i}`, date: `2026-02-${String(i + 1).padStart(2, '0')}` })
    )
    const giftMemory = makeMemory({ id: 'gift', date: '2020-01-01', content: '她说想要一个包' })
    const result = selectRelevantMemoriesForQuestion(makeFriend([...other, giftMemory]), 'TA 生日想要什么礼物？')
    expect(result.some(m => m.id === 'gift')).toBe(true)
  })

  it('includes the earliest and 8 most recent memories when the question is about relationship trend', () => {
    const memories = Array.from({ length: 15 }, (_, i) =>
      makeMemory({ id: `m${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}` })
    )
    const result = selectRelevantMemoriesForQuestion(makeFriend(memories), '我们最近关系是变近还是变远？')
    expect(result.some(m => m.id === 'm0')).toBe(true) // earliest
  })

  it('includes the 2nd- and 3rd-earliest memories (not just the single earliest) for trend questions', () => {
    // 20 memories, strictly increasing dates Jan 1 (m0) .. Jan 20 (m19), no ties,
    // identical neutral content so no keyword bucket can rescue any memory.
    //
    // Correct behavior: trend questions add the 3 earliest (m0, m1, m2) and the
    // 8 most recent (m12..m19). m1 and m2 fall outside the "8 most recent" and
    // outside the base "5 most recent" (m15..m19), so they only appear via the
    // "3 earliest" slice. If that slice bound were narrowed from 3 to 1 (e.g. an
    // off-by-N mutation), m1/m2 would silently disappear while m0 alone would
    // still pass -- a gap the "includes the earliest" test above does not catch.
    const memories = Array.from({ length: 20 }, (_, i) =>
      makeMemory({ id: `m${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}` })
    )
    const result = selectRelevantMemoriesForQuestion(makeFriend(memories), '我们最近关系是变近还是变远？')
    const ids = result.map(m => m.id)
    expect(ids).toContain('m1')
    expect(ids).toContain('m2')
  })

  it('caps the result at 15 memories', () => {
    const memories = Array.from({ length: 30 }, (_, i) =>
      makeMemory({ id: `m${i}`, date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, content: '重要 生日 礼物' })
    )
    expect(selectRelevantMemoriesForQuestion(makeFriend(memories), '关系变近了吗？').length).toBeLessThanOrEqual(15)
  })

  it('truncates content over 600 characters', () => {
    const longMemory = makeMemory({ id: 'long', content: 'x'.repeat(700) })
    const result = selectRelevantMemoriesForQuestion(makeFriend([longMemory]), '随便问问')
    expect(result[0].content.length).toBeLessThanOrEqual(601 + 1) // 600 chars + "……"
  })
})
