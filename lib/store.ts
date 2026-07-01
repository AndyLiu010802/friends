import type { Friend, Atlas, AtlasChat, StarConfig } from './types'

const FRIENDS_KEY    = 'yj_friends'
const ATLAS_KEY       = 'yj_atlas'
const ATLAS_CHAT_KEY = 'yj_atlas_chats'

const DEFAULT_STAR_CONFIG: StarConfig = {
  kind: 'nebula', coreColor: '#94a3b8', glowColor: '#cbd5e1',
  size: 1, twinkleSpeed: 2.4, position: [0, 0, 0],
}

function normalizeFriend(friend: Partial<Friend>): Friend {
  return {
    id: friend.id ?? crypto.randomUUID(),
    name: friend.name ?? '未命名好友',
    nickname: friend.nickname,
    birthday: friend.birthday,
    zodiac: friend.zodiac,
    mbti: friend.mbti,
    important: friend.important ?? false,
    likes: friend.likes ?? [],
    dislikes: friend.dislikes ?? [],
    hobbies: friend.hobbies ?? [],
    portraits: friend.portraits ?? [],
    memories: friend.memories ?? [],
    relationships: friend.relationships ?? [],
    notes: friend.notes,
    starConfig: friend.starConfig ?? DEFAULT_STAR_CONFIG,
    atlasId: friend.atlasId,
    createdAt: friend.createdAt ?? new Date().toISOString(),
    updatedAt: friend.updatedAt ?? new Date().toISOString(),
  }
}

export function getFriends(): Friend[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FRIENDS_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.map(normalizeFriend)
  } catch { return [] }
}

export function saveFriend(friend: Friend): void {
  const list = getFriends()
  const idx  = list.findIndex(f => f.id === friend.id)
  if (idx >= 0) list[idx] = friend
  else list.push(friend)
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(list))
}

export function deleteFriend(id: string): void {
  const list = getFriends().filter(f => f.id !== id)
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(list))
}

export function getAtlasList(): Atlas[] {
  try {
    return JSON.parse(localStorage.getItem(ATLAS_KEY) ?? '[]')
  } catch { return [] }
}

export function saveAtlas(atlas: Atlas): void {
  const list = getAtlasList()
  const idx  = list.findIndex(a => a.id === atlas.id)
  if (idx >= 0) list[idx] = atlas
  else list.push(atlas)
  localStorage.setItem(ATLAS_KEY, JSON.stringify(list))
}

export function getAtlasByFriendId(friendId: string): Atlas | undefined {
  return getAtlasList().find(a => a.friendId === friendId)
}

export function deleteAtlas(friendId: string): void {
  const list = getAtlasList().filter(a => a.friendId !== friendId)
  localStorage.setItem(ATLAS_KEY, JSON.stringify(list))
}

export function getAtlasChats(): AtlasChat[] {
  try {
    return JSON.parse(localStorage.getItem(ATLAS_CHAT_KEY) ?? '[]')
  } catch { return [] }
}

export function getAtlasChatByFriendId(friendId: string): AtlasChat | undefined {
  return getAtlasChats().find(c => c.friendId === friendId)
}

export function saveAtlasChat(chat: AtlasChat): void {
  const list = getAtlasChats()
  const idx  = list.findIndex(c => c.friendId === chat.friendId)
  if (idx >= 0) list[idx] = chat
  else list.push(chat)
  localStorage.setItem(ATLAS_CHAT_KEY, JSON.stringify(list))
}

export function deleteAtlasChat(friendId: string): void {
  const list = getAtlasChats().filter(c => c.friendId !== friendId)
  localStorage.setItem(ATLAS_CHAT_KEY, JSON.stringify(list))
}

export function replaceFriends(friends: Friend[]): void {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends))
}

export function replaceAtlasList(atlasList: Atlas[]): void {
  localStorage.setItem(ATLAS_KEY, JSON.stringify(atlasList))
}

export function replaceAtlasChats(chats: AtlasChat[]): void {
  localStorage.setItem(ATLAS_CHAT_KEY, JSON.stringify(chats))
}
