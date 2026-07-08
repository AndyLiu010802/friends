'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { isSupabaseConfigured } from '@/lib/auth/config'
import { fs, text, gold, danger, border, surface, radius, font } from '@/lib/ui/tokens'

const wrap: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24, background: 'radial-gradient(ellipse at 20% 30%, #0d1b4b 0%, #020408 70%)',
}
const card: React.CSSProperties = {
  width: '100%', maxWidth: 360, padding: '32px 28px', borderRadius: radius.lg,
  background: surface.section, border: `1px solid ${border.goldFaint}`,
}
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', marginTop: 6, borderRadius: radius.sm,
  background: surface.input, border: `1px solid ${border.goldFaint}`,
  color: text.primary, fontSize: fs.body,
}
const label: React.CSSProperties = {
  display: 'block', color: gold.muted, fontSize: fs.meta, letterSpacing: 3, marginBottom: 14,
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isSupabaseConfigured()) {
    return (
      <main style={wrap}>
        <div style={card}>
          <h1 style={{ color: gold.base, fontFamily: font.hand, fontSize: fs.display, letterSpacing: 4, marginBottom: 16 }}>✦ 友记</h1>
          <p style={{ color: text.primary, fontSize: fs.sub, lineHeight: 2, marginBottom: 16 }}>当前为本地模式，无需登录。</p>
          <Link href="/" style={{ color: gold.base, fontSize: fs.sub, letterSpacing: 1 }}>进入星图 →</Link>
        </div>
      </main>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || busy) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (err) {
      setError('登录失败：邮箱或密码不正确。')
      return
    }
    // 整页跳转（而非客户端路由），让 proxy 门禁读到新写入的会话 cookie。
    window.location.replace('/')
  }

  return (
    <main style={wrap}>
      <form style={card} onSubmit={handleSubmit}>
        <h1 style={{ color: gold.base, fontFamily: font.hand, fontSize: fs.display, letterSpacing: 4, marginBottom: 20 }}>✦ 友记</h1>
        <label style={label}>邮箱
          <input style={inp} type="email" value={email} autoComplete="email"
            onChange={e => setEmail(e.target.value)} required />
        </label>
        <label style={label}>密码
          <input style={inp} type="password" value={password} autoComplete="current-password"
            onChange={e => setPassword(e.target.value)} required />
        </label>
        {error && <p style={{ color: danger.text, fontSize: fs.meta, marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{
          width: '100%', padding: '10px 0', borderRadius: radius.sm, cursor: 'pointer',
          background: surface.chip, border: `1px solid ${border.goldStrong}`,
          color: gold.base, fontSize: fs.sub, letterSpacing: 4,
        }}>{busy ? '登录中…' : '登录'}</button>
      </form>
    </main>
  )
}
