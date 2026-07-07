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
  it('counts full-width Chinese punctuation at the Chinese rate, not the English rate', () => {
    const text = '今天一起喝了咖啡，聊了很多。' // 12 Han chars + 2 punctuation, all should count at 1.5/token
    expect(text.length).toBe(14)
    expect(estimateTextTokens(text)).toBe(Math.ceil(14 / 1.5))
  })
})

describe('estimateAtlasGenerationCost', () => {
  it('applies a 20% buffer to the raw token estimate', () => {
    const result = estimateAtlasGenerationCost(MOCK_CONTEXT)
    const raw = estimateTextTokens(JSON.stringify(MOCK_CONTEXT))
    expect(result.estimatedInputTokens).toBe(Math.ceil(raw * 1.2))
  })
  it('uses the atlas output limit', () => {
    const result = estimateAtlasGenerationCost(MOCK_CONTEXT)
    expect(result.estimatedOutputTokens).toBe(OUTPUT_LIMITS.atlas)
  })
  it('computes cost as input tokens times input price plus output tokens times output price, not swapped', () => {
    const result = estimateAtlasGenerationCost(MOCK_CONTEXT)
    const expectedCost =
      (result.estimatedInputTokens / 1_000_000) * 5.00 +
      (result.estimatedOutputTokens / 1_000_000) * 15.00
    expect(result.estimatedCostUsd).toBeCloseTo(expectedCost, 10)
    // Sanity: confirm this differs from the swapped-price calculation, so a
    // swap mutation would actually be caught by the assertion above.
    const swappedCost =
      (result.estimatedInputTokens / 1_000_000) * 15.00 +
      (result.estimatedOutputTokens / 1_000_000) * 5.00
    expect(expectedCost).not.toBeCloseTo(swappedCost, 10)
    expect(result.estimatedCostUsd).not.toBeCloseTo(swappedCost, 10)
  })
})

describe('estimateAtlasQuestionCost', () => {
  it('uses the question output limit', () => {
    const result = estimateAtlasQuestionCost({ context: MOCK_CONTEXT, recentMessages: [], question: '下次可以聊什么？' })
    expect(result.estimatedOutputTokens).toBe(OUTPUT_LIMITS.question)
  })
})

describe('cost level thresholds', () => {
  // Build contexts of controlled size (via a long `notes` field, which is plain ASCII
  // so token math is simple: padLen/4 tokens before buffering) to land estimatedCostUsd
  // clearly inside each bucket. Padding lengths below were derived empirically — by
  // running a small script reproducing estimateTextTokens/estimate and printing the
  // actual cost at various padLen values — not hand-calculated, since the baseline
  // cost from OUTPUT_LIMITS.atlas's fixed 2200 output tokens plus MOCK_CONTEXT's own
  // JSON overhead both contribute non-obvious baseline cost.
  //
  // Empirically observed costs at these padLens (gpt-5.5 pricing $5/$15 per 1M):
  //   padLen=0      -> cost ≈ 0.0338  (low,       < 0.1)
  //   padLen=55000  -> cost ≈ 0.1161  (medium,    > 0.1,  margin ~0.016)
  //   padLen=345000 -> cost ≈ 0.5511  (high,      > 0.5,  margin ~0.051)
  //   padLen=660000 -> cost ≈ 1.0236  (very-high, > 1,    margin ~0.024)
  //
  // Mutation-testing pass performed on levelFor's three thresholds (0.1/0.5/1):
  // each threshold was temporarily shifted (e.g. 0.1 -> 0.2, 0.5 -> 0.6, 1 -> 1.1)
  // and confirmed to break exactly one of the below tests (the one whose margin fell
  // inside the shifted range), then reverted.

  function makeContextWithPadding(padLen: number): FriendAtlasContext {
    return { ...MOCK_CONTEXT, friend: { ...MOCK_CONTEXT.friend, notes: 'x'.repeat(padLen) } }
  }

  it('reports low for a small context', () => {
    const result = estimateAtlasGenerationCost(makeContextWithPadding(0))
    expect(result.estimatedCostUsd).toBeLessThan(0.1)
    expect(result.level).toBe('low')
  })
  it('reports medium just above the 0.1 threshold', () => {
    const result = estimateAtlasGenerationCost(makeContextWithPadding(55000))
    expect(result.estimatedCostUsd).toBeGreaterThan(0.1)
    expect(result.level).toBe('medium')
  })
  it('reports high just above the 0.5 threshold', () => {
    const result = estimateAtlasGenerationCost(makeContextWithPadding(345000))
    expect(result.estimatedCostUsd).toBeGreaterThan(0.5)
    expect(result.level).toBe('high')
  })
  it('reports very-high above the 1 threshold', () => {
    const result = estimateAtlasGenerationCost(makeContextWithPadding(660000))
    expect(result.estimatedCostUsd).toBeGreaterThan(1)
    expect(result.level).toBe('very-high')
  })
})
