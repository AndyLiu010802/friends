// Server-only — OPENAI_API_KEY must never reach the client. Only import this from
// API routes, never from a client component.
import { callOpenAI } from './openai'

export const MODEL = 'gpt-5.5'

export interface GenerateOptions {
  model: string
  temperature?: number
  maxOutputTokens: number
}

export async function generateWithAI(prompt: string, options: GenerateOptions): Promise<string> {
  return callOpenAI(prompt, options.model, options.maxOutputTokens)
}
