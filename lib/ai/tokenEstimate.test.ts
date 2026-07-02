import { describe, it, expect, vi } from 'vitest'
import { estimateTextTokens, estimateAtlasGenerationCost, estimateAtlasQuestionCost, OUTPUT_LIMITS } from './tokenEstimate'
import type { FriendAtlasContext } from './contextBuilder'

function makeContextWithPadding(padLen: number): FriendAtlasContext {
  return {
    friend: { id: 'f1', name: 'x', important: false },
    likes: [], dislikes: [], hobbies: [],
    memories: [{ id: 'm1', date: '2026-01-01', title: 'x', content: 'a'.repeat(padLen), tags: [] }],
    relationships: [],
    stats: { memoryCount: 1, relationshipCount: 0, profileCompletion: 0, growthStage: 'x', energyLevel: 'x', confidence: 'low' },
  }
}

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
  it('counts full-width Chinese punctuation at the 1.5 chars/token Chinese rate, not the 4 chars/token English rate', () => {
    // All 10 chars here are Han ideographs or full-width punctuation, so the
    // whole string should be estimated at the Chinese rate. If punctuation
    // fell through to the "other" bucket, this would estimate too few tokens
    // (an under-count is unsafe for a cost-gating feature).
    const text = '今天一起喝了咖啡，聊了很多。'
    expect(text.length).toBe(14)
    expect(estimateTextTokens(text)).toBe(Math.ceil(14 / 1.5))
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

describe('levelFor thresholds (via estimateAtlasGenerationCost cost boundaries)', () => {
  // These use 'premium' mode (gpt-5.5: $5/$15 per 1M input/output tokens) with a
  // pure-ASCII memory `content` of controlled length, since ASCII gives a simple,
  // predictable chars->tokens ratio (4 chars/token) for calibrating exact cost values.
  // Each pad length below was chosen empirically to land the resulting estimatedCostUsd
  // just inside one side of a 0.1 / 0.5 / 1 boundary (margin ~0.02), which is tight
  // enough to catch a realistic threshold-shift mutation (e.g. 0.5 -> 0.4 or 0.6) without
  // being so exact-boundary-fragile that unrelated formula tweaks would break it.
  // Note: this does NOT distinguish `<` from `<=` at the exact boundary value — that
  // would require hitting the literal float, which is impractical given the
  // char-counting/buffer/ceil math; treat that as a known, accepted gap.
  it('reports low just below the 0.1 threshold', () => {
    const result = estimateAtlasGenerationCost(makeContextWithPadding(31333), 'premium')
    expect(result.estimatedCostUsd).toBeLessThan(0.1)
    expect(result.level).toBe('low')
  })
  it('reports medium just above the 0.1 threshold', () => {
    const result = estimateAtlasGenerationCost(makeContextWithPadding(58000), 'premium')
    expect(result.estimatedCostUsd).toBeGreaterThan(0.1)
    expect(result.level).toBe('medium')
  })
  it('reports medium just below the 0.5 threshold', () => {
    const result = estimateAtlasGenerationCost(makeContextWithPadding(298000), 'premium')
    expect(result.estimatedCostUsd).toBeLessThan(0.5)
    expect(result.level).toBe('medium')
  })
  it('reports high just above the 0.5 threshold', () => {
    const result = estimateAtlasGenerationCost(makeContextWithPadding(324667), 'premium')
    expect(result.estimatedCostUsd).toBeGreaterThan(0.5)
    expect(result.level).toBe('high')
  })
  it('reports high just below the 1 threshold', () => {
    const result = estimateAtlasGenerationCost(makeContextWithPadding(624667), 'premium')
    expect(result.estimatedCostUsd).toBeLessThan(1)
    expect(result.level).toBe('high')
  })
  it('reports very-high just above the 1 threshold', () => {
    const result = estimateAtlasGenerationCost(makeContextWithPadding(664667), 'premium')
    expect(result.estimatedCostUsd).toBeGreaterThan(1)
    expect(result.level).toBe('very-high')
  })
})

describe('pricing fallback', () => {
  it('throws instead of silently estimating $0.00 when a mode maps to a model with no pricing entry', async () => {
    // Simulates the real-world failure mode: a new mode/model gets added to
    // MODEL_MAP (Task 12) but PRICING_USD_PER_1M (this file) isn't updated to
    // match. Silently falling back to {input:0, output:0} would produce a
    // misleadingly cheap "low" estimate for an unpriced model — the opposite
    // of fail-safe for a spend-gating feature — so this must throw instead.
    vi.resetModules()
    vi.doMock('./provider', async () => {
      const actual = await vi.importActual<typeof import('./provider')>('./provider')
      return {
        ...actual,
        MODEL_MAP: {
          ...actual.MODEL_MAP,
          economy: { provider: 'gemini', model: 'some-brand-new-unpriced-model' },
        },
      }
    })
    const { estimateAtlasGenerationCost: estimateWithMockedProvider } = await import('./tokenEstimate')
    expect(() => estimateWithMockedProvider(MOCK_CONTEXT, 'economy')).toThrow(/定价信息缺失/)
    vi.doUnmock('./provider')
    vi.resetModules()
  })
})
