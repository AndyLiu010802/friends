import { describe, it, expect } from 'vitest'
import { searchFriends, lastInteractionDate } from './friendSearch'
import type { Friend, Memory } from './types'

function baseFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'f1', name: 'Test', important: false,
    likes: [], dislikes: [], hobbies: [],
    portraits: [], memories: [], relationships: [],
    starConfig: { kind:'nebula', coreColor:'#94a3b8', glowColor:'#cbd5e1', size:1, twinkleSpeed:2, position:[0,0,0] },
    createdAt: '2026-01-01', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
function mem(date: string, tags: string[] = []): Memory {
  return { id: `m-${date}`, date, title: 't', content: '', tags, media: [] }
}

describe('lastInteractionDate', () => {
  it('取最新回忆日期', () => {
    const f = baseFriend({ memories: [mem('2026-01-05'), mem('2026-03-01'), mem('2026-02-10')] })
    expect(lastInteractionDate(f)).toBe('2026-03-01')
  })
  it('无回忆时用 updatedAt 的日期部分', () => {
    expect(lastInteractionDate(baseFriend({ updatedAt: '2026-05-20T08:00:00.000Z' }))).toBe('2026-05-20')
  })
})

describe('searchFriends 空查询', () => {
  it('important 置顶,组内按最近互动倒序', () => {
    const a = baseFriend({ id:'a', name:'阿明', memories: [mem('2026-07-01')] })
    const b = baseFriend({ id:'b', name:'小红', important: true, memories: [mem('2026-01-01')] })
    const c = baseFriend({ id:'c', name:'老王', memories: [mem('2026-07-20')] })
    const ids = searchFriends([a, b, c], '').map(r => r.friend.id)
    expect(ids).toEqual(['b', 'c', 'a'])
  })
  it('空白查询等同空查询', () => {
    expect(searchFriends([baseFriend()], '   ')).toHaveLength(1)
  })
})

describe('searchFriends 匹配', () => {
  it('名字前缀优先于名字包含', () => {
    const prefix = baseFriend({ id:'p', name:'明明' })
    const contains = baseFriend({ id:'c', name:'小明', memories: [mem('2026-07-20')] })
    const ids = searchFriends([contains, prefix], '明').map(r => r.friend.id)
    expect(ids).toEqual(['p', 'c'])
  })
  it('昵称匹配并带命中信息', () => {
    const f = baseFriend({ name:'王芳', nickname:'芳芳' })
    const [r] = searchFriends([f], '芳芳')
    expect(r.matchField).toBe('nickname')
    expect(r.matchText).toBe('芳芳')
  })
  it('喜好/雷区/爱好匹配并带命中信息', () => {
    const f = baseFriend({ name:'王芳', likes:['火锅'] })
    const [r] = searchFriends([f], '火锅')
    expect(r.matchField).toBe('like')
    expect(r.matchText).toBe('火锅')
  })
  it('回忆标签匹配', () => {
    const f = baseFriend({ name:'王芳', memories:[mem('2026-01-01', ['爬山'])] })
    const [r] = searchFriends([f], '爬山')
    expect(r.matchField).toBe('tag')
    expect(r.matchText).toBe('爬山')
  })
  it('英文匹配大小写不敏感', () => {
    const f = baseFriend({ name:'Alice' })
    expect(searchFriends([f], 'ali')).toHaveLength(1)
  })
  it('同级命中按最近互动倒序', () => {
    const old = baseFriend({ id:'old', name:'小明', memories:[mem('2026-01-01')] })
    const fresh = baseFriend({ id:'fresh', name:'小明月', memories:[mem('2026-07-20')] })
    const ids = searchFriends([old, fresh], '小明').map(r => r.friend.id)
    expect(ids).toEqual(['fresh', 'old'])
  })
  it('无匹配返回空数组', () => {
    expect(searchFriends([baseFriend({ name:'王芳' })], '不存在')).toEqual([])
  })
})
