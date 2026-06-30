import type { Friend, Atlas } from './types'

const FRIENDS_KEY = 'yj_friends'
const ATLAS_KEY   = 'yj_atlas'

export function getFriends(): Friend[] {
  try {
    return JSON.parse(localStorage.getItem(FRIENDS_KEY) ?? '[]')
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
