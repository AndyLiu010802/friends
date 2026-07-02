import { NextRequest, NextResponse } from 'next/server'
import type { FriendAtlasContext } from '@/lib/ai/contextBuilder'
import type { AIQualityMode } from '@/lib/ai/provider'
import { MODEL_MAP, generateWithAI } from '@/lib/ai/provider'
import { buildAtlasQuestionPrompt } from '@/lib/ai/prompts'
import { safeParseAIJson } from '@/lib/ai/json'
import { OUTPUT_LIMITS } from '@/lib/ai/tokenEstimate'
import type { Atlas, AtlasChatMessage, AtlasEvidence } from '@/lib/types'

interface AskAtlasRequest {
  context: FriendAtlasContext
  atlas?: Atlas
  messages: AtlasChatMessage[]
  question: string
  mode: AIQualityMode
}

interface AskAtlasAIOutput {
  answer: string
  evidence: AtlasEvidence[]
  suggestedFollowUps: string[]
}

export async function POST(req: NextRequest) {
  let context: FriendAtlasContext
  let atlas: Atlas | undefined
  let messages: AtlasChatMessage[]
  let question: string
  let mode: AIQualityMode
  try {
    const body: AskAtlasRequest = await req.json()
    context = body.context
    atlas = body.atlas
    messages = body.messages
    question = body.question
    mode = body.mode
  } catch {
    return NextResponse.json({ ok: false, error: '请求格式不正确。' }, { status: 400 })
  }

  if (!context || !question || !mode || !(mode in MODEL_MAP) || !Array.isArray(messages)) {
    return NextResponse.json({ ok: false, error: '请求参数不完整。' }, { status: 400 })
  }

  const { provider, model } = MODEL_MAP[mode]
  const recentMessages = messages.slice(-8)

  let text: string
  try {
    text = await generateWithAI(
      provider,
      buildAtlasQuestionPrompt({ context, atlas, recentMessages, question }),
      { model, maxOutputTokens: OUTPUT_LIMITS.question[mode] }
    )
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'AI 暂时没有回应，请稍后再试。' },
      { status: 502 }
    )
  }

  const parsed = safeParseAIJson<AskAtlasAIOutput>(text)
  if (!parsed.ok || !parsed.data) {
    return NextResponse.json({ ok: false, raw: parsed.raw, error: 'AI 返回格式不完整，已尝试使用文本结果展示。' })
  }

  return NextResponse.json({
    ok: true,
    answer: parsed.data.answer,
    evidence: parsed.data.evidence ?? [],
    suggestedFollowUps: parsed.data.suggestedFollowUps ?? [],
  })
}
