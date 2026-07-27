import type { Friend } from './types'

export type EnergyLevel = 'low' | 'medium' | 'high' | 'legendary'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function isWithin30Days(dateStr: string, now: Date): boolean {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return false
  const diff = now.getTime() - date.getTime()
  return diff >= 0 && diff <= THIRTY_DAYS_MS
}

export function calculateFriendEnergy(
  friend: Friend,
  now: Date = new Date(),
): {
  score: number
  level: EnergyLevel
  lastActivityText: string
} {
  let score = 0

  for (const memory of friend.memories) {
    score += 1
    if (memory.media.length > 0) score += 2
    if (memory.content.length > 50) score += 1
  }

  for (const rel of friend.relationships) {
    score += rel.closeness
  }

  const latestMemory = [...friend.memories].sort((a, b) => b.date.localeCompare(a.date))[0]
  const recencyDate = latestMemory ? latestMemory.date : friend.updatedAt
  if (isWithin30Days(recencyDate, now)) score += 3

  const level: EnergyLevel =
    score >= 13 ? 'legendary' :
    score >= 7  ? 'high' :
    score >= 3  ? 'medium' : 'low'

  const lastActivityText = latestMemory
    ? `最近一次记录：${latestMemory.date}`
    : '还没有记录'

  return { score, level, lastActivityText }
}
