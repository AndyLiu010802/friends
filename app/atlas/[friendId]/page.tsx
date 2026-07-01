'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { getFriends, getAtlasByFriendId, saveAtlas, saveFriend } from '@/lib/store'
import { pushAtlas, pushFriend } from '@/lib/supabase'
import type { Atlas, Friend } from '@/lib/types'
import Link from 'next/link'

export default function AtlasPage() {
  const { friendId } = useParams<{ friendId: string }>()
  const [friend, setFriend] = useState<Friend | null | undefined>(undefined)
  const [atlas,   setAtlas]   = useState<Atlas | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const found = getFriends().find(f => f.id === friendId) ?? null
    // One-time client-only localStorage read keyed on friendId; not a subscription to an
    // external system, and there's no render-time alternative since localStorage doesn't
    // exist during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFriend(found)
    setAtlas(getAtlasByFriendId(friendId) ?? null)
  }, [friendId])

  async function generate() {
    if (!friend) return
    setLoading(true)
    try {
      const res  = await fetch('/api/generate-atlas', { method:'POST', body:JSON.stringify(friend), headers:{'Content-Type':'application/json'} })
      const data: Atlas = await res.json()
      saveAtlas(data)
      await pushAtlas(data).catch(console.error)
      setAtlas(data)

      const updated: Friend = { ...friend, atlasId: data.id, updatedAt: new Date().toISOString() }
      setFriend(updated)
      saveFriend(updated)
      pushFriend(updated).catch(console.error)
    } finally {
      setLoading(false)
    }
  }

  if (friend === undefined) {
    return (
      <main style={{
        minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        background:'radial-gradient(ellipse at 20% 30%, #0d1b4b 0%, #020408 70%)',
      }}>
        <div style={{ color:'rgba(226,185,111,0.5)', fontSize:12, letterSpacing:2 }}>加载中...</div>
      </main>
    )
  }

  if (friend === null) {
    return (
      <main style={{
        minHeight:'100vh', padding:'60px 24px 80px',
        background:'radial-gradient(ellipse at 20% 30%, #0d1b4b 0%, #020408 70%)',
      }}>
        <div style={{ width:'100%', maxWidth:620, margin:'0 auto' }}>
          <Link href="/" style={{ color:'rgba(226,185,111,0.5)', fontSize:11, letterSpacing:2,
            textDecoration:'none', display:'block', marginBottom:32 }}>← 返回星图</Link>
          <div style={{color:'#e2b96f',padding:40}}>好友不存在</div>
        </div>
      </main>
    )
  }

  return (
    <main style={{
      height:'100vh', padding:'60px 24px 80px', overflowY:'auto',
      background:'radial-gradient(ellipse at 20% 30%, #0d1b4b 0%, #020408 70%)',
    }}>
      <div style={{ maxWidth:620, margin:'0 auto' }}>
        <Link href="/" style={{ color:'rgba(226,185,111,0.5)', fontSize:11, letterSpacing:2,
          textDecoration:'none', display:'block', marginBottom:32 }}>← 返回星图</Link>

        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ color:'rgba(155,142,196,0.5)', fontSize:10, letterSpacing:3, marginBottom:8 }}>FRIEND ATLAS</div>
          <h1 style={{ color:'#e2b96f', fontFamily:'Ma Shan Zheng, cursive', fontSize:36, letterSpacing:6 }}>{friend.name}</h1>
          {[friend.mbti, friend.zodiac].filter(Boolean).join(' · ') && (
            <div style={{ color:'rgba(155,142,196,0.6)', fontSize:11, marginTop:6 }}>
              {[friend.mbti, friend.zodiac].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        {!atlas && (
          <div style={{ textAlign:'center' }}>
            <button onClick={generate} disabled={loading} style={{
              padding:'14px 40px', background:'rgba(226,185,111,0.1)',
              border:'1px solid rgba(226,185,111,0.4)', borderRadius:14,
              color:'#e2b96f', fontSize:13, letterSpacing:2, cursor:'pointer',
            }}>
              {loading ? '✦ 生成中...' : '✦ 生成图鉴'}
            </button>
          </div>
        )}

        {atlas && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            {[
              { label:'人物总结', content: atlas.summary },
              { label:'你生活中的位置', content: atlas.roleInMyLife },
              { label:'关系趋势', content: atlas.relationshipTrend },
            ].map(({ label, content }) => (
              <section key={label} style={{
                background:'rgba(226,185,111,0.04)', border:'1px solid rgba(226,185,111,0.15)',
                borderRadius:14, padding:'20px 24px',
              }}>
                <div style={{ color:'rgba(226,185,111,0.6)', fontSize:10, letterSpacing:3, marginBottom:10 }}>✦ {label}</div>
                <p style={{ color:'#e2e8f0', fontSize:13, lineHeight:2 }}>{content}</p>
              </section>
            ))}

            <section style={{ background:'rgba(226,185,111,0.04)', border:'1px solid rgba(226,185,111,0.15)', borderRadius:14, padding:'20px 24px' }}>
              <div style={{ color:'rgba(226,185,111,0.6)', fontSize:10, letterSpacing:3, marginBottom:12 }}>✦ 礼物建议</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {atlas.giftIdeas.map(g=>(
                  <span key={g} style={{ padding:'4px 12px', border:'1px solid rgba(226,185,111,0.25)', borderRadius:20, color:'#e2b96f', fontSize:11 }}>{g}</span>
                ))}
              </div>
            </section>

            <section style={{ background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:14, padding:'20px 24px' }}>
              <div style={{ color:'rgba(239,68,68,0.6)', fontSize:10, letterSpacing:3, marginBottom:12 }}>⚠ 相处注意</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {atlas.warnings.map(w=>(
                  <span key={w} style={{ padding:'4px 12px', border:'1px solid rgba(239,68,68,0.2)', borderRadius:20, color:'rgba(252,165,165,0.8)', fontSize:11 }}>{w}</span>
                ))}
              </div>
            </section>

            <div style={{ textAlign:'center', marginTop:8 }}>
              <button onClick={generate} disabled={loading} style={{
                padding:'8px 24px', background:'none',
                border:'1px solid rgba(226,185,111,0.2)', borderRadius:10,
                color:'rgba(226,185,111,0.5)', fontSize:10, letterSpacing:1, cursor:'pointer',
              }}>重新生成</button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
