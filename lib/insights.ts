// lib/insights.ts
import type { Friend, Memory } from './types'
import { getBirthdayStatus } from './birthdayStatus'
import { calculateProfileCompletion } from './profileCompletion'
import { isLonelyStar } from './lonelyStar'
import { parseDateOnly, daysBetween } from './dateUtils'

export type FriendInsightType =
  | 'birthday'
  | 'inactive'
  | 'incomplete'
  | 'recent-memory'
  | 'important'
  | 'lonely'
  | 'goal-drift'
  | 'one-sided'

export interface FriendInsight {
  id: string
  type: FriendInsightType
  friendId: string
  friendName: string
  text: string
  priority: 1 | 2 | 3
  fingerprint: string   // 触发条件的状态指纹:状态变化后同 id 信号重新出现
  dismissible: boolean  // 生日当天为 false
}

function latestMemoryOf(friend: Friend): Memory | undefined {
  return [...friend.memories].sort((a, b) => b.date.localeCompare(a.date))[0]
}

function daysSinceLatestMemory(friend: Friend, now: Date): number | null {
  const latest = latestMemoryOf(friend)
  if (!latest) return null
  const date = parseDateOnly(latest.date)
  if (!date) return null
  return daysBetween(date, now)
}

export function generateFriendInsights(friends: Friend[], now: Date = new Date()): FriendInsight[] {
  const insights: FriendInsight[] = []

  for (const friend of friends) {
    const latest = latestMemoryOf(friend)
    const latestFp = latest?.date ?? 'none'

    const birthday = getBirthdayStatus(friend.birthday, now)
    if (birthday.isWithin14 && birthday.daysUntil !== null && birthday.nextBirthdayISO) {
      const tier = birthday.isToday ? 'today' : birthday.daysUntil <= 7 ? 'soon' : 'later'
      insights.push({
        id: `${friend.id}-birthday`, type: 'birthday', friendId: friend.id, friendName: friend.name,
        text: birthday.isToday
          ? `今天是${friend.name}生日 🎂`
          : `${birthday.daysUntil} 天后是${friend.name}生日`,
        priority: tier === 'later' ? 2 : 3,
        fingerprint: `${birthday.nextBirthdayISO}-${tier}`,
        dismissible: !birthday.isToday,
      })
    }

    const memoryAge = daysSinceLatestMemory(friend, now)
    if (memoryAge !== null) {
      if (memoryAge > 60) {
        insights.push({
          id: `${friend.id}-inactive`, type: 'inactive', friendId: friend.id, friendName: friend.name,
          text: `你已经 ${memoryAge} 天没有更新${friend.name}的记录`, priority: 2,
          fingerprint: latestFp, dismissible: true,
        })
      }
      if (memoryAge <= 7) {
        insights.push({
          id: `${friend.id}-recent-memory`, type: 'recent-memory', friendId: friend.id, friendName: friend.name,
          text: `最近新增了关于${friend.name}的回忆`, priority: 2,
          fingerprint: latestFp, dismissible: true,
        })
      }
    } else {
      const createdDays = daysBetween(new Date(friend.createdAt), now)
      if (createdDays > 14) {
        insights.push({
          id: `${friend.id}-inactive`, type: 'inactive', friendId: friend.id, friendName: friend.name,
          text: `${friend.name}还没有任何回忆记录`, priority: 1,
          fingerprint: 'none', dismissible: true,
        })
      }
    }

    const completion = calculateProfileCompletion(friend)
    if (completion.percent < 50) {
      insights.push({
        id: `${friend.id}-incomplete`, type: 'incomplete', friendId: friend.id, friendName: friend.name,
        text: `${friend.name}的档案还很空，可以补充：${completion.missing.slice(0, 2).join('、')}`, priority: 1,
        fingerprint: String(Math.floor(completion.percent / 10) * 10), dismissible: true,
      })
    }

    if (friend.important && (memoryAge === null || memoryAge > 30)) {
      insights.push({
        id: `${friend.id}-important`, type: 'important', friendId: friend.id, friendName: friend.name,
        text: `重要朋友${friend.name}最近还没有新记录`, priority: 2,
        fingerprint: latestFp, dismissible: true,
      })
    }

    if (isLonelyStar(friend)) {
      insights.push({
        id: `${friend.id}-lonely`, type: 'lonely', friendId: friend.id, friendName: friend.name,
        text: `${friend.name}还是一颗孤星，可以添加回忆或连接朋友`, priority: 1,
        fingerprint: latestFp, dismissible: true,
      })
    }

    // 关系目标偏离:同一好友只会命中其一(goal 是单值)
    if (friend.relationshipGoal === 'deepen' && (memoryAge === null || memoryAge > 30)) {
      insights.push({
        id: `${friend.id}-goal-drift`, type: 'goal-drift', friendId: friend.id, friendName: friend.name,
        text: `你想和${friend.name}更近一步，最近却安静了`, priority: 2,
        fingerprint: latestFp, dismissible: true,
      })
    } else if (friend.relationshipGoal === 'repair' && latest?.valence === 'negative') {
      insights.push({
        id: `${friend.id}-goal-drift`, type: 'goal-drift', friendId: friend.id, friendName: friend.name,
        text: `修复中的关系，最近一次互动不太顺，也许该缓和一下`, priority: 3,
        fingerprint: latest.id, dismissible: true,
      })
    }

    // 单向发起:最近 5 条带 initiator 的记录全是 me
    const withInitiator = [...friend.memories]
      .filter(m => m.initiator)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
    if (withInitiator.length === 5 && withInitiator.every(m => m.initiator === 'me')) {
      insights.push({
        id: `${friend.id}-one-sided`, type: 'one-sided', friendId: friend.id, friendName: friend.name,
        text: `最近都是你主动找${friend.name}，留意一下平衡`, priority: 2,
        fingerprint: withInitiator.map(m => m.id).join(','), dismissible: true,
      })
    }
  }

  // 不在生成层截断:展示上限(8 条)由页面在过滤掉已忽略信号之后应用,
  // 这样「知道了」某条后,排在后面的信号才能真正补位。
  return insights.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority
    if (a.type === 'birthday' && b.type !== 'birthday') return -1
    if (b.type === 'birthday' && a.type !== 'birthday') return 1
    return 0
  })
}

// 展示上限:在 filterDismissed 之后调用
export const INSIGHT_DISPLAY_CAP = 8
