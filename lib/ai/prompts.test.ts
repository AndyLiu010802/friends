import { describe, it, expect } from 'vitest'
import { buildAtlasPrompt, buildExtractMemoryPrompt } from './prompts'
import type { FriendAtlasContext } from './contextBuilder'

function makeContext(): FriendAtlasContext {
  return {
    friend: { id: 'f1', name: 'Test', important: false, relationshipGoal: 'repair' },
    likes: [], dislikes: [], hobbies: [],
    memories: [{ id: 'm1', date: '2026-06-01', title: 't', content: 'c', tags: [], valence: 'negative', initiator: 'friend' }],
    relationships: [],
    stats: {
      memoryCount: 1, relationshipCount: 0, profileCompletion: 20,
      growthStage: 'seed', energyLevel: 'low', confidence: 'low',
    },
  }
}

describe('buildAtlasPrompt', () => {
  it('asks for missingInfoQuestions in the output schema', () => {
    expect(buildAtlasPrompt(makeContext())).toContain('missingInfoQuestions')
  })

  it('explains valence/initiator semantics and relationshipGoal usage', () => {
    const prompt = buildAtlasPrompt(makeContext())
    expect(prompt).toContain('valence')
    expect(prompt).toContain('initiator')
    expect(prompt).toContain('relationshipGoal')
  })

  it('requires inferred content to be marked as speculation', () => {
    expect(buildAtlasPrompt(makeContext())).toContain('（推测）')
  })
})

describe('buildExtractMemoryPrompt', () => {
  it('包含原文、好友名与保守推断规则', () => {
    const prompt = buildExtractMemoryPrompt({ text: '一起吃了火锅', friendName: '阿明' })
    expect(prompt).toContain('一起吃了火锅')
    expect(prompt).toContain('阿明')
    expect(prompt).toContain('宁可省略')
    expect(prompt).toContain('title')
  })
})
