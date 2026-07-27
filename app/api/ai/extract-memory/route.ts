import { NextRequest, NextResponse } from 'next/server'
import { MODEL, generateWithAI } from '@/lib/ai/provider'
import { buildExtractMemoryPrompt } from '@/lib/ai/prompts'
import { safeParseAIJson } from '@/lib/ai/json'
import { OUTPUT_LIMITS } from '@/lib/ai/tokenEstimate'
import { isAuthorized } from '@/lib/auth/verifyRequest'

interface ExtractAIOutput { title?: string; tags?: unknown; valence?: string; initiator?: string }

const VALENCES = new Set(['positive', 'neutral', 'negative'])
const INITIATORS = new Set(['me', 'friend', 'both'])

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ ok: false, error: '未登录，请先登录。' }, { status: 401 })
  }

  let text: unknown, friendName: unknown
  try {
    const body = await req.json()
    text = body.text
    friendName = body.friendName
  } catch {
    return NextResponse.json({ ok: false, error: '请求格式不正确。' }, { status: 400 })
  }
  if (typeof text !== 'string' || !text.trim() || typeof friendName !== 'string') {
    return NextResponse.json({ ok: false, error: '请求参数不完整。' }, { status: 400 })
  }

  // 提取失败一律 ok:false + 200:客户端统一走降级,不区分失败原因
  let raw: string
  try {
    raw = await generateWithAI(buildExtractMemoryPrompt({ text, friendName }), {
      model: MODEL, maxOutputTokens: OUTPUT_LIMITS.extract,
    })
  } catch {
    return NextResponse.json({ ok: false })
  }

  const parsed = safeParseAIJson<ExtractAIOutput>(raw)
  const d = parsed.data
  if (!parsed.ok || !d || typeof d.title !== 'string' || !d.title.trim()) {
    return NextResponse.json({ ok: false })
  }

  return NextResponse.json({
    ok: true,
    title: d.title.replace(/\s+/g, ' ').trim().slice(0, 20),
    tags: Array.isArray(d.tags)
      ? d.tags.filter((t): t is string => typeof t === 'string').map(t => t.trim()).filter(Boolean).slice(0, 3)
      : [],
    valence: d.valence && VALENCES.has(d.valence) ? d.valence : undefined,
    initiator: d.initiator && INITIATORS.has(d.initiator) ? d.initiator : undefined,
  })
}
