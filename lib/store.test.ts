import { describe, it, expect, beforeEach } from 'vitest'
import {
  getFriends, saveFriend, deleteFriend,
  getAtlasList, saveAtlas, getAtlasByFriendId, deleteAtlas,
  getAtlasChats, getAtlasChatByFriendId, saveAtlasChat, deleteAtlasChat,
  replaceFriends, replaceAtlasList, replaceAtlasChats,
} from './store'
import type { Friend, Atlas, AtlasChat } from './types'

const MOCK_FRIEND: Friend = {
  id: 'f1', name: '小雨', birthday: '1999-06-05', zodiac: '双子座',
  mbti: 'ENFP', important: false, likes: [], dislikes: [], hobbies: [],
  portraits: [], memories: [], relationships: [],
  starConfig: { kind:'radiant', coreColor:'#38bdf8', glowColor:'#818cf8',
    size:1, twinkleSpeed:2, position:[0,0,0] },
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
}

const MOCK_ATLAS: Atlas = {
  id: 'a1', friendId: 'f1', generatedAt: '2026-01-01', model: 'gpt-5.5',
  recordStats: { memoryCount:0, relationshipCount:0, likesCount:0, dislikesCount:0, hobbiesCount:0, noteLength:0, confidence:'low' },
  summary: 's', roleInMyLife: 'r', keyDetailsToRemember: [], recentInteractionInsight: 'i',
  conversationTopics: [], giftIdeas: [], warnings: [], suitableActivities: [],
  relationshipTrend: 't', evidence: [], rawInput: {},
}

const MOCK_CHAT: AtlasChat = {
  id: 'c1', friendId: 'f1', messages: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
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
  it('backfills important:false for legacy records missing the field', () => {
    const legacy = { ...MOCK_FRIEND } as Partial<Friend>
    delete legacy.important
    localStorage.setItem('yj_friends', JSON.stringify([legacy]))
    const friends = getFriends()
    expect(friends[0].important).toBe(false)
  })
  it('defaults missing array fields to empty arrays for legacy records', () => {
    const legacy = { id: 'f2', name: 'Old Friend', createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    localStorage.setItem('yj_friends', JSON.stringify([legacy]))
    const friends = getFriends()
    expect(friends[0].likes).toEqual([])
    expect(friends[0].memories).toEqual([])
    expect(friends[0].relationships).toEqual([])
    expect(friends[0].starConfig.kind).toBe('nebula')
  })
})

describe('deleteAtlas', () => {
  it('removes the atlas for a friendId', () => {
    saveAtlas(MOCK_ATLAS)
    deleteAtlas('f1')
    expect(getAtlasByFriendId('f1')).toBeUndefined()
  })
})

describe('atlas chat store', () => {
  it('returns empty array when no chats exist', () => {
    expect(getAtlasChats()).toEqual([])
  })
  it('saves and retrieves a chat by friendId', () => {
    saveAtlasChat(MOCK_CHAT)
    expect(getAtlasChatByFriendId('f1')).toEqual(MOCK_CHAT)
  })
  it('updates the existing chat for a friendId instead of duplicating it', () => {
    saveAtlasChat(MOCK_CHAT)
    const updated: AtlasChat = {
      ...MOCK_CHAT,
      messages: [{ id:'m1', role:'user', content:'hi', createdAt:'2026-01-02' }],
    }
    saveAtlasChat(updated)
    expect(getAtlasChats()).toHaveLength(1)
    expect(getAtlasChatByFriendId('f1')?.messages).toHaveLength(1)
  })
  it('deletes a chat by friendId', () => {
    saveAtlasChat(MOCK_CHAT)
    deleteAtlasChat('f1')
    expect(getAtlasChatByFriendId('f1')).toBeUndefined()
  })
})

describe('replace* bulk overwrite functions', () => {
  it('replaceFriends overwrites the entire friends list', () => {
    saveFriend(MOCK_FRIEND)
    replaceFriends([])
    expect(getFriends()).toEqual([])
  })
  it('replaceAtlasList overwrites the entire atlas list', () => {
    saveAtlas(MOCK_ATLAS)
    replaceAtlasList([])
    expect(getAtlasList()).toEqual([])
  })
  it('replaceAtlasChats overwrites the entire chat list', () => {
    saveAtlasChat(MOCK_CHAT)
    replaceAtlasChats([])
    expect(getAtlasChats()).toEqual([])
  })
})
