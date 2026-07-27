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

  it('excludes a middling-date memory that only a correct desc/asc split leaves out', () => {
    // 25 memories, strictly increasing dates Jan 1 (m0) .. Jan 25 (m24), no ties,
    // identical content/tags so the length/tag-count/keyword buckets can't interfere
    // and can't accidentally rescue the memory this test checks for.
    //
    // With the correct byDateDesc (most recent first) / byDateAsc (earliest first)
    // assignment: 15 most recent = m10..m24, 3 earliest = m0..m2. m5 (Jan 6) falls
    // in neither slice and is excluded.
    //
    // If byDateDesc/byDateAsc were swapped (each sort comparator kept, but bound to
    // the other's variable name), the "recent" bucket would instead take the 15
    // EARLIEST (m0..m14) and the "earliest" bucket would take the 3 MOST RECENT
    // (m22..m24) -- so m5 would be INCLUDED (it's within the first 15 earliest).
    //
    // m5's presence/absence therefore flips between the correct and swapped
    // implementations, making it a reliable discriminator that the two prior
    // "earliest survives" / "keyword survives" tests do not provide.
    const memories = Array.from({ length: 25 }, (_, i) =>
      makeMemory({ id: `m${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}` })
    )
    const result = selectMemoriesForAtlas(makeFriend(memories))
    const ids = result.map(m => m.id)
    expect(ids).not.toContain('m5')
  })

  // 下面两个测试的构造要点：目标记忆必须不被任何现有桶救起——
  // 不在最近 15 条（20 条 5 月 recent 占位）、不在最早 3 条（5 条 1 月 early 占位）、
  // 内容比 recent 短（长内容名额被占）、无标签（tag 名额被 early 的双标签占）。
  it('includes a negative-valence memory that no existing bucket would select', () => {
    const recent = Array.from({ length: 20 }, (_, i) =>
      makeMemory({ id: `recent${i}`, date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        content: '这是一条比较长的普通聚餐流水账，用来占住长内容名额的填充记录' })
    )
    const early = Array.from({ length: 5 }, (_, i) =>
      makeMemory({ id: `early${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}`, tags: ['a', 'b'] })
    )
    const conflict = makeMemory({ id: 'conflict', date: '2026-03-01', valence: 'negative' })
    const result = selectMemoriesForAtlas(makeFriend([...recent, ...early, conflict]))
    expect(result.some(m => m.id === 'conflict')).toBe(true)
  })

  it('includes a memory matching a conflict-repair keyword (道歉) that no other bucket would select', () => {
    const recent = Array.from({ length: 20 }, (_, i) =>
      makeMemory({ id: `recent${i}`, date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        content: '这是一条比较长的普通聚餐流水账，用来占住长内容名额的填充记录' })
    )
    const early = Array.from({ length: 5 }, (_, i) =>
      makeMemory({ id: `early${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}`, tags: ['a', 'b'] })
    )
    const apology = makeMemory({ id: 'apology', date: '2026-03-01', content: '后来他主动道歉了' })
    const result = selectMemoriesForAtlas(makeFriend([...recent, ...early, apology]))
    expect(result.some(m => m.id === 'apology')).toBe(true)
  })
})
