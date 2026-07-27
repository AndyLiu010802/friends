import type { Friend } from './types'

export interface ConfidenceDimensions {
  quantity: boolean        // ≥8 条回忆且喜好/备注/爱好齐全
  recency: boolean         // 最近 60 天内有记录
  diversity: boolean       // ≥3 种不同标签
  valenceCoverage: boolean // 记录里出现 ≥2 种不同情绪效价
  timeSpan: boolean        // 记录时间跨度 ≥90 天
}

const DAY_MS = 24 * 60 * 60 * 1000

const GAP_LABELS: [keyof Omit<ConfidenceDimensions, 'quantity'>, string][] = [
  ['recency', '最近 60 天没有新记录'],
  ['diversity', '记录的话题种类还比较少'],
  ['valenceCoverage', '记录的情绪比较单一，可以补充一些不同心情的互动'],
  ['timeSpan', '记录的时间跨度还比较短'],
]

export function calculateAtlasConfidence(friend: Friend, now: Date = new Date()): {
  score: number
  level: 'low' | 'medium' | 'high'
  reason: string
  dimensions: ConfidenceDimensions
} {
  const hasRichProfile =
    (friend.notes?.length ?? 0) > 0 && friend.likes.length > 0 && friend.hobbies.length > 0
  const hasSomeProfile =
    (friend.notes?.length ?? 0) > 0 || friend.likes.length > 0 || friend.hobbies.length > 0

  const dates = friend.memories
    .map(m => new Date(m.date).getTime())
    .filter(t => !Number.isNaN(t))
  const newest = dates.length ? Math.max(...dates) : undefined
  const oldest = dates.length ? Math.min(...dates) : undefined

  const dimensions: ConfidenceDimensions = {
    quantity: friend.memories.length >= 8 && hasRichProfile,
    recency: newest !== undefined
      && now.getTime() - newest >= 0 && now.getTime() - newest <= 60 * DAY_MS,
    diversity: new Set(friend.memories.flatMap(m => m.tags)).size >= 3,
    valenceCoverage: new Set(friend.memories.map(m => m.valence).filter(Boolean)).size >= 2,
    timeSpan: newest !== undefined && oldest !== undefined && newest - oldest >= 90 * DAY_MS,
  }

  const extras = [dimensions.diversity, dimensions.valenceCoverage, dimensions.timeSpan]
    .filter(Boolean).length

  if (dimensions.quantity && dimensions.recency && extras >= 2) {
    return {
      score: 3, level: 'high', dimensions,
      reason: '回忆数量、时间跨度和情绪覆盖都比较完整，图鉴分析会更贴近真实相处情况。',
    }
  }

  if (friend.memories.length >= 3 || hasSomeProfile) {
    const gaps = GAP_LABELS.filter(([key]) => !dimensions[key]).map(([, label]) => label)
    const reason = dimensions.quantity && gaps.length > 0
      ? `已有较多记录，但${gaps.join('；')}，这部分判断会偏保守。`
      : '已有一些回忆和喜好记录，图鉴可以做出较有参考价值的分析。'
    return { score: 2, level: 'medium', reason, dimensions }
  }

  return { score: 1, level: 'low', dimensions, reason: '资料还比较少，图鉴只能给出初步印象。' }
}
