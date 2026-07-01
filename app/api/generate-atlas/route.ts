import { NextRequest, NextResponse } from 'next/server'
import type { Friend, Atlas } from '@/lib/types'

export async function POST(req: NextRequest) {
  const friend: Friend = await req.json()

  const traits = [friend.zodiac, friend.mbti].filter(Boolean).join('的')
  const summary = traits
    ? `${friend.name}是一个${traits}，个性独特，值得深交。`
    : `${friend.name}的故事还在慢慢展开，个性独特，值得深交。`

  // Stub — replaced by app/api/ai/generate-atlas/route.ts in Task 17
  const atlas: Atlas = {
    id: crypto.randomUUID(),
    friendId: friend.id,
    generatedAt: new Date().toISOString(),
    model: 'stub',
    recordStats: {
      memoryCount: friend.memories.length,
      relationshipCount: friend.relationships.length,
      likesCount: friend.likes.length,
      dislikesCount: friend.dislikes.length,
      hobbiesCount: friend.hobbies.length,
      noteLength: friend.notes?.length ?? 0,
      confidence: 'low',
    },
    summary,
    roleInMyLife: `${friend.name}在你的生活中占据一席之地。`,
    keyDetailsToRemember: [],
    recentInteractionInsight: '暂无足够记录。',
    conversationTopics: [],
    giftIdeas: ['手工制品', '独特体验', '个性化定制礼物'],
    warnings: ['需要给予足够的个人空间', '避免在公开场合批评'],
    suitableActivities: [],
    relationshipTrend: '资料不足，暂无法判断趋势。',
    evidence: [],
    rawInput: { id: friend.id, name: friend.name, mbti: friend.mbti, zodiac: friend.zodiac, likes: friend.likes },
  }

  return NextResponse.json(atlas)
}
