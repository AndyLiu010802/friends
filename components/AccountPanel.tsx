'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isSupabaseConfigured } from '@/lib/auth/config'

export default function AccountPanel() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  if (!isSupabaseConfigured()) {
    return <p style={{ color: '#e2e8f0', fontSize: 12 }}>本地模式，未启用云端账号。</p>
  }

  async function logout() {
    await supabase?.auth.signOut()
    window.location.replace('/login')
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: '#e2e8f0', fontSize: 12 }}>
        {email ? `已登录：${email}` : '未登录'}
      </span>
      <button type="button" onClick={logout} style={{
        padding: '6px 14px', background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(226,185,111,0.2)', borderRadius: 8,
        color: 'rgba(226,185,111,0.7)', fontSize: 11, letterSpacing: 1, cursor: 'pointer',
      }}>退出登录</button>
    </div>
  )
}
