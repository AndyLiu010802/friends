import { describe, it, expect } from 'vitest'
import { fallbackTitle, buildQuickMemory, sortMemoriesDesc } from './quickMemory'
import type { Memory } from './types'

function mem(date: string, time?: string): Memory {
  return { id: `m-${date}-${time ?? ''}`, date, time, title: 't', content: '', tags: [], media: [] }
}

describe('fallbackTitle', () => {
  it('取首个句读前的内容', () => {
    expect(fallbackTitle('一起吃了火锅。她说下次去爬山')).toBe('一起吃了火锅')
  })
  it('支持问号感叹号换行截断', () => {
    expect(fallbackTitle('她今天怎么了?好奇怪')).toBe('她今天怎么了')
    expect(fallbackTitle('太开心了!下次再约')).toBe('太开心了')
    expect(fallbackTitle('第一行\n第二行')).toBe('第一行')
  })
  it('超长截 12 字', () => {
    expect(fallbackTitle('今天下午我们在公园里散步聊了很多以前的事情')).toBe('今天下午我们在公园里散步')
  })
  it('全空白返回随手一记', () => {
    expect(fallbackTitle('   ')).toBe('随手一记')
  })
})

describe('buildQuickMemory', () => {
  const now = new Date(2026, 6, 27, 9, 5) // 2026-07-27 09:05
  it('date/time 取 now,content 恒为原文', () => {
    const m = buildQuickMemory('随便记一句', null, now)
    expect(m.date).toBe('2026-07-27')
    expect(m.time).toBe('09:05')
    expect(m.content).toBe('随便记一句')
    expect(m.media).toEqual([])
  })
  it('无提取结果时降级:标题取首句,无标签无情绪', () => {
    const m = buildQuickMemory('一起吃了火锅。很开心', null, now)
    expect(m.title).toBe('一起吃了火锅')
    expect(m.tags).toEqual([])
    expect(m.valence).toBeUndefined()
    expect(m.initiator).toBeUndefined()
  })
  it('有提取结果时使用提取字段', () => {
    const m = buildQuickMemory('她约我爬山,聊得很开心', {
      title: '一起爬山', tags: ['爬山'], valence: 'positive', initiator: 'friend',
    }, now)
    expect(m.title).toBe('一起爬山')
    expect(m.tags).toEqual(['爬山'])
    expect(m.valence).toBe('positive')
    expect(m.initiator).toBe('friend')
  })
})

describe('sortMemoriesDesc', () => {
  it('按日期降序,同日按时间降序,无 time 视为 00:00', () => {
    const list = [mem('2026-07-01'), mem('2026-07-27', '09:00'), mem('2026-07-27', '18:30'), mem('2026-07-27')]
    const sorted = sortMemoriesDesc(list)
    expect(sorted.map(m => `${m.date} ${m.time ?? '-'}`)).toEqual([
      '2026-07-27 18:30', '2026-07-27 09:00', '2026-07-27 -', '2026-07-01 -',
    ])
  })
  it('不修改原数组', () => {
    const list = [mem('2026-07-01'), mem('2026-07-27')]
    sortMemoriesDesc(list)
    expect(list[0].date).toBe('2026-07-01')
  })
})
