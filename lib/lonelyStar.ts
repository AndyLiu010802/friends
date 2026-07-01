import type { Friend } from './types'

export function isLonelyStar(friend: Friend): boolean {
  return friend.memories.length === 0 && friend.relationships.length === 0
}
