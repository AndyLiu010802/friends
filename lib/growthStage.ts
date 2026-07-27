import type { Friend } from './types'

export type GrowthStage = 'dust' | 'young' | 'bright' | 'stellar' | 'constellation-core'

const STAGE_LABEL: Record<GrowthStage, string> = {
  dust: '星尘',
  young: '幼星',
  bright: '亮星',
  stellar: '恒星',
  'constellation-core': '星座核心',
}

export function getGrowthStage(friend: Friend): {
  stage: GrowthStage
  label: string
  nextHint: string
} {
  const hasRelationships = friend.relationships.length > 0
  const memoryCount = friend.memories.length
  const hasPersonalityInfo = Boolean(friend.mbti) || friend.likes.length > 0 || friend.hobbies.length > 0
  const hasBasicInfo = Boolean(friend.birthday) || Boolean(friend.notes)

  let stage: GrowthStage
  if (hasRelationships && memoryCount >= 3) stage = 'constellation-core'
  else if (memoryCount >= 3) stage = 'stellar'
  else if (hasPersonalityInfo) stage = 'bright'
  else if (hasBasicInfo) stage = 'young'
  else stage = 'dust'

  let nextHint: string
  switch (stage) {
    case 'dust': nextHint = '填写生日或备注即可成长为幼星'; break
    case 'young': nextHint = '填写 MBTI、喜欢或兴趣爱好即可成长为亮星'; break
    case 'bright': nextHint = `还差 ${Math.max(3 - memoryCount, 0)} 条回忆即可成长为恒星`; break
    case 'stellar': nextHint = '添加共同好友即可成长为星座核心'; break
    case 'constellation-core': nextHint = '已经是最高阶段'; break
  }

  return { stage, label: STAGE_LABEL[stage], nextHint }
}
