import { describe, it, expect } from 'vitest'
import { validateEvidence } from './validateEvidence'
import type { AtlasEvidence } from '../types'

const VALID_IDS = new Set(['m1', 'm2'])

describe('validateEvidence', () => {
  it('keeps memory evidence whose id exists in the context', () => {
    const evidence: AtlasEvidence[] = [{ type: 'memory', id: 'm1', text: 'ok' }]
    expect(validateEvidence(evidence, VALID_IDS)).toEqual(evidence)
  })

  it('drops memory evidence with a fabricated id', () => {
    const evidence: AtlasEvidence[] = [
      { type: 'memory', id: 'm1', text: 'real' },
      { type: 'memory', id: 'made-up', text: 'hallucinated' },
    ]
    expect(validateEvidence(evidence, VALID_IDS)).toEqual([{ type: 'memory', id: 'm1', text: 'real' }])
  })

  it('keeps memory evidence without an id (descriptive reference)', () => {
    const evidence: AtlasEvidence[] = [{ type: 'memory', text: '多条聚餐记录' }]
    expect(validateEvidence(evidence, VALID_IDS)).toEqual(evidence)
  })

  it('keeps non-memory evidence untouched', () => {
    const evidence: AtlasEvidence[] = [{ type: 'like', text: '喜欢咖啡' }, { type: 'note', text: '备注' }]
    expect(validateEvidence(evidence, VALID_IDS)).toEqual(evidence)
  })

  it('returns [] for undefined evidence', () => {
    expect(validateEvidence(undefined, VALID_IDS)).toEqual([])
  })
})
