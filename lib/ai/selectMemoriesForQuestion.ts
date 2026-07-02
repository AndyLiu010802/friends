import type { Friend, Memory } from '../types'

const GIFT_QUESTION_KEYWORDS = ['礼物', '生日', '喜欢', '买', '送']
const TOPIC_QUESTION_KEYWORDS = ['聊', '话题', '见面']
const TREND_QUESTION_KEYWORDS = ['关系', '变近', '变远', '为什么']
const GIFT_MEMORY_KEYWORDS = ['礼物', '生日', '喜欢', '想要', '买', '讨厌']

function truncateContent(memory: Memory): Memory {
  if (memory.content.length <= 600) return memory
  return { ...memory, content: memory.content.slice(0, 600) + '……' }
}

export function selectRelevantMemoriesForQuestion(friend: Friend, question: string): Memory[] {
  const byId = new Map<string, Memory>()
  const add = (memories: Memory[]) => memories.forEach(m => byId.set(m.id, m))

  const byDateDesc = [...friend.memories].sort((a, b) => b.date.localeCompare(a.date))
  const byDateAsc = [...friend.memories].sort((a, b) => a.date.localeCompare(b.date))

  add(byDateDesc.slice(0, 5))

  if (GIFT_QUESTION_KEYWORDS.some(k => question.includes(k))) {
    add(friend.memories.filter(m =>
      GIFT_MEMORY_KEYWORDS.some(k => m.content.includes(k) || m.tags.some(t => t.includes(k)))
    ))
  }

  if (TOPIC_QUESTION_KEYWORDS.some(k => question.includes(k))) {
    add(byDateDesc.slice(0, 5))
  }

  if (TREND_QUESTION_KEYWORDS.some(k => question.includes(k))) {
    add(byDateAsc.slice(0, 3))
    add(byDateDesc.slice(0, 8))
  }

  return [...byId.values()].slice(0, 15).map(truncateContent)
}
