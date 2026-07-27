import type { Friend } from './types'

export function getFriendTags(friend: Friend): string[] {
  const tags = new Set<string>()

  friend.hobbies.forEach(t => tags.add(t))
  friend.likes.forEach(t => tags.add(t))
  friend.memories.forEach(memory => {
    memory.tags.forEach(t => tags.add(t))
  })

  return [...tags].filter(Boolean)
}

export function getSharedTags(friendA: Friend, friendB: Friend): string[] {
  const a = new Set(getFriendTags(friendA))
  return getFriendTags(friendB).filter(tag => a.has(tag))
}
