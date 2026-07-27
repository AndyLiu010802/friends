import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AccountPanel from './AccountPanel'
import { isSupabaseConfigured } from '@/lib/auth/config'

const getUser = vi.fn()
const signOut = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...a: unknown[]) => getUser(...a),
      signOut: (...a: unknown[]) => signOut(...a),
    },
  },
}))
vi.mock('@/lib/auth/config', () => ({ isSupabaseConfigured: vi.fn() }))

beforeEach(() => {
  getUser.mockReset()
  signOut.mockReset()
  vi.mocked(isSupabaseConfigured).mockReturnValue(true)
  getUser.mockResolvedValue({ data: { user: { email: 'me@youji.app' } } })
  signOut.mockResolvedValue({ error: null })
})

describe('AccountPanel', () => {
  it('未配置 Supabase 时显示本地模式说明', () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    render(<AccountPanel />)
    expect(screen.getByText(/本地模式/)).toBeInTheDocument()
  })

  it('显示当前登录邮箱', async () => {
    render(<AccountPanel />)
    expect(await screen.findByText(/me@youji\.app/)).toBeInTheDocument()
  })

  it('点击退出登录调用 signOut', async () => {
    render(<AccountPanel />)
    fireEvent.click(await screen.findByRole('button', { name: '退出登录' }))
    await vi.waitFor(() => expect(signOut).toHaveBeenCalled())
  })
})
