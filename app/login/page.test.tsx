import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LoginPage from './page'
import { isSupabaseConfigured } from '@/lib/auth/config'

const signInWithPassword = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...a: unknown[]) => signInWithPassword(...a) } },
}))
vi.mock('@/lib/auth/config', () => ({ isSupabaseConfigured: vi.fn() }))

beforeEach(() => {
  signInWithPassword.mockReset()
  vi.mocked(isSupabaseConfigured).mockReturnValue(true)
})

describe('LoginPage', () => {
  it('未配置 Supabase 时显示本地模式提示', () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    render(<LoginPage />)
    expect(screen.getByText(/本地模式，无需登录/)).toBeInTheDocument()
  })

  it('提交时以邮箱密码调用 signInWithPassword', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'pw123456' } })
    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    await vi.waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.c', password: 'pw123456' })
    )
  })

  it('登录失败时展示错误信息', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    expect(await screen.findByText(/登录失败/)).toBeInTheDocument()
  })
})
