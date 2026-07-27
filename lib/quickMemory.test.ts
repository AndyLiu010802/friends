import { describe, it, expect, vi, afterEach } from 'vitest'
import { fallbackTitle, buildQuickMemory, sortMemoriesDesc, extractMemory } from './quickMemory'
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

describe('extractMemory', () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubFetch(response: unknown) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(response) }))
  }

  it('成功时返回清洗后的结果', async () => {
    stubFetch({ ok: true, title: '一起爬山', tags: ['爬山'], valence: 'positive' })
    const r = await extractMemory('她约我爬山', '阿明')
    expect(r).toEqual({ title: '一起爬山', tags: ['爬山'], valence: 'positive', initiator: undefined })
  })

  it('ok:false 时返回 null', async () => {
    stubFetch({ ok: false })
    expect(await extractMemory('x', 'y')).toBeNull()
  })

  it('响应缺字段时返回 null', async () => {
    stubFetch({ ok: true, tags: [] })
    expect(await extractMemory('x', 'y')).toBeNull()
  })

  it('fetch 抛错时返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await extractMemory('x', 'y')).toBeNull()
  })

  it('携带 text 与 friendName 调用提取接口', async () => {
    stubFetch({ ok: true, title: 't', tags: [] })
    await extractMemory('内容', '阿明')
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/ai/extract-memory')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ text: '内容', friendName: '阿明' })
  })
})
