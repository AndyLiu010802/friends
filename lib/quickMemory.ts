import type { Memory, MemoryValence, MemoryInitiator } from './types'

export interface ExtractResult {
  title: string
  tags: string[]
  valence?: MemoryValence
  initiator?: MemoryInitiator
}

// 无 AI 时的降级标题:首个句读前的内容截 12 字
export function fallbackTitle(text: string): string {
  const first = text.trim().split(/[。!?！？\n]/)[0] ?? ''
  return first.trim().slice(0, 12) || '随手一记'
}

export function buildQuickMemory(text: string, extract: ExtractResult | null, now: Date): Memory {
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    id: crypto.randomUUID(),
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    title: extract?.title || fallbackTitle(text),
    content: text,
    tags: extract?.tags ?? [],
    media: [],
    valence: extract?.valence,
    initiator: extract?.initiator,
  }
}

export function sortMemoriesDesc(memories: Memory[]): Memory[] {
  return [...memories].sort((a, b) =>
    b.date.localeCompare(a.date) || (b.time ?? '00:00').localeCompare(a.time ?? '00:00'))
}

// 调 AI 提取路由;任何失败(网络/超时/ok:false/字段缺失)返回 null,由调用方走降级
export async function extractMemory(text: string, friendName: string): Promise<ExtractResult | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch('/api/ai/extract-memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, friendName }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    const data = await res.json()
    if (!data.ok || typeof data.title !== 'string' || !Array.isArray(data.tags)) return null
    return { title: data.title, tags: data.tags, valence: data.valence, initiator: data.initiator }
  } catch {
    return null
  }
}
