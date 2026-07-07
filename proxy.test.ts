// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
// 文档写的是 unstable_doesProxyMatch，但该版本实际导出仍是 unstable_doesMiddlewareMatch
import { unstable_doesMiddlewareMatch, getRedirectUrl } from 'next/experimental/testing/server'

const getUser = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}))

import { proxy, config } from './proxy'

function req(path: string) {
  return new NextRequest(new URL(path, 'https://youji.test'))
}

beforeEach(() => {
  getUser.mockReset()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
})
afterEach(() => vi.unstubAllEnvs())

describe('matcher', () => {
  it('静态资源不经过门禁，页面与 API 经过', () => {
    const nextConfig = {}
    expect(unstable_doesMiddlewareMatch({ config, nextConfig, url: '/_next/static/a.js' })).toBe(false)
    expect(unstable_doesMiddlewareMatch({ config, nextConfig, url: '/' })).toBe(true)
    expect(unstable_doesMiddlewareMatch({ config, nextConfig, url: '/api/ai/ask-atlas' })).toBe(true)
    expect(unstable_doesMiddlewareMatch({ config, nextConfig, url: '/login' })).toBe(true)
  })
})

describe('proxy', () => {
  it('未配置 Supabase（本地模式）时放行', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const res = await proxy(req('/'))
    expect(res.headers.get('x-middleware-next')).toBe('1')
    expect(getUser).not.toHaveBeenCalled()
  })

  it('未登录访问页面 → 重定向 /login', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await proxy(req('/friend/new'))
    expect(getRedirectUrl(res)).toBe('https://youji.test/login')
  })

  it('未登录调用 API → 401 JSON', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await proxy(req('/api/ai/ask-atlas'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  it('未登录访问 /login → 放行', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await proxy(req('/login'))
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('已登录访问页面 → 放行', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await proxy(req('/'))
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('已登录访问 /login → 重定向回星图', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await proxy(req('/login'))
    expect(getRedirectUrl(res)).toBe('https://youji.test/')
  })
})
