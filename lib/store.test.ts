import { describe, it, expect, beforeEach } from 'vitest'
import { getFriends, saveFriend, deleteFriend } from './store'
import type { Friend } from './types'

const MOCK_FRIEND: Friend = {
  id: 'f1', name: '小雨', birthday: '1999-06-05', zodiac: '双子座',
  mbti: 'ENFP', likes: [], dislikes: [], hobbies: [],
  portraits: [], memories: [], relationships: [],
  starConfig: { kind:'radiant', coreColor:'#38bdf8', glowColor:'#818cf8',
    size:1, twinkleSpeed:2, position:[0,0,0] },
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
}

beforeEach(() => localStorage.clear())

describe('store', () => {
  it('returns empty array when no data', () => {
    expect(getFriends()).toEqual([])
  })
  it('saves and retrieves a friend', () => {
    saveFriend(MOCK_FRIEND)
    expect(getFriends()).toHaveLength(1)
    expect(getFriends()[0].name).toBe('小雨')
  })
  it('updates existing friend', () => {
    saveFriend(MOCK_FRIEND)
    saveFriend({ ...MOCK_FRIEND, name: '小雨雨' })
    const friends = getFriends()
    expect(friends).toHaveLength(1)
    expect(friends[0].name).toBe('小雨雨')
  })
  it('deletes a friend', () => {
    saveFriend(MOCK_FRIEND)
    deleteFriend('f1')
    expect(getFriends()).toHaveLength(0)
  })
})
