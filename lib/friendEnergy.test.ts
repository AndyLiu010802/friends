import { describe, it, expect } from 'vitest'
import { calculateFriendEnergy } from './friendEnergy'
import type { Friend, Memory } from './types'

function baseFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'f1', name: 'Test', important: false,
    likes: [], dislikes: [], hobbies: [],
    portraits: [], memories: [], relationships: [],
    starConfig: { kind:'nebula', coreColor:'#94a3b8', glowColor:'#cbd5e1', size:1, twinkleSpeed:2, position:[0,0,0] },
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function memory(overrides: Partial<Memory> = {}): Memory {
  return { id:'m1', date:'2026-01-01', title:'记录', content:'', tags:[], media:[], ...overrides }
}

const NOW = new Date('2026-07-01T00:00:00.000Z')

describe('calculateFriendEnergy', () => {
  it('is low with no memories or relationships', () => {
    const result = calculateFriendEnergy(baseFriend(), NOW)
    expect(result.level).toBe('low')
    expect(result.score).toBe(0)
    expect(result.lastActivityText).toBe('还没有记录')
  })
  it('adds 1 point per memory', () => {
    const result = calculateFriendEnergy(baseFriend({ memories: [memory(), memory({ id:'m2' })] }), NOW)
    expect(result.score).toBe(2)
  })
  it('adds 2 points for a memory with media', () => {
    const withMedia = memory({ media: [{ id:'md1', type:'photo', url:'x', thumbnailUrl:'x', size:1 }] })
    const result = calculateFriendEnergy(baseFriend({ memories: [withMedia] }), NOW)
    expect(result.score).toBe(3) // 1 (memory) + 2 (media)
  })
  it('adds 1 point for long memory content', () => {
    const longContent = memory({ content: 'x'.repeat(51) })
    const result = calculateFriendEnergy(baseFriend({ memories: [longContent] }), NOW)
    expect(result.score).toBe(2) // 1 (memory) + 1 (long content)
  })
  it('adds relationship closeness as points', () => {
    const result = calculateFriendEnergy(baseFriend({
      relationships: [{ friendId:'f2', label:'同学', closeness: 3 }],
    }), NOW)
    expect(result.score).toBe(3)
  })
  it('adds 3 points when the latest memory is within 30 days', () => {
    const recent = memory({ date: '2026-06-20' })
    const result = calculateFriendEnergy(baseFriend({ memories: [recent] }), NOW)
    expect(result.score).toBe(4) // 1 (memory) + 3 (recent)
    expect(result.lastActivityText).toBe('最近一次记录：2026-06-20')
  })
  it('does not add recency points when the latest memory is older than 30 days', () => {
    const old = memory({ date: '2026-01-01' })
    const result = calculateFriendEnergy(baseFriend({ memories: [old] }), NOW)
    expect(result.score).toBe(1) // just the memory point, no recency bonus
  })
  it('falls back to updatedAt for the recency bonus only when there are no memories', () => {
    const result = calculateFriendEnergy(baseFriend({ updatedAt: '2026-06-25T00:00:00.000Z' }), NOW)
    expect(result.score).toBe(3) // recency bonus from updatedAt
    expect(result.lastActivityText).toBe('还没有记录') // text never claims a memory that doesn't exist
  })
  it('reaches legendary at 13+ points', () => {
    const memories = [1,2,3,4,5].map(n => memory({ id:`m${n}`, date:'2026-06-25', content:'x'.repeat(51) }))
    const result = calculateFriendEnergy(baseFriend({ memories }), NOW)
    expect(result.score).toBeGreaterThanOrEqual(13)
    expect(result.level).toBe('legendary')
  })
})
