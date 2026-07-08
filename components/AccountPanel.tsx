'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isSupabaseConfigured } from '@/lib/auth/config'
import { fs, text, gold, border, surface, radius } from '@/lib/ui/tokens'

export default function AccountPanel() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  if (!isSupabaseConfigured()) {
    return <p style={{ color: text.primary, fontSize: fs.sub }}>本地模式，未启用云端账号。</p>
  }

  async function logout() {
    await supabase?.auth.signOut()
    window.location.replace('/login')
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: text.primary, fontSize: fs.sub }}>
        {email ? `已登录：${email}` : '未登录'}
      </span>
      <button type="button" onClick={logout} style={{
        padding: '6px 14px', background: surface.input,
        border: `1px solid ${border.goldFaint}`, borderRadius: radius.sm,
        color: gold.muted, fontSize: fs.meta, letterSpacing: 1, cursor: 'pointer',
      }}>退出登录</button>
    </div>
  )
}
