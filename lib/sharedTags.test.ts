import { describe, it, expect } from 'vitest'
import { getFriendTags, getSharedTags } from './sharedTags'
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

describe('getFriendTags', () => {
  it('collects tags from hobbies', () => {
    expect(getFriendTags(baseFriend({ hobbies: ['摄影'] }))).toEqual(['摄影'])
  })
  it('collects tags from likes', () => {
    expect(getFriendTags(baseFriend({ likes: ['咖啡'] }))).toEqual(['咖啡'])
  })
  it('collects tags from memory.tags', () => {
    const memories = [{ id:'m1', date:'2026-01-01', title:'t', content:'', tags:['旅行'], media:[] }]
    expect(getFriendTags(baseFriend({ memories }))).toEqual(['旅行'])
  })
  it('dedupes across hobbies, likes, and memory tags', () => {
    const memories = [{ id:'m1', date:'2026-01-01', title:'t', content:'', tags:['咖啡'], media:[] }]
    const tags = getFriendTags(baseFriend({ hobbies: ['咖啡'], likes: ['咖啡'], memories }))
    expect(tags).toEqual(['咖啡'])
  })
  it('filters out falsy tags', () => {
    expect(getFriendTags(baseFriend({ hobbies: ['', '摄影'] }))).toEqual(['摄影'])
  })
})

describe('getSharedTags', () => {
  it('returns tags present on both friends', () => {
    const a = baseFriend({ id:'a', hobbies: ['摄影', '咖啡'] })
    const b = baseFriend({ id:'b', likes: ['咖啡', '旅行'] })
    expect(getSharedTags(a, b)).toEqual(['咖啡'])
  })
  it('returns [] when there is no overlap', () => {
    const a = baseFriend({ id:'a', hobbies: ['摄影'] })
    const b = baseFriend({ id:'b', hobbies: ['滑雪'] })
    expect(getSharedTags(a, b)).toEqual([])
  })
})
