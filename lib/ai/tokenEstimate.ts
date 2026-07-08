import type { FriendAtlasContext } from './contextBuilder'
import type { Atlas, AtlasChatMessage } from '../types'

export interface TokenEstimate {
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedCostUsd: number
  level: 'low' | 'medium' | 'high' | 'very-high'
}

export const OUTPUT_LIMITS = {
  atlas: 2600,
  question: 1200,
}

// gpt-5.5 pricing is a placeholder — verify against OpenAI's current published pricing
// before relying on cost estimates in production; OpenAI pricing changes frequently.
const PRICING_USD_PER_1M = { input: 5.00, output: 15.00 }

export function estimateTextTokens(text: string): number {
  const chineseChars = (text.match(/[一-鿿，。！？、；：""''（）《》【】]/g) ?? []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}

function levelFor(costUsd: number): TokenEstimate['level'] {
  if (costUsd < 0.1) return 'low'
  if (costUsd < 0.5) return 'medium'
  if (costUsd < 1) return 'high'
  return 'very-high'
}

function estimate(inputText: string, outputTokens: number): TokenEstimate {
  const estimatedInputTokens = Math.ceil(estimateTextTokens(inputText) * 1.2)
  const estimatedCostUsd =
    (estimatedInputTokens / 1_000_000) * PRICING_USD_PER_1M.input +
    (outputTokens / 1_000_000) * PRICING_USD_PER_1M.output
  return { estimatedInputTokens, estimatedOutputTokens: outputTokens, estimatedCostUsd, level: levelFor(estimatedCostUsd) }
}

export function estimateAtlasGenerationCost(context: FriendAtlasContext): TokenEstimate {
  return estimate(JSON.stringify(context), OUTPUT_LIMITS.atlas)
}

export function estimateAtlasQuestionCost(input: {
  context: FriendAtlasContext
  atlas?: Atlas
  recentMessages: AtlasChatMessage[]
  question: string
}): TokenEstimate {
  const inputText =
    JSON.stringify(input.context) + JSON.stringify(input.atlas ?? {}) +
    JSON.stringify(input.recentMessages) + input.question
  return estimate(inputText, OUTPUT_LIMITS.question)
}
