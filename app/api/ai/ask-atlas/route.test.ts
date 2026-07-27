// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/verifyRequest', () => ({ isAuthorized: vi.fn() }))
vi.mock('@/lib/ai/provider', () => ({ MODEL: 'test-model', generateWithAI: vi.fn() }))

import { POST } from './route'
import { isAuthorized } from '@/lib/auth/verifyRequest'
import { generateWithAI } from '@/lib/ai/provider'

function post(body: unknown) {
  return new NextRequest(new URL('/api/ai/ask-atlas', 'https://youji.test'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => vi.mocked(isAuthorized).mockReset())

describe('POST /api/ai/ask-atlas', () => {
  it('未授权请求返回 401 且不调用 AI', async () => {
    vi.mocked(isAuthorized).mockResolvedValue(false)
    const res = await POST(post({ context: {}, messages: [], question: 'hi' }))
    expect(res.status).toBe(401)
    expect(generateWithAI).not.toHaveBeenCalled()
  })

  it('已授权但缺参数返回 400（证明守卫在业务校验之前且不拦好人）', async () => {
    vi.mocked(isAuthorized).mockResolvedValue(true)
    const res = await POST(post({ context: null, messages: [], question: '' }))
    expect(res.status).toBe(400)
  })
})
