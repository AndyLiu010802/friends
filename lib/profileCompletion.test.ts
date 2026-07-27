import { describe, it, expect } from 'vitest'
import { calculateProfileCompletion } from './profileCompletion'
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

describe('calculateProfileCompletion', () => {
  it('is 0% with only a name', () => {
    const result = calculateProfileCompletion(baseFriend())
    expect(result.percent).toBe(0)
    expect(result.missing).toHaveLength(8)
  })
  it('adds 15 for birthday', () => {
    expect(calculateProfileCompletion(baseFriend({ birthday: '2000-01-01' })).percent).toBe(15)
  })
  it('adds 10 for mbti', () => {
    expect(calculateProfileCompletion(baseFriend({ mbti: 'ENFP' })).percent).toBe(10)
  })
  it('adds 15 for likes', () => {
    expect(calculateProfileCompletion(baseFriend({ likes: ['咖啡'] })).percent).toBe(15)
  })
  it('adds 10 for dislikes', () => {
    expect(calculateProfileCompletion(baseFriend({ dislikes: ['吵闹'] })).percent).toBe(10)
  })
  it('adds 10 for hobbies', () => {
    expect(calculateProfileCompletion(baseFriend({ hobbies: ['摄影'] })).percent).toBe(10)
  })
  it('adds 10 for notes', () => {
    expect(calculateProfileCompletion(baseFriend({ notes: '大学同学' })).percent).toBe(10)
  })
  it('adds 20 for at least one memory', () => {
    const memories = [{ id:'m1', date:'2026-01-01', title:'记录', content:'', tags:[], media:[] }]
    expect(calculateProfileCompletion(baseFriend({ memories })).percent).toBe(20)
  })
  it('adds 10 for a photo in portraits', () => {
    const portraits = [{ id:'p1', type:'photo' as const, url:'x', thumbnailUrl:'x', size:1 }]
    expect(calculateProfileCompletion(baseFriend({ portraits })).percent).toBe(10)
  })
  it('adds 10 for a photo inside a memory even with no portraits', () => {
    const memories = [{
      id:'m1', date:'2026-01-01', title:'记录', content:'', tags:[],
      media:[{ id:'md1', type:'photo' as const, url:'x', thumbnailUrl:'x', size:1 }],
    }]
    const result = calculateProfileCompletion(baseFriend({ memories }))
    expect(result.percent).toBe(30) // 20 (at least one memory) + 10 (photo found via memory media)
    expect(result.missing).not.toContain('至少一张照片')
  })
  it('is 100% with everything filled in', () => {
    const memories = [{ id:'m1', date:'2026-01-01', title:'记录', content:'', tags:[], media:[] }]
    const portraits = [{ id:'p1', type:'photo' as const, url:'x', thumbnailUrl:'x', size:1 }]
    const result = calculateProfileCompletion(baseFriend({
      birthday: '2000-01-01', mbti: 'ENFP', likes: ['咖啡'], dislikes: ['吵闹'],
      hobbies: ['摄影'], notes: '大学同学', memories, portraits,
    }))
    expect(result.percent).toBe(100)
    expect(result.missing).toHaveLength(0)
  })
})
