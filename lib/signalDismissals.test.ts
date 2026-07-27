import { describe, it, expect, beforeEach } from 'vitest'
import { getDismissals, dismissSignal, filterDismissed } from './signalDismissals'

beforeEach(() => localStorage.clear())

describe('signalDismissals', () => {
  it('初始为空表', () => {
    expect(getDismissals()).toEqual({})
  })

  it('dismiss 后落库并返回新表', () => {
    const next = dismissSignal('f1-birthday', '2026-08-01-soon')
    expect(next).toEqual({ 'f1-birthday': '2026-08-01-soon' })
    expect(getDismissals()).toEqual({ 'f1-birthday': '2026-08-01-soon' })
  })

  it('同 id 再次 dismiss 覆盖旧指纹', () => {
    dismissSignal('a', 'fp1')
    expect(dismissSignal('a', 'fp2')).toEqual({ a: 'fp2' })
  })

  it('filterDismissed:指纹相同滤掉,不同保留', () => {
    const dismissals = { a: 'fp1' }
    const signals = [
      { id: 'a', fingerprint: 'fp1' },
      { id: 'a2', fingerprint: 'fp1' },
      { id: 'b', fingerprint: 'x' },
    ]
    expect(filterDismissed(signals, dismissals).map(s => s.id)).toEqual(['a2', 'b'])
  })

  it('指纹变化(状态变化)后同 id 信号重现', () => {
    const d = dismissSignal('a', 'old-state')
    expect(filterDismissed([{ id: 'a', fingerprint: 'new-state' }], d)).toHaveLength(1)
  })

  it('损坏 JSON 静默降级为空表', () => {
    localStorage.setItem('yj_dismissed_signals', '{not json')
    expect(getDismissals()).toEqual({})
  })

  it('存的是数组等非对象也降级为空表', () => {
    localStorage.setItem('yj_dismissed_signals', '[1,2]')
    expect(getDismissals()).toEqual({})
  })
})
