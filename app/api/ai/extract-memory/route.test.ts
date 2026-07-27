// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/verifyRequest', () => ({ isAuthorized: vi.fn() }))
vi.mock('@/lib/ai/provider', () => ({ MODEL: 'test-model', generateWithAI: vi.fn() }))

import { POST } from './route'
import { isAuthorized } from '@/lib/auth/verifyRequest'
import { generateWithAI } from '@/lib/ai/provider'

function post(body: unknown) {
  return new NextRequest(new URL('/api/ai/extract-memory', 'https://youji.test'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => { vi.mocked(isAuthorized).mockReset(); vi.mocked(generateWithAI).mockReset() })

describe('POST /api/ai/extract-memory', () => {
  it('未授权返回 401 且不调用 AI', async () => {
    vi.mocked(isAuthorized).mockResolvedValue(false)
    const res = await POST(post({ text: 'x', friendName: 'y' }))
    expect(res.status).toBe(401)
    expect(generateWithAI).not.toHaveBeenCalled()
  })

  it('缺参数返回 400', async () => {
    vi.mocked(isAuthorized).mockResolvedValue(true)
    const res = await POST(post({ text: '  ', friendName: 'y' }))
    expect(res.status).toBe(400)
  })

  it('成功提取并过滤非法枚举值', async () => {
    vi.mocked(isAuthorized).mockResolvedValue(true)
    vi.mocked(generateWithAI).mockResolvedValue(JSON.stringify({
      title: '一起爬山', tags: ['爬山', '', '公园', '多余1', '多余2'], valence: 'positive', initiator: 'alien',
    }))
    const res = await POST(post({ text: '她约我爬山', friendName: '阿明' }))
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.title).toBe('一起爬山')
    expect(data.tags).toEqual(['爬山', '公园', '多余1'])
    expect(data.valence).toBe('positive')
    expect(data.initiator).toBeUndefined()
  })

  it('AI 抛错返回 ok:false 且状态 200', async () => {
    vi.mocked(isAuthorized).mockResolvedValue(true)
    vi.mocked(generateWithAI).mockRejectedValue(new Error('down'))
    const res = await POST(post({ text: 'x', friendName: 'y' }))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(false)
  })

  it('AI 返回缺 title 的 JSON 时 ok:false', async () => {
    vi.mocked(isAuthorized).mockResolvedValue(true)
    vi.mocked(generateWithAI).mockResolvedValue('{"tags":["x"]}')
    expect((await (await POST(post({ text: 'x', friendName: 'y' }))).json()).ok).toBe(false)
  })
})
