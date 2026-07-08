import type { AtlasEvidence } from '../types'

// AI 引用了不存在的 memory id 时直接丢弃该条依据（模型编造引用）。
// 不带 id 的说明性依据和非 memory 类型（like/hobby/note 等本身无 id 可校验）保留。
export function validateEvidence(
  evidence: AtlasEvidence[] | undefined,
  validMemoryIds: Set<string>
): AtlasEvidence[] {
  if (!evidence) return []
  return evidence.filter(e => {
    if (e.type !== 'memory') return true
    if (!e.id) return true
    return validMemoryIds.has(e.id)
  })
}
