import { MODEL_MAP, type AIQualityMode } from './provider'
import type { FriendAtlasContext } from './contextBuilder'
import type { Atlas, AtlasChatMessage } from '../types'

export interface TokenEstimate {
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedCostUsd: number
  level: 'low' | 'medium' | 'high' | 'very-high'
}

export const OUTPUT_LIMITS: Record<'atlas' | 'question', Record<AIQualityMode, number>> = {
  atlas:    { economy: 1200, standard: 1600, premium: 2200 },
  question: { economy: 500,  standard: 800,  premium: 1200 },
}

// gpt-5.5 pricing is a placeholder — verify against OpenAI's current published pricing
// before relying on cost estimates in production; OpenAI pricing changes frequently.
const PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
  'gemini-2.5-flash':      { input: 0.30, output: 2.50 },
  'gpt-5.5':                { input: 5.00, output: 15.00 },
}

export function estimateTextTokens(text: string): number {
  const chineseChars = (text.match(/[一-鿿]/g) ?? []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}

function levelFor(costUsd: number): TokenEstimate['level'] {
  if (costUsd < 0.1) return 'low'
  if (costUsd < 0.5) return 'medium'
  if (costUsd < 1) return 'high'
  return 'very-high'
}

function estimate(inputText: string, model: string, outputTokens: number): TokenEstimate {
  const estimatedInputTokens = Math.ceil(estimateTextTokens(inputText) * 1.2)
  const pricing = PRICING_USD_PER_1M[model] ?? { input: 0, output: 0 }
  const estimatedCostUsd =
    (estimatedInputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  return { estimatedInputTokens, estimatedOutputTokens: outputTokens, estimatedCostUsd, level: levelFor(estimatedCostUsd) }
}

export function estimateAtlasGenerationCost(context: FriendAtlasContext, mode: AIQualityMode): TokenEstimate {
  return estimate(JSON.stringify(context), MODEL_MAP[mode].model, OUTPUT_LIMITS.atlas[mode])
}

export function estimateAtlasQuestionCost(input: {
  context: FriendAtlasContext
  atlas?: Atlas
  recentMessages: AtlasChatMessage[]
  question: string
  mode: AIQualityMode
}): TokenEstimate {
  const inputText =
    JSON.stringify(input.context) + JSON.stringify(input.atlas ?? {}) +
    JSON.stringify(input.recentMessages) + input.question
  return estimate(inputText, MODEL_MAP[input.mode].model, OUTPUT_LIMITS.question[input.mode])
}
