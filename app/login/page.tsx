'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { isSupabaseConfigured } from '@/lib/auth/config'

const wrap: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24, background: 'radial-gradient(ellipse at 20% 30%, #0d1b4b 0%, #020408 70%)',
}
const card: React.CSSProperties = {
  width: '100%', maxWidth: 360, padding: '32px 28px', borderRadius: 14,
  background: 'rgba(226,185,111,0.04)', border: '1px solid rgba(226,185,111,0.15)',
}
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', marginTop: 6, borderRadius: 8,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(226,185,111,0.2)',
  color: '#e2e8f0', fontSize: 13,
}
const label: React.CSSProperties = {
  display: 'block', color: 'rgba(226,185,111,0.6)', fontSize: 10, letterSpacing: 3, marginBottom: 14,
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
          <h1 style={{ color: '#e2b96f', fontFamily: 'Ma Shan Zheng, cursive', fontSize: 26, letterSpacing: 4, marginBottom: 16 }}>✦ 友记</h1>
          <p style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 2, marginBottom: 16 }}>当前为本地模式，无需登录。</p>
          <Link href="/" style={{ color: '#e2b96f', fontSize: 12, letterSpacing: 1 }}>进入星图 →</Link>
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
        <h1 style={{ color: '#e2b96f', fontFamily: 'Ma Shan Zheng, cursive', fontSize: 26, letterSpacing: 4, marginBottom: 20 }}>✦ 友记</h1>
        <label style={label}>邮箱
          <input style={inp} type="email" value={email} autoComplete="email"
            onChange={e => setEmail(e.target.value)} required />
        </label>
        <label style={label}>密码
          <input style={inp} type="password" value={password} autoComplete="current-password"
            onChange={e => setPassword(e.target.value)} required />
        </label>
        {error && <p style={{ color: 'rgba(252,165,165,0.9)', fontSize: 11, marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{
          width: '100%', padding: '10px 0', borderRadius: 8, cursor: 'pointer',
          background: 'rgba(226,185,111,0.12)', border: '1px solid rgba(226,185,111,0.4)',
          color: '#e2b96f', fontSize: 13, letterSpacing: 4,
        }}>{busy ? '登录中…' : '登录'}</button>
      </form>
    </main>
  )
}
