import { describe, it, expect } from 'vitest'
import { getGrowthStage } from './growthStage'
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

describe('getGrowthStage', () => {
  it('is dust when only the name is set', () => {
    expect(getGrowthStage(baseFriend()).stage).toBe('dust')
  })
  it('is young when birthday is set', () => {
    expect(getGrowthStage(baseFriend({ birthday: '2000-01-01' })).stage).toBe('young')
  })
  it('is young when notes is set', () => {
    expect(getGrowthStage(baseFriend({ notes: '大学同学' })).stage).toBe('young')
  })
  it('is bright when mbti is set', () => {
    expect(getGrowthStage(baseFriend({ mbti: 'ENFP' })).stage).toBe('bright')
  })
  it('is bright when likes is non-empty', () => {
    expect(getGrowthStage(baseFriend({ likes: ['咖啡'] })).stage).toBe('bright')
  })
  it('is bright when hobbies is non-empty', () => {
    expect(getGrowthStage(baseFriend({ hobbies: ['摄影'] })).stage).toBe('bright')
  })
  it('is stellar with 3 or more memories', () => {
    const memories = [1,2,3].map(n => ({ id:`m${n}`, date:'2026-01-01', title:`记录${n}`, content:'', tags:[], media:[] }))
    expect(getGrowthStage(baseFriend({ memories })).stage).toBe('stellar')
  })
  it('is constellation-core with relationships and 3+ memories', () => {
    const memories = [1,2,3].map(n => ({ id:`m${n}`, date:'2026-01-01', title:`记录${n}`, content:'', tags:[], media:[] }))
    const relationships = [{ friendId: 'f2', label: '同学', closeness: 2 as const }]
    expect(getGrowthStage(baseFriend({ memories, relationships })).stage).toBe('constellation-core')
  })
  it('provides a Chinese label and nextHint', () => {
    const result = getGrowthStage(baseFriend())
    expect(result.label).toBe('星尘')
    expect(result.nextHint.length).toBeGreaterThan(0)
  })
})
