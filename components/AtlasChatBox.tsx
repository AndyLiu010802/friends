'use client'
import { useState, useEffect } from 'react'
import { getAtlasChatByFriendId, saveAtlasChat } from '@/lib/store'
import { saveAtlasChatRemote } from '@/lib/supabase'
import { buildFriendAtlasContext } from '@/lib/ai/contextBuilder'
import { estimateAtlasQuestionCost } from '@/lib/ai/tokenEstimate'
import type { AIQualityMode } from '@/lib/ai/provider'
import type { Atlas, AtlasChatMessage, Friend } from '@/lib/types'

const PLACEHOLDER = '比如：我下次见 TA 可以聊什么？'

export default function AtlasChatBox({
  friend, allFriends, atlas, mode,
}: {
  friend: Friend
  allFriends: Friend[]
  atlas: Atlas
  mode: AIQualityMode
}) {
  const [messages, setMessages] = useState<AtlasChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(getAtlasChatByFriendId(friend.id)?.messages ?? [])
  }, [friend.id])

  async function send() {
    const trimmed = question.trim()
    if (!trimmed) return

    const context = buildFriendAtlasContext(friend, allFriends, trimmed)
    const recentMessages = messages.slice(-8)
    const estimate = estimateAtlasQuestionCost({ context, atlas, recentMessages, question: trimmed, mode })

    if (estimate.estimatedCostUsd > 1) {
      if (!confirm('这次图鉴使用的记录较多，预计成本超过 $1。是否继续？')) return
    }

    const userMessage: AtlasChatMessage = {
      id: crypto.randomUUID(), role: 'user', content: trimmed, createdAt: new Date().toISOString(),
    }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setQuestion('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/ask-atlas', {
        method: 'POST',
        body: JSON.stringify({ context, atlas, messages: recentMessages, question: trimmed, mode }),
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setError(data.error ?? 'AI 暂时没有回应，请稍后再试。')
        return
      }

      const assistantMessage: AtlasChatMessage = {
        id: crypto.randomUUID(), role: 'assistant', content: data.answer,
        createdAt: new Date().toISOString(), evidence: data.evidence,
      }
      const finalMessages = [...nextMessages, assistantMessage]
      setMessages(finalMessages)

      const existing = getAtlasChatByFriendId(friend.id)
      const chat = {
        id: existing?.id ?? crypto.randomUUID(),
        friendId: friend.id,
        messages: finalMessages,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      saveAtlasChat(chat)
      saveAtlasChatRemote(chat).catch(console.error)
    } catch {
      setError('AI 暂时没有回应，请稍后再试。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section style={{ background:'rgba(226,185,111,0.04)', border:'1px solid rgba(226,185,111,0.15)', borderRadius:14, padding:'20px 24px' }}>
      <div style={{ color:'rgba(226,185,111,0.6)', fontSize:10, letterSpacing:3, marginBottom:12 }}>✦ 问问这颗星星...</div>

      <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:16, maxHeight:320, overflowY:'auto' }}>
        {messages.map(m => (
          <div key={m.id} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth:'85%', padding:'8px 14px', borderRadius:12, fontSize:12, lineHeight:1.8,
            background: m.role === 'user' ? 'rgba(226,185,111,0.15)' : 'rgba(155,142,196,0.1)',
            color: m.role === 'user' ? '#e2b96f' : '#e2e8f0',
          }}>{m.content}</div>
        ))}
      </div>

      {error && <div style={{ color:'#f87171', fontSize:11, marginBottom:8 }}>{error}</div>}

      <div style={{ display:'flex', gap:8 }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && send()}
          placeholder={PLACEHOLDER}
          style={{ flex:1, padding:'8px 12px', borderRadius:10, border:'1px solid rgba(226,185,111,0.25)',
            background:'rgba(13,20,40,0.6)', color:'#e2e8f0', fontSize:12 }}
        />
        <button onClick={send} disabled={loading} style={{
          padding:'8px 20px', background:'rgba(226,185,111,0.1)', border:'1px solid rgba(226,185,111,0.4)',
          borderRadius:10, color:'#e2b96f', fontSize:12, cursor:'pointer' }}>{loading ? '...' : '发送'}</button>
      </div>
    </section>
  )
}
