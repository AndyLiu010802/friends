// Server-only — OPENAI_API_KEY must never reach the client. Only import this from
// API routes, never from a client component.
import OpenAI from 'openai'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('缺少 OPENAI_API_KEY，请在 .env.local 中配置。')
  }
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

export async function callOpenAI(prompt: string, model: string, maxOutputTokens: number): Promise<string> {
  const response = await getClient().chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: maxOutputTokens,
  })
  return response.choices[0]?.message?.content ?? ''
}
