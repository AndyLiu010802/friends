import type { Friend, Memory } from '../types'

const KEYWORDS = [
  '生日', '礼物', '吵架', '和好', '道歉', '帮忙', '借', '搬家',
  '生病', '住院', '升职', '离职', '分手', '结婚', '旅行', '秘密', '第一次', '重要',
]

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
  // 负面记录保底：关系趋势和相处注意需要正负两侧样本，不能只看最近/最长的
  const negativeMemories = friend.memories.filter(m => m.valence === 'negative')

  // Insertion order = priority order: a memory found earlier in this sequence
  // survives the 30-item cap below even if the set overflows.
  add(byDateDesc.slice(0, 15))
  add(byDateAsc.slice(0, 3))
  add(negativeMemories.slice(0, 5))
  add(byContentLengthDesc.slice(0, 5))
  add(byTagCountDesc.slice(0, 5))
  add(keywordMatches)

  return [...byId.values()].slice(0, 30)
}
