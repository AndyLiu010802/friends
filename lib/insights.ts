// lib/insights.ts
import type { Friend } from './types'
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

export interface FriendInsight {
  id: string
  type: FriendInsightType
  friendId: string
  friendName: string
  text: string
  priority: 1 | 2 | 3
}

function latestMemoryOf(friend: Friend) {
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
    const birthday = getBirthdayStatus(friend.birthday, now)
    if (birthday.isToday) {
      insights.push({
        id: `${friend.id}-birthday`, type: 'birthday', friendId: friend.id, friendName: friend.name,
        text: `今天是${friend.name}生日 🎂`, priority: 3,
      })
    } else if (birthday.isSoon && birthday.daysUntil !== null) {
      insights.push({
        id: `${friend.id}-birthday`, type: 'birthday', friendId: friend.id, friendName: friend.name,
        text: `${birthday.daysUntil} 天后是${friend.name}生日`, priority: 3,
      })
    }

    const memoryAge = daysSinceLatestMemory(friend, now)
    if (memoryAge !== null) {
      if (memoryAge > 60) {
        insights.push({
          id: `${friend.id}-inactive`, type: 'inactive', friendId: friend.id, friendName: friend.name,
          text: `你已经 ${memoryAge} 天没有更新${friend.name}的记录`, priority: 2,
        })
      }
      if (memoryAge <= 7) {
        insights.push({
          id: `${friend.id}-recent-memory`, type: 'recent-memory', friendId: friend.id, friendName: friend.name,
          text: `最近新增了关于${friend.name}的回忆`, priority: 2,
        })
      }
    } else {
      const createdDays = daysBetween(new Date(friend.createdAt), now)
      if (createdDays > 14) {
        insights.push({
          id: `${friend.id}-inactive`, type: 'inactive', friendId: friend.id, friendName: friend.name,
          text: `${friend.name}还没有任何回忆记录`, priority: 1,
        })
      }
    }

    const completion = calculateProfileCompletion(friend)
    if (completion.percent < 50) {
      insights.push({
        id: `${friend.id}-incomplete`, type: 'incomplete', friendId: friend.id, friendName: friend.name,
        text: `${friend.name}的档案还很空，可以补充：${completion.missing.slice(0, 2).join('、')}`, priority: 1,
      })
    }

    if (friend.important && (memoryAge === null || memoryAge > 30)) {
      insights.push({
        id: `${friend.id}-important`, type: 'important', friendId: friend.id, friendName: friend.name,
        text: `重要朋友${friend.name}最近还没有新记录`, priority: 2,
      })
    }

    if (isLonelyStar(friend)) {
      insights.push({
        id: `${friend.id}-lonely`, type: 'lonely', friendId: friend.id, friendName: friend.name,
        text: `${friend.name}还是一颗孤星，可以添加回忆或连接朋友`, priority: 1,
      })
    }
  }

  return insights
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority
      if (a.type === 'birthday' && b.type !== 'birthday') return -1
      if (b.type === 'birthday' && a.type !== 'birthday') return 1
      return 0
    })
    .slice(0, 5)
}
