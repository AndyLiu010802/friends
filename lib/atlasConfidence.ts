import type { Friend } from './types'

export function calculateAtlasConfidence(friend: Friend): {
  score: number
  level: 'low' | 'medium' | 'high'
  reason: string
} {
  const hasRichProfile =
    (friend.notes?.length ?? 0) > 0 && friend.likes.length > 0 && friend.hobbies.length > 0
  const hasSomeProfile =
    (friend.notes?.length ?? 0) > 0 || friend.likes.length > 0 || friend.hobbies.length > 0

  if (friend.memories.length >= 8 && hasRichProfile) {
    return { score: 3, level: 'high', reason: '已有较多回忆、喜好和关系记录，图鉴分析会更贴近真实相处情况。' }
  }
  if (friend.memories.length >= 3 || hasSomeProfile) {
    return { score: 2, level: 'medium', reason: '已有一些回忆和喜好记录，图鉴可以做出较有参考价值的分析。' }
  }
  return { score: 1, level: 'low', reason: '资料还比较少，图鉴只能给出初步印象。' }
}
