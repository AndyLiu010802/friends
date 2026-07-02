export function safeParseAIJson<T>(text: string): {
  ok: boolean
  data?: T
  raw: string
  error?: string
} {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text

  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  const jsonSlice = start !== -1 && end !== -1 && end > start ? candidate.slice(start, end + 1) : candidate

  try {
    const data = JSON.parse(jsonSlice) as T
    return { ok: true, data, raw: text }
  } catch (err) {
    return { ok: false, raw: text, error: err instanceof Error ? err.message : String(err) }
  }
}
