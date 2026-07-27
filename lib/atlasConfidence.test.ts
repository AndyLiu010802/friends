import { describe, it, expect } from 'vitest'
import { calculateAtlasConfidence } from './atlasConfidence'
import type { Friend, Memory } from './types'

function makeFriend(overrides: Partial<Friend>): Friend {
  return {
    id: 'f1', name: 'Test', important: false, likes: [], dislikes: [], hobbies: [],
    portraits: [], memories: [], relationships: [],
    starConfig: { kind: 'nebula', coreColor: '#000', glowColor: '#000', size: 1, twinkleSpeed: 2, position: [0, 0, 0] },
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  }
}

function makeMemory(overrides: Partial<Memory> & { id: string }): Memory {
  return { date: '2026-01-01', title: 't', content: 'c', tags: [], media: [], ...overrides }
}

const NOW = new Date('2026-07-01')

// 8 条记录：跨度 2026-03-01 → 2026-06-20（>90 天），最新一条在 NOW 的 60 天内，
// 3 种标签，含 positive + negative 两种效价 —— 五个维度全满足。
function richMemories(): Memory[] {
  return [
    makeMemory({ id: 'm0', date: '2026-03-01', tags: ['旅行'], valence: 'positive' }),
    makeMemory({ id: 'm1', date: '2026-03-20', tags: ['吃饭'] }),
    makeMemory({ id: 'm2', date: '2026-04-05', tags: ['工作'], valence: 'negative' }),
    makeMemory({ id: 'm3', date: '2026-04-18' }),
    makeMemory({ id: 'm4', date: '2026-05-02' }),
    makeMemory({ id: 'm5', date: '2026-05-20' }),
    makeMemory({ id: 'm6', date: '2026-06-08' }),
    makeMemory({ id: 'm7', date: '2026-06-20' }),
  ]
}

describe('calculateAtlasConfidence', () => {
  it('returns low for a friend with only a name', () => {
    expect(calculateAtlasConfidence(makeFriend({}), NOW).level).toBe('low')
  })

  it('returns medium for a friend with 3+ memories', () => {
    const memories = Array.from({ length: 3 }, (_, i) => makeMemory({ id: `m${i}` }))
    expect(calculateAtlasConfidence(makeFriend({ memories }), NOW).level).toBe('medium')
  })

  it('returns medium for a friend with rich profile fields but few memories', () => {
    const friend = makeFriend({ notes: '很聊得来', likes: ['咖啡'], hobbies: ['爬山'] })
    expect(calculateAtlasConfidence(friend, NOW).level).toBe('medium')
  })

  it('returns high when quantity, recency, diversity, valence coverage and time span are all present', () => {
    const friend = makeFriend({ memories: richMemories(), notes: '很聊得来', likes: ['咖啡'], hobbies: ['爬山'] })
    const result = calculateAtlasConfidence(friend, NOW)
    expect(result.level).toBe('high')
    expect(result.dimensions).toEqual({
      quantity: true, recency: true, diversity: true, valenceCoverage: true, timeSpan: true,
    })
  })

  it('demotes to medium when there is no record in the last 60 days, and says so', () => {
    // 全部日期前移到 2025 年：跨度和多样性仍在，但最新记录距 NOW 超过 60 天
    const stale = richMemories().map(m => ({ ...m, date: m.date.replace('2026', '2025') }))
    const friend = makeFriend({ memories: stale, notes: '很聊得来', likes: ['咖啡'], hobbies: ['爬山'] })
    const result = calculateAtlasConfidence(friend, NOW)
    expect(result.level).toBe('medium')
    expect(result.reason).toContain('最近 60 天')
  })

  it('demotes to medium when memories are many but structurally thin (same day, no tags, no valence)', () => {
    const memories = Array.from({ length: 8 }, (_, i) => makeMemory({ id: `m${i}`, date: '2026-06-20' }))
    const friend = makeFriend({ memories, notes: '很聊得来', likes: ['咖啡'], hobbies: ['爬山'] })
    expect(calculateAtlasConfidence(friend, NOW).level).toBe('medium')
  })

  it('returns medium (not high) for 8+ structurally rich memories but a thin profile', () => {
    expect(calculateAtlasConfidence(makeFriend({ memories: richMemories() }), NOW).level).toBe('medium')
  })
})
