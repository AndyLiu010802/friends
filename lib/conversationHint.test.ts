import { describe, it, expect } from 'vitest'
import { generateConversationHint } from './conversationHint'
import type { Friend } from './types'

function baseFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'f1', name: 'Test', important: false,
    likes: [], dislikes: [], hobbies: [],
    portraits: [], memories: [], relationships: [],
    starConfig: { kind:'nebula', coreColor:'#94a3b8', glowColor:'#cbd5e1', size:1, twinkleSpeed:2, position:[0,0,0] },
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  }
}

describe('generateConversationHint', () => {
  it('uses the latest memory title when memories exist', () => {
    const memories = [
      { id:'m1', date:'2026-01-01', title:'第一次吃饭', content:'', tags:[], media:[] },
      { id:'m2', date:'2026-06-01', title:'一起看展', content:'', tags:[], media:[] },
    ]
    const hint = generateConversationHint(baseFriend({ memories }))
    expect(hint).toBe('下次可以问问 TA 最近的『一起看展』')
  })
  it('falls back to hobbies when there are no memories', () => {
    const hint = generateConversationHint(baseFriend({ hobbies: ['摄影', '爬山'] }))
    expect(hint).toBe('可以聊聊 TA 的兴趣爱好：摄影')
  })
  it('falls back to likes when there are no memories or hobbies', () => {
    const hint = generateConversationHint(baseFriend({ likes: ['咖啡'] }))
    expect(hint).toBe('可以聊聊 TA 喜欢的：咖啡')
  })
  it('gives a generic prompt when there is no data at all', () => {
    const hint = generateConversationHint(baseFriend())
    expect(hint).toBe('还不了解 TA，下次可以多问问喜好')
  })
})
