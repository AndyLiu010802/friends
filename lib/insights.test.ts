// lib/insights.test.ts
import { describe, it, expect } from 'vitest'
import { generateFriendInsights, INSIGHT_DISPLAY_CAP } from './insights'
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

  it('returns at most 8 insights', () => {
    const friends = Array.from({ length: 10 }, (_, i) => baseFriend({ id: `f${i}`, name: `F${i}` }))
    const insights = generateFriendInsights(friends, NOW)
    expect(insights.length).toBeLessThanOrEqual(8)
  })

  it('sorts higher-priority insights first', () => {
    const friends = [
      baseFriend({ id: 'a', name: 'A' }), // lonely -> priority 1, incomplete -> priority 1
      baseFriend({ id: 'b', name: 'B', birthday: '2000-07-01' }), // birthday today -> priority 3
    ]
    const insights = generateFriendInsights(friends, NOW)
    expect(insights[0].priority).toBe(3)
  })

  it('flags a friend with a memory older than 60 days as inactive', () => {
    const friend = baseFriend({
      name: 'Jason',
      memories: [{ id:'m1', date:'2026-04-01', title:'t', content:'', tags:[], media:[] }],
    })
    const insights = generateFriendInsights([friend], NOW)
    const inactive = insights.find(i => i.type === 'inactive')
    expect(inactive).toBeDefined()
    expect(inactive!.priority).toBe(2)
    expect(inactive!.text).toContain('天')
  })

  it('flags a friend with a memory in the last 7 days as recent-memory', () => {
    const friend = baseFriend({
      name: 'Emma',
      memories: [{ id:'m1', date:'2026-06-28', title:'t', content:'', tags:[], media:[] }],
    })
    const insights = generateFriendInsights([friend], NOW)
    const recent = insights.find(i => i.type === 'recent-memory')
    expect(recent).toBeDefined()
    expect(recent!.priority).toBe(2)
    expect(recent!.text).toContain('Emma')
  })
})

describe('新信号:goal-drift', () => {
  it('deepen 且超 30 天无记录:priority 2', () => {
    const f = baseFriend({ relationshipGoal: 'deepen',
      memories: [{ id:'m1', date:'2026-05-01', title:'t', content:'', tags:[], media:[] }] })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'goal-drift')!
    expect(hit.text).toContain('更近一步')
    expect(hit.priority).toBe(2)
    expect(hit.dismissible).toBe(true)
    expect(hit.fingerprint).toBe('2026-05-01')
  })
  it('deepen 且完全无记录也触发,指纹为 none', () => {
    const f = baseFriend({ relationshipGoal: 'deepen' })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'goal-drift')!
    expect(hit.fingerprint).toBe('none')
  })
  it('deepen 但 30 天内有记录:不触发', () => {
    const f = baseFriend({ relationshipGoal: 'deepen',
      memories: [{ id:'m1', date:'2026-06-25', title:'t', content:'', tags:[], media:[] }] })
    expect(generateFriendInsights([f], NOW).find(i => i.type === 'goal-drift')).toBeUndefined()
  })
  it('repair 且最新记录为 negative:priority 3,指纹为该记录 id', () => {
    const f = baseFriend({ relationshipGoal: 'repair', memories: [
      { id:'ok', date:'2026-07-01', title:'t', content:'', tags:[], media:[], valence:'positive' },
      { id:'bad', date:'2026-07-20', title:'t', content:'', tags:[], media:[], valence:'negative' },
    ] })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'goal-drift')!
    expect(hit.priority).toBe(3)
    expect(hit.text).toContain('缓和')
    expect(hit.fingerprint).toBe('bad')
  })
  it('repair 但最新记录非 negative:不触发', () => {
    const f = baseFriend({ relationshipGoal: 'repair', memories: [
      { id:'bad', date:'2026-07-01', title:'t', content:'', tags:[], media:[], valence:'negative' },
      { id:'ok', date:'2026-07-20', title:'t', content:'', tags:[], media:[], valence:'positive' },
    ] })
    expect(generateFriendInsights([f], NOW).find(i => i.type === 'goal-drift')).toBeUndefined()
  })
})

describe('新信号:one-sided', () => {
  const mem = (id: string, date: string, initiator?: 'me' | 'friend' | 'both') =>
    ({ id, date, title:'t', content:'', tags:[], media:[], initiator })
  it('最近 5 条有 initiator 的记录全为 me:触发,指纹为 5 个 id', () => {
    const f = baseFriend({ memories: [
      mem('m1','2026-07-01','me'), mem('m2','2026-07-02','me'), mem('m3','2026-07-03','me'),
      mem('m4','2026-07-04','me'), mem('m5','2026-07-05','me'),
      mem('old','2026-01-01','friend'), // 第 6 近,不在窗口内
      mem('x','2026-07-06'),            // 无 initiator,不计入选取
    ] })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'one-sided')!
    expect(hit.priority).toBe(2)
    expect(hit.fingerprint).toBe('m5,m4,m3,m2,m1')
  })
  it('有 initiator 的记录不足 5 条:不触发', () => {
    const f = baseFriend({ memories: [
      mem('m1','2026-07-01','me'), mem('m2','2026-07-02','me'),
      mem('m3','2026-07-03','me'), mem('m4','2026-07-04','me'),
    ] })
    expect(generateFriendInsights([f], NOW).find(i => i.type === 'one-sided')).toBeUndefined()
  })
  it('最近 5 条里混有 friend/both:不触发', () => {
    const f = baseFriend({ memories: [
      mem('m1','2026-07-01','me'), mem('m2','2026-07-02','me'), mem('m3','2026-07-03','both'),
      mem('m4','2026-07-04','me'), mem('m5','2026-07-05','me'),
    ] })
    expect(generateFriendInsights([f], NOW).find(i => i.type === 'one-sided')).toBeUndefined()
  })
})

describe('生日三档', () => {
  it('今天生日:priority 3 且不可忽略,指纹含 today', () => {
    const f = baseFriend({ birthday: '2000-07-01' })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'birthday')!
    expect(hit.priority).toBe(3)
    expect(hit.dismissible).toBe(false)
    expect(hit.fingerprint).toBe('2026-07-01-today')
  })
  it('7 天内:priority 3 可忽略,档位 soon', () => {
    const f = baseFriend({ birthday: '2000-07-06' })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'birthday')!
    expect(hit.priority).toBe(3)
    expect(hit.dismissible).toBe(true)
    expect(hit.fingerprint).toBe('2026-07-06-soon')
  })
  it('8-14 天:priority 2,档位 later', () => {
    const f = baseFriend({ birthday: '2000-07-12' })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'birthday')!
    expect(hit.priority).toBe(2)
    expect(hit.fingerprint).toBe('2026-07-12-later')
    expect(hit.text).toContain('11 天后')
  })
  it('15 天以上:无生日信号', () => {
    const f = baseFriend({ birthday: '2000-07-19' })
    expect(generateFriendInsights([f], NOW).find(i => i.type === 'birthday')).toBeUndefined()
  })
  it('恰好 7 天:仍是 soon 档 priority 3', () => {
    const f = baseFriend({ birthday: '2000-07-08' })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'birthday')!
    expect(hit.priority).toBe(3)
    expect(hit.fingerprint).toBe('2026-07-08-soon')
  })
  it('恰好 8 天:进入 later 档 priority 2', () => {
    const f = baseFriend({ birthday: '2000-07-09' })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'birthday')!
    expect(hit.priority).toBe(2)
    expect(hit.fingerprint).toBe('2026-07-09-later')
  })
  it('恰好 14 天:仍触发 later 档', () => {
    const f = baseFriend({ birthday: '2000-07-15' })
    expect(generateFriendInsights([f], NOW).find(i => i.type === 'birthday')!.fingerprint).toBe('2026-07-15-later')
  })
})

describe('通用字段', () => {
  it('所有信号都带 fingerprint 与 dismissible', () => {
    const f = baseFriend({ birthday: '2000-07-10', relationshipGoal: 'deepen' })
    for (const ins of generateFriendInsights([f], NOW)) {
      expect(typeof ins.fingerprint).toBe('string')
      expect(ins.fingerprint.length).toBeGreaterThan(0)
      expect(typeof ins.dismissible).toBe('boolean')
    }
  })
  it('生成层不截断(上限由展示层在过滤忽略后应用,保证补位)', () => {
    const many = Array.from({ length: 6 }, (_, i) => baseFriend({
      id: `f${i}`, name: `友${i}`, birthday: '2000-07-10', relationshipGoal: 'deepen',
    }))
    expect(generateFriendInsights(many, NOW).length).toBeGreaterThan(INSIGHT_DISPLAY_CAP)
  })
})
