import { NextRequest, NextResponse } from 'next/server'
import type { FriendAtlasContext } from '@/lib/ai/contextBuilder'
import type { AIQualityMode } from '@/lib/ai/provider'
import { MODEL_MAP, generateWithAI } from '@/lib/ai/provider'
import { buildAtlasPrompt } from '@/lib/ai/prompts'
import { safeParseAIJson } from '@/lib/ai/json'
import { OUTPUT_LIMITS } from '@/lib/ai/tokenEstimate'
import type { Atlas } from '@/lib/types'

interface GenerateAtlasRequest {
  context: FriendAtlasContext
  mode: AIQualityMode
}

interface AtlasAIOutput {
  summary: string
  roleInMyLife: string
  keyDetailsToRemember: string[]
  recentInteractionInsight: string
  conversationTopics: string[]
  giftIdeas: string[]
  warnings: string[]
  suitableActivities: string[]
  relationshipTrend: string
  evidence: Atlas['evidence']
}

export async function POST(req: NextRequest) {
  const { context, mode }: GenerateAtlasRequest = await req.json()
  const { provider, model } = MODEL_MAP[mode]

  let text: string
  try {
    text = await generateWithAI(provider, buildAtlasPrompt(context), {
      model,
      maxOutputTokens: OUTPUT_LIMITS.atlas[mode],
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'AI 暂时没有回应，请稍后再试。' },
      { status: 502 }
    )
  }

  const parsed = safeParseAIJson<AtlasAIOutput>(text)
  if (!parsed.ok || !parsed.data) {
    return NextResponse.json({ ok: false, raw: parsed.raw, error: 'AI 返回格式不完整，已尝试使用文本结果展示。' })
  }

  const atlas: Atlas = {
    id: crypto.randomUUID(),
    friendId: context.friend.id,
    generatedAt: new Date().toISOString(),
    model,
    recordStats: {
      memoryCount: context.stats.memoryCount,
      relationshipCount: context.stats.relationshipCount,
      likesCount: context.likes.length,
      dislikesCount: context.dislikes.length,
      hobbiesCount: context.hobbies.length,
      noteLength: context.friend.notes?.length ?? 0,
      confidence: context.stats.confidence,
    },
    summary: parsed.data.summary,
    roleInMyLife: parsed.data.roleInMyLife,
    keyDetailsToRemember: parsed.data.keyDetailsToRemember,
    recentInteractionInsight: parsed.data.recentInteractionInsight,
    conversationTopics: parsed.data.conversationTopics,
    giftIdeas: parsed.data.giftIdeas,
    warnings: parsed.data.warnings,
    suitableActivities: parsed.data.suitableActivities,
    relationshipTrend: parsed.data.relationshipTrend,
    evidence: parsed.data.evidence ?? [],
    rawInput: {},
  }

  return NextResponse.json({ ok: true, atlas })
}
