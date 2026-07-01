// lib/insights.test.ts
import { describe, it, expect } from 'vitest'
import { generateFriendInsights } from './insights'
import type { Friend } from './types'

const NOW = new Date(2026, 6, 1) // 2026-07-01, matches today's date in this project

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

describe('generateFriendInsights', () => {
  it('flags a birthday today at priority 3', () => {
    const friend = baseFriend({ name: '小雨', birthday: '2000-07-01' })
    const insights = generateFriendInsights([friend], NOW)
    const birthday = insights.find(i => i.type === 'birthday')
    expect(birthday).toBeDefined()
    expect(birthday!.priority).toBe(3)
    expect(birthday!.text).toContain('小雨')
  })

  it('flags a birthday 3 days away at priority 3', () => {
    const friend = baseFriend({ name: '小雨', birthday: '2000-07-04' })
    const insights = generateFriendInsights([friend], NOW)
    const birthday = insights.find(i => i.type === 'birthday')
    expect(birthday).toBeDefined()
    expect(birthday!.priority).toBe(3)
    expect(birthday!.text).toContain('3 天后')
  })

  it('flags profile completion below 50% as an incomplete insight', () => {
    const friend = baseFriend({ name: '空档案' })
    const insights = generateFriendInsights([friend], NOW)
    expect(insights.some(i => i.type === 'incomplete')).toBe(true)
  })

  it('flags an important friend with no memory in the last 30 days', () => {
    const friend = baseFriend({
      name: 'Nick', important: true,
      memories: [{ id:'m1', date:'2026-01-01', title:'t', content:'', tags:[], media:[] }],
    })
    const insights = generateFriendInsights([friend], NOW)
    const important = insights.find(i => i.type === 'important')
    expect(important).toBeDefined()
    expect(important!.priority).toBe(2)
  })

  it('flags a lonely star', () => {
    const friend = baseFriend({ name: 'Tom' })
    const insights = generateFriendInsights([friend], NOW)
    expect(insights.some(i => i.type === 'lonely')).toBe(true)
  })

  it('returns at most 5 insights', () => {
    const friends = Array.from({ length: 10 }, (_, i) => baseFriend({ id: `f${i}`, name: `F${i}` }))
    const insights = generateFriendInsights(friends, NOW)
    expect(insights.length).toBeLessThanOrEqual(5)
  })

  it('sorts higher-priority insights first', () => {
    const friends = [
      baseFriend({ id: 'a', name: 'A' }), // lonely -> priority 1, incomplete -> priority 1
      baseFriend({ id: 'b', name: 'B', birthday: '2000-07-01' }), // birthday today -> priority 3
    ]
    const insights = generateFriendInsights(friends, NOW)
    expect(insights[0].priority).toBe(3)
  })
})
