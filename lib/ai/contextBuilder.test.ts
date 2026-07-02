import { describe, it, expect } from 'vitest'
import { buildFriendAtlasContext } from './contextBuilder'
import { calculateAtlasConfidence } from '../atlasConfidence'
import { calculateProfileCompletion } from '../profileCompletion'
import { getGrowthStage } from '../growthStage'
import { calculateFriendEnergy } from '../friendEnergy'
import type { Friend } from '../types'

function makeFriend(overrides: Partial<Friend>): Friend {
  return {
    id: 'f1', name: '小雨', important: false, likes: [], dislikes: [], hobbies: [],
    portraits: [], memories: [], relationships: [],
    starConfig: { kind: 'nebula', coreColor: '#000', glowColor: '#000', size: 1, twinkleSpeed: 2, position: [0, 0, 0] },
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  }
}

describe('buildFriendAtlasContext', () => {
  it('does not include any media URLs in the memories', () => {
    const friend = makeFriend({
      memories: [{
        id: 'm1', date: '2026-01-01', title: '合照', content: '拍了照片', tags: [],
        media: [{ id: 'media1', type: 'photo', url: 'https://example.com/secret.jpg', thumbnailUrl: 'https://example.com/thumb.jpg', size: 100 }],
      }],
    })
    const context = buildFriendAtlasContext(friend, [friend])
    expect(JSON.stringify(context)).not.toContain('example.com')
  })

  it('resolves relationship friendId to the target friend name via allFriends', () => {
    const target = makeFriend({ id: 'f2', name: '小明' })
    const friend = makeFriend({ relationships: [{ friendId: 'f2', label: '同学', closeness: 2 }] })
    const context = buildFriendAtlasContext(friend, [friend, target])
    expect(context.relationships[0].friendName).toBe('小明')
  })

  it('falls back to a placeholder name when the related friend no longer exists', () => {
    const friend = makeFriend({ relationships: [{ friendId: 'gone', label: '同事', closeness: 1 }] })
    const context = buildFriendAtlasContext(friend, [friend])
    expect(context.relationships[0].friendName).toBe('（已删除的好友）')
  })

  it('uses the question-specific memory selector when a question is passed', () => {
    const memories = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}`, title: 't', content: 'c', tags: [], media: [],
    }))
    const friend = makeFriend({ memories })
    const atlasContext = buildFriendAtlasContext(friend, [friend])
    const questionContext = buildFriendAtlasContext(friend, [friend], '随便问问')
    expect(atlasContext.stats.memoryCount).toBe(10)
    expect(questionContext.stats.memoryCount).toBe(10)
  })

  it('actually delegates to the question-specific selector, producing a different memory selection than the atlas selector', () => {
    // 20 memories: selectMemoriesForAtlas caps at 30 (so returns all 20 by date-desc/asc/etc dedup),
    // but selectRelevantMemoriesForQuestion caps at 15 and only pulls byDateDesc.slice(0,5) for a
    // question with no matched keywords. This must differ in length/content between the two paths.
    const memories = Array.from({ length: 20 }, (_, i) => ({
      id: `m${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}`, title: 't', content: 'c', tags: [], media: [],
    }))
    const friend = makeFriend({ memories })
    const atlasContext = buildFriendAtlasContext(friend, [friend])
    const questionContext = buildFriendAtlasContext(friend, [friend], '随便问问不含关键词')

    expect(atlasContext.memories.length).toBe(20)
    expect(questionContext.memories.length).toBe(5)
    expect(atlasContext.memories.map(m => m.id)).not.toEqual(questionContext.memories.map(m => m.id))
  })

  it('excludes the media field from the memory objects (only id/date/title/content/tags survive)', () => {
    const friend = makeFriend({
      memories: [{
        id: 'm1', date: '2026-01-01', title: '合照', content: '拍了照片', tags: ['tag1'],
        media: [{ id: 'media1', type: 'photo', url: 'https://example.com/secret.jpg', thumbnailUrl: 'https://example.com/thumb.jpg', size: 100 }],
      }],
    })
    const context = buildFriendAtlasContext(friend, [friend])
    expect(context.memories[0]).toEqual({ id: 'm1', date: '2026-01-01', title: '合照', content: '拍了照片', tags: ['tag1'] })
    expect(Object.keys(context.memories[0])).not.toContain('media')
  })

  it('correctly maps all four delegated stats fields from their source functions', () => {
    const memories = Array.from({ length: 8 }, (_, i) => ({
      id: `m${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}`, title: 't', content: 'c', tags: [], media: [],
    }))
    const friend = makeFriend({
      memories,
      notes: '很聊得来', likes: ['咖啡'], hobbies: ['爬山'],
      relationships: [{ friendId: 'f2', label: '同学', closeness: 2 }],
    })
    const context = buildFriendAtlasContext(friend, [friend])

    // Cross-check against the actual dependency functions directly, so this test
    // stays correct even if their internal scoring logic changes later — it's
    // asserting "contextBuilder reads the right property," not "here's what the
    // scoring algorithm currently outputs."
    const expectedConfidence = calculateAtlasConfidence(friend)
    const expectedCompletion = calculateProfileCompletion(friend)
    const expectedStage = getGrowthStage(friend)
    const expectedEnergy = calculateFriendEnergy(friend)

    expect(context.stats.confidence).toBe(expectedConfidence.level)
    expect(context.stats.profileCompletion).toBe(expectedCompletion.percent)
    expect(context.stats.growthStage).toBe(expectedStage.stage)
    expect(context.stats.energyLevel).toBe(expectedEnergy.level)
  })
})
