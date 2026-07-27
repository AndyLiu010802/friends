// 「知道了」忽略表:id -> 触发条件指纹。设备本地状态,不进云备份。
// 指纹变化(触发条件的状态变化)时同 id 信号会重新出现。
const KEY = 'yj_dismissed_signals'

export interface DismissableSignal {
  id: string
  fingerprint: string
}

export function getDismissals(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    return raw
  } catch {
    return {}
  }
}

export function dismissSignal(id: string, fingerprint: string): Record<string, string> {
  const next = { ...getDismissals(), [id]: fingerprint }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* 存不进就只在本次会话生效 */ }
  return next
}

export function filterDismissed<T extends DismissableSignal>(
  signals: T[],
  dismissals: Record<string, string>,
): T[] {
  return signals.filter(s => dismissals[s.id] !== s.fingerprint)
}
