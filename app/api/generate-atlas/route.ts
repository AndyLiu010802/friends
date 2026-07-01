import { NextRequest, NextResponse } from 'next/server'
import type { Friend, Atlas } from '@/lib/types'

export async function POST(req: NextRequest) {
  const friend: Friend = await req.json()

  // Stub — replace with Claude API call in next phase
  const atlas: Atlas = {
    id:          crypto.randomUUID(),
    friendId:    friend.id,
    generatedAt: new Date().toISOString(),
    summary:     `${friend.name}是一个${friend.zodiac}的${friend.mbti}，个性独特，值得深交。`,
    personality: `作为${friend.mbti}类型，${friend.name}在人际关系中展现出独特的魅力...`,
    predictions: `根据${friend.name}的星座特征和性格类型，预计在艺术、创意领域有较强共鸣。`,
    giftIdeas:   ['手工制品', '独特体验', '个性化定制礼物'],
    warnings:    ['需要给予足够的个人空间', '避免在公开场合批评'],
    rawInput:    { id:friend.id, name:friend.name, mbti:friend.mbti, zodiac:friend.zodiac, likes:friend.likes },
  }

  return NextResponse.json(atlas)
}
