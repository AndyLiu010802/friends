import type { Friend } from './types'
import { parseDateOnly } from './dateUtils'

export type MatchField = 'name' | 'nickname' | 'like' | 'dislike' | 'hobby' | 'tag'

export interface SearchResult {
  friend: Friend
  matchField?: MatchField
  matchText?: string
}

// 最近互动日期(YYYY-MM-DD):最新 memory.date,无回忆则取 updatedAt 的日期部分
export function lastInteractionDate(friend: Friend): string {
  const dates = friend.memories.map(m => m.date).filter(d => parseDateOnly(d) !== null)
  if (dates.length === 0) return friend.updatedAt.slice(0, 10)
  return dates.reduce((a, b) => (b > a ? b : a))
}

export function searchFriends(friends: Friend[], query: string): SearchResult[] {
  const q = query.trim().toLowerCase()
  const byRecency = (a: Friend, b: Friend) =>
    lastInteractionDate(b).localeCompare(lastInteractionDate(a))

  if (!q) {
    return [...friends]
      .sort((a, b) => Number(b.important) - Number(a.important) || byRecency(a, b))
      .map(friend => ({ friend }))
  }

  return friends
    .map(friend => matchFriend(friend, q))
    .filter((m): m is { rank: number; result: SearchResult } => m !== null)
    .sort((a, b) => a.rank - b.rank || byRecency(a.result.friend, b.result.friend))
    .map(m => m.result)
}

// 优先级:名字前缀(0) > 名字包含(1) > 昵称(2) > 喜好/雷区/爱好(3) > 回忆标签(4)
function matchFriend(friend: Friend, q: string): { rank: number; result: SearchResult } | null {
  const name = friend.name.toLowerCase()
  if (name.startsWith(q)) return { rank: 0, result: { friend, matchField: 'name', matchText: friend.name } }
  if (name.includes(q)) return { rank: 1, result: { friend, matchField: 'name', matchText: friend.name } }

  const nickname = friend.nickname
  if (nickname && nickname.toLowerCase().includes(q))
    return { rank: 2, result: { friend, matchField: 'nickname', matchText: nickname } }

  const listFields: [MatchField, string[]][] = [
    ['like', friend.likes], ['dislike', friend.dislikes], ['hobby', friend.hobbies],
  ]
  for (const [field, values] of listFields) {
    const hit = values.find(v => v.toLowerCase().includes(q))
    if (hit) return { rank: 3, result: { friend, matchField: field, matchText: hit } }
  }

  const tags = [...new Set(friend.memories.flatMap(m => m.tags))]
  const tagHit = tags.find(t => t.toLowerCase().includes(q))
  if (tagHit) return { rank: 4, result: { friend, matchField: 'tag', matchText: tagHit } }

  return null
}
