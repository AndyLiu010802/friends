import { callGemini } from './gemini'
import { callOpenAI } from './openai'

export type AIProvider = 'gemini' | 'openai'
export type AIQualityMode = 'economy' | 'standard' | 'premium'

export const MODEL_MAP: Record<AIQualityMode, { provider: AIProvider; model: string }> = {
  economy:  { provider: 'gemini', model: 'gemini-2.5-flash-lite' },
  standard: { provider: 'gemini', model: 'gemini-2.5-flash' },
  premium:  { provider: 'openai', model: 'gpt-5.5' },
}

export interface GenerateOptions {
  model: string
  temperature?: number
  maxOutputTokens: number
}

export async function generateWithAI(
  provider: AIProvider,
  prompt: string,
  options: GenerateOptions
): Promise<string> {
  if (provider === 'gemini') return callGemini(prompt, options.model, options.maxOutputTokens)
  if (provider === 'openai') return callOpenAI(prompt, options.model, options.maxOutputTokens)
  throw new Error(`未知的 AI provider: ${provider}`)
}
