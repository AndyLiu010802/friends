// Server-only — GEMINI_API_KEY must never reach the client. Only import this from
// API routes, never from a client component.
import { GoogleGenAI } from '@google/genai'

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('缺少 GEMINI_API_KEY，请在 .env.local 中配置。')
  }
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  return client
}

export async function callGemini(prompt: string, model: string, maxOutputTokens: number): Promise<string> {
  const response = await getClient().models.generateContent({
    model,
    contents: prompt,
    config: { maxOutputTokens },
  })
  return response.text ?? ''
}
