import { describe, it, expect } from 'vitest'
import { estimateTextTokens, estimateAtlasGenerationCost, estimateAtlasQuestionCost, OUTPUT_LIMITS } from './tokenEstimate'
import type { FriendAtlasContext } from './contextBuilder'

const MOCK_CONTEXT: FriendAtlasContext = {
  friend: { id: 'f1', name: '小雨', important: false },
  likes: ['咖啡'], dislikes: [], hobbies: ['爬山'],
  memories: [{ id: 'm1', date: '2026-01-01', title: '见面', content: '今天一起喝了咖啡，聊了很多。', tags: ['日常'] }],
  relationships: [],
  stats: { memoryCount: 1, relationshipCount: 0, profileCompletion: 40, growthStage: 'young', energyLevel: 'low', confidence: 'medium' },
}

describe('estimateTextTokens', () => {
  it('estimates pure ASCII text at 4 chars per token', () => {
    expect(estimateTextTokens('a'.repeat(40))).toBe(10)
  })
  it('estimates pure Chinese text at 1.5 chars per token', () => {
    expect(estimateTextTokens('好'.repeat(30))).toBe(20)
  })
  it('handles mixed Chinese and English text', () => {
    const text = '你好hi'
    expect(estimateTextTokens(text)).toBe(Math.ceil(2 / 1.5 + 2 / 4))
  })
})

describe('estimateAtlasGenerationCost', () => {
  it('applies a 20% buffer to the raw token estimate', () => {
    const result = estimateAtlasGenerationCost(MOCK_CONTEXT, 'economy')
    const raw = estimateTextTokens(JSON.stringify(MOCK_CONTEXT))
    expect(result.estimatedInputTokens).toBe(Math.ceil(raw * 1.2))
  })
  it('uses the atlas output limit for the given mode', () => {
    const result = estimateAtlasGenerationCost(MOCK_CONTEXT, 'premium')
    expect(result.estimatedOutputTokens).toBe(OUTPUT_LIMITS.atlas.premium)
  })
  it('premium mode costs more than economy mode for the same context', () => {
    const economy = estimateAtlasGenerationCost(MOCK_CONTEXT, 'economy')
    const premium = estimateAtlasGenerationCost(MOCK_CONTEXT, 'premium')
    expect(premium.estimatedCostUsd).toBeGreaterThan(economy.estimatedCostUsd)
  })
  it('computes cost as input tokens times input price plus output tokens times output price (not swapped)', () => {
    // economy = gemini-2.5-flash-lite: input $0.10/1M, output $0.40/1M.
    // Output tokens (1200) vastly outnumber input tokens here, so swapping the
    // input/output price fields would still change the total — this pins the exact value.
    const result = estimateAtlasGenerationCost(MOCK_CONTEXT, 'economy')
    const expectedCost =
      (result.estimatedInputTokens / 1_000_000) * 0.10 +
      (result.estimatedOutputTokens / 1_000_000) * 0.40
    expect(result.estimatedCostUsd).toBeCloseTo(expectedCost, 10)
    // Sanity: confirm this differs from the swapped-price calculation, so a
    // swap mutation would actually be caught by the assertion above.
    const swappedCost =
      (result.estimatedInputTokens / 1_000_000) * 0.40 +
      (result.estimatedOutputTokens / 1_000_000) * 0.10
    expect(expectedCost).not.toBeCloseTo(swappedCost, 10)
  })
})

describe('estimateAtlasQuestionCost', () => {
  it('uses the question output limit for the given mode', () => {
    const result = estimateAtlasQuestionCost({
      context: MOCK_CONTEXT, recentMessages: [], question: '下次可以聊什么？', mode: 'standard',
    })
    expect(result.estimatedOutputTokens).toBe(OUTPUT_LIMITS.question.standard)
  })
})
