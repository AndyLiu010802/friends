import type { Friend } from '../types'
import { selectMemoriesForAtlas } from './selectMemoriesForAtlas'
import { selectRelevantMemoriesForQuestion } from './selectMemoriesForQuestion'
import { calculateAtlasConfidence } from '../atlasConfidence'
import { calculateProfileCompletion } from '../profileCompletion'
import { getGrowthStage } from '../growthStage'
import { calculateFriendEnergy } from '../friendEnergy'

export interface FriendAtlasContext {
  friend: {
    id: string
    name: string
    nickname?: string
    birthday?: string
    zodiac?: string
    mbti?: string
    important: boolean
    notes?: string
    relationshipGoal?: 'maintain' | 'deepen' | 'repair'
  }
  likes: string[]
  dislikes: string[]
  hobbies: string[]
  memories: {
    id: string; date: string; title: string; content: string; tags: string[]
    valence?: 'positive' | 'neutral' | 'negative'
    initiator?: 'me' | 'friend' | 'both'
  }[]
  relationships: { friendId: string; friendName: string; label: string; closeness: 1 | 2 | 3 }[]
  stats: {
    memoryCount: number
    relationshipCount: number
    profileCompletion: number
    growthStage: string
    energyLevel: string
    confidence: 'low' | 'medium' | 'high'
  }
}

export function buildFriendAtlasContext(
  friend: Friend,
  allFriends: Friend[],
  question?: string
): FriendAtlasContext {
  const memories = question
    ? selectRelevantMemoriesForQuestion(friend, question)
    : selectMemoriesForAtlas(friend)

  const confidence = calculateAtlasConfidence(friend)

  return {
    friend: {
      id: friend.id,
      name: friend.name,
      nickname: friend.nickname,
      birthday: friend.birthday,
      zodiac: friend.zodiac,
      mbti: friend.mbti,
      important: friend.important,
      notes: friend.notes,
      relationshipGoal: friend.relationshipGoal,
    },
    likes: friend.likes,
    dislikes: friend.dislikes,
    hobbies: friend.hobbies,
    memories: memories.map(m => ({
      id: m.id, date: m.date, title: m.title, content: m.content, tags: m.tags,
      valence: m.valence, initiator: m.initiator,
    })),
    relationships: friend.relationships.map(r => ({
      friendId: r.friendId,
      friendName: allFriends.find(f => f.id === r.friendId)?.name ?? '（已删除的好友）',
      label: r.label,
      closeness: r.closeness,
    })),
    stats: {
      memoryCount: friend.memories.length,
      relationshipCount: friend.relationships.length,
      profileCompletion: calculateProfileCompletion(friend).percent,
      growthStage: getGrowthStage(friend).stage,
      energyLevel: calculateFriendEnergy(friend).level,
      confidence: confidence.level,
    },
  }
}
