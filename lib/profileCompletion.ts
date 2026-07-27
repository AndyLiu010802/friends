import type { Friend } from './types'

const WEIGHTS = {
  birthday: 15,
  mbti: 10,
  likes: 15,
  dislikes: 10,
  hobbies: 10,
  notes: 10,
  memory: 20,
  photo: 10,
} as const

const LABELS: Record<keyof typeof WEIGHTS, string> = {
  birthday: '生日',
  mbti: 'MBTI',
  likes: '喜欢的东西',
  dislikes: '讨厌的东西',
  hobbies: '兴趣爱好',
  notes: '备注',
  memory: '至少一条回忆',
  photo: '至少一张照片',
}

export function calculateProfileCompletion(friend: Friend): {
  percent: number
  missing: string[]
} {
  const hasPhoto = friend.portraits.some(m => m.type === 'photo')
    || friend.memories.some(memory => memory.media.some(m => m.type === 'photo'))

  const checks: Record<keyof typeof WEIGHTS, boolean> = {
    birthday: Boolean(friend.birthday),
    mbti: Boolean(friend.mbti),
    likes: friend.likes.length > 0,
    dislikes: friend.dislikes.length > 0,
    hobbies: friend.hobbies.length > 0,
    notes: Boolean(friend.notes),
    memory: friend.memories.length > 0,
    photo: hasPhoto,
  }

  let percent = 0
  const missing: string[] = []
  for (const key of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
    if (checks[key]) percent += WEIGHTS[key]
    else missing.push(LABELS[key])
  }

  return { percent, missing }
}
