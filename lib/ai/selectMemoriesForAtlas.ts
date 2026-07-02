import type { Friend, Memory } from '../types'

const KEYWORDS = ['生日', '礼物', '吵架', '重要', '喜欢', '不喜欢']

export function selectMemoriesForAtlas(friend: Friend): Memory[] {
  const byId = new Map<string, Memory>()
  const add = (memories: Memory[]) => memories.forEach(m => byId.set(m.id, m))

  const byDateDesc = [...friend.memories].sort((a, b) => b.date.localeCompare(a.date))
  const byDateAsc = [...friend.memories].sort((a, b) => a.date.localeCompare(b.date))
  const byContentLengthDesc = [...friend.memories].sort((a, b) => b.content.length - a.content.length)
  const byTagCountDesc = [...friend.memories].sort((a, b) => b.tags.length - a.tags.length)
  const keywordMatches = friend.memories.filter(m =>
    KEYWORDS.some(k => m.content.includes(k) || m.tags.some(t => t.includes(k)))
  )

  // Insertion order = priority order: a memory found earlier in this sequence
  // survives the 30-item cap below even if the set overflows.
  add(byDateDesc.slice(0, 15))
  add(byDateAsc.slice(0, 3))
  add(byContentLengthDesc.slice(0, 5))
  add(byTagCountDesc.slice(0, 5))
  add(keywordMatches)

  return [...byId.values()].slice(0, 30)
}
