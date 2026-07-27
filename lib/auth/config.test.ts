import { describe, it, expect, afterEach, vi } from 'vitest'
import { isSupabaseConfigured } from './config'

afterEach(() => vi.unstubAllEnvs())

describe('isSupabaseConfigured', () => {
  it('两个环境变量都存在时返回 true', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    expect(isSupabaseConfigured()).toBe(true)
  })

  it('缺少 URL 时返回 false', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    expect(isSupabaseConfigured()).toBe(false)
  })

  it('缺少 key 时返回 false', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    expect(isSupabaseConfigured()).toBe(false)
  })
})
