// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const getUser = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}))

import { isAuthorized } from './verifyRequest'

const req = () => new NextRequest(new URL('/api/ai/ask-atlas', 'https://youji.test'))

beforeEach(() => {
  getUser.mockReset()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
})
afterEach(() => vi.unstubAllEnvs())

describe('isAuthorized', () => {
  it('本地模式（未配置）放行', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(await isAuthorized(req())).toBe(true)
    expect(getUser).not.toHaveBeenCalled()
  })

  it('有登录用户时放行', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    expect(await isAuthorized(req())).toBe(true)
  })

  it('无登录用户时拒绝', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect(await isAuthorized(req())).toBe(false)
  })
})
