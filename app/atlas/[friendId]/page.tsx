'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { getFriends, getAtlasByFriendId, saveAtlas, saveFriend, deleteAtlas } from '@/lib/store'
import { pushAtlas, pushFriend } from '@/lib/supabase'
import { buildFriendAtlasContext } from '@/lib/ai/contextBuilder'
import { estimateAtlasGenerationCost } from '@/lib/ai/tokenEstimate'
import { calculateAtlasConfidence } from '@/lib/atlasConfidence'
import type { AIQualityMode } from '@/lib/ai/provider'
import type { Atlas, Friend } from '@/lib/types'
import Link from 'next/link'

const MODE_LABEL: Record<AIQualityMode, string> = { economy: '省钱模式', standard: '标准模式', premium: '最高级模式' }
const CONFIDENCE_LABEL: Record<'low' | 'medium' | 'high', string> = { low: '低', medium: '中', high: '高' }

export default function AtlasPage() {
  const { friendId } = useParams<{ friendId: string }>()
  const [friend, setFriend] = useState<Friend | null | undefined>(undefined)
  const [allFriends, setAllFriends] = useState<Friend[]>([])
  const [atlas, setAtlas] = useState<Atlas | null>(null)
  const [mode, setMode] = useState<AIQualityMode>('economy')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [premiumFailed, setPremiumFailed] = useState(false)

  useEffect(() => {
    const friends = getFriends()
    const found = friends.find(f => f.id === friendId) ?? null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFriend(found)
    setAllFriends(friends)
    setAtlas(getAtlasByFriendId(friendId) ?? null)
  }, [friendId])

  async function generate(overrideMode?: AIQualityMode) {
    if (!friend) return
    const useMode = overrideMode ?? mode
    const context = buildFriendAtlasContext(friend, allFriends)
    const estimate = estimateAtlasGenerationCost(context, useMode)

    if (estimate.estimatedCostUsd > 5) {
      if (!confirm('这次请求成本较高。建议先使用标准模式生成，或者减少传入 memories 数量。是否仍然继续？')) return
    } else if (estimate.estimatedCostUsd > 1) {
      if (!confirm('这次图鉴使用的记录较多，预计成本超过 $1。是否继续？')) return
    }

    setLoading(true)
    setError(null)
    setPremiumFailed(false)
    try {
      const res = await fetch('/api/ai/generate-atlas', {
        method: 'POST',
        body: JSON.stringify({ context, mode: useMode }),
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        if (useMode === 'premium') setPremiumFailed(true)
        else setError(data.error ?? 'AI 暂时没有回应，请稍后再试。')
        return
      }

      const newAtlas: Atlas = data.atlas
      setAtlas(newAtlas)
      try {
        deleteAtlas(friend.id)
        saveAtlas(newAtlas)
      } catch {
        setError('图鉴已生成但本地保存失败，请检查浏览器存储空间。')
        return
      }
      await pushAtlas(newAtlas).catch(() => setError('本地图鉴已保存，但云端备份失败。'))

      const updated: Friend = { ...friend, atlasId: newAtlas.id, updatedAt: new Date().toISOString() }
      setFriend(updated)
      saveFriend(updated)
      pushFriend(updated).catch(console.error)
    } catch {
      if (useMode === 'premium') setPremiumFailed(true)
      else setError('AI 暂时没有回应，请稍后再试。')
    } finally {
      setLoading(false)
    }
  }

  if (friend === undefined) {
    return (
      <main style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        background:'radial-gradient(ellipse at 20% 30%, #0d1b4b 0%, #020408 70%)' }}>
        <div style={{ color:'rgba(226,185,111,0.5)', fontSize:12, letterSpacing:2 }}>加载中...</div>
      </main>
    )
  }

  if (friend === null) {
    return (
      <main style={{ minHeight:'100vh', padding:'60px 24px 80px',
        background:'radial-gradient(ellipse at 20% 30%, #0d1b4b 0%, #020408 70%)' }}>
        <div style={{ width:'100%', maxWidth:620, margin:'0 auto' }}>
          <Link href="/" style={{ color:'rgba(226,185,111,0.5)', fontSize:11, letterSpacing:2,
            textDecoration:'none', display:'block', marginBottom:32 }}>← 返回星图</Link>
          <div style={{ color:'#e2b96f', padding:40 }}>好友不存在</div>
        </div>
      </main>
    )
  }

  const confidence = calculateAtlasConfidence(friend)
  const estimatePreview = estimateAtlasGenerationCost(buildFriendAtlasContext(friend, allFriends), mode)

  return (
    <main style={{ height:'100vh', padding:'60px 24px 80px', overflowY:'auto',
      background:'radial-gradient(ellipse at 20% 30%, #0d1b4b 0%, #020408 70%)' }}>
      <div style={{ maxWidth:620, margin:'0 auto' }}>
        <Link href="/" style={{ color:'rgba(226,185,111,0.5)', fontSize:11, letterSpacing:2,
          textDecoration:'none', display:'block', marginBottom:32 }}>← 返回星图</Link>

        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ color:'rgba(155,142,196,0.5)', fontSize:10, letterSpacing:3, marginBottom:8 }}>FRIEND ATLAS</div>
          <h1 style={{ color:'#e2b96f', fontFamily:'Ma Shan Zheng, cursive', fontSize:36, letterSpacing:6 }}>{friend.name}</h1>
          {[friend.mbti, friend.zodiac].filter(Boolean).join(' · ') && (
            <div style={{ color:'rgba(155,142,196,0.6)', fontSize:11, marginTop:6 }}>
              {[friend.mbti, friend.zodiac].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        <div style={{ display:'flex', justifyContent:'center', gap:8, marginBottom:16 }}>
          {(Object.keys(MODE_LABEL) as AIQualityMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding:'6px 16px', borderRadius:20, fontSize:11, letterSpacing:1, cursor:'pointer',
              background: mode === m ? 'rgba(226,185,111,0.2)' : 'transparent',
              border: `1px solid rgba(226,185,111,${mode === m ? 0.6 : 0.25})`,
              color: mode === m ? '#e2b96f' : 'rgba(226,185,111,0.6)',
            }}>{MODE_LABEL[m]}</button>
          ))}
        </div>

        <div style={{ textAlign:'center', color:'rgba(226,185,111,0.5)', fontSize:11, marginBottom:8 }}>
          预计本次会消耗约 {estimatePreview.estimatedInputTokens.toLocaleString()} input tokens + {estimatePreview.estimatedOutputTokens.toLocaleString()} output tokens。
          {MODE_LABEL[mode]}预计成本约 ${estimatePreview.estimatedCostUsd.toFixed(2)}。
        </div>

        <div style={{ textAlign:'center', color:'rgba(226,185,111,0.4)', fontSize:11, marginBottom:24 }}>
          图鉴可信度：{CONFIDENCE_LABEL[confidence.level]}——{confidence.reason}
        </div>

        {error && <div style={{ textAlign:'center', color:'#f87171', fontSize:12, marginBottom:16 }}>{error}</div>}

        {premiumFailed && (
          <div style={{ textAlign:'center', marginBottom:16 }}>
            <div style={{ color:'#f87171', fontSize:12, marginBottom:8 }}>最高级模型暂时不可用，是否使用标准模式重试？</div>
            <button onClick={() => generate('standard')} disabled={loading} style={{
              padding:'8px 24px', background:'rgba(226,185,111,0.1)', border:'1px solid rgba(226,185,111,0.4)',
              borderRadius:10, color:'#e2b96f', fontSize:12, cursor:'pointer' }}>{loading ? '重试中...' : '用标准模式重试'}</button>
          </div>
        )}

        {!atlas && (
          <div style={{ textAlign:'center' }}>
            <button onClick={() => generate()} disabled={loading} style={{
              padding:'14px 40px', background:'rgba(226,185,111,0.1)',
              border:'1px solid rgba(226,185,111,0.4)', borderRadius:14,
              color:'#e2b96f', fontSize:13, letterSpacing:2, cursor:'pointer',
            }}>{loading ? '✦ 生成中...' : '✦ 生成图鉴'}</button>
          </div>
        )}

        {atlas && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            <div style={{ textAlign:'center', color:'rgba(226,185,111,0.4)', fontSize:10 }}>
              由 {atlas.model} 生成于 {new Date(atlas.generatedAt).toLocaleString()}
            </div>

            {[
              { label:'人物总结', content: atlas.summary },
              { label:'你生活中的位置', content: atlas.roleInMyLife },
              { label:'最近互动', content: atlas.recentInteractionInsight },
              { label:'关系趋势', content: atlas.relationshipTrend },
            ].map(({ label, content }) => (
              <section key={label} style={{ background:'rgba(226,185,111,0.04)', border:'1px solid rgba(226,185,111,0.15)',
                borderRadius:14, padding:'20px 24px' }}>
                <div style={{ color:'rgba(226,185,111,0.6)', fontSize:10, letterSpacing:3, marginBottom:10 }}>✦ {label}</div>
                <p style={{ color:'#e2e8f0', fontSize:13, lineHeight:2 }}>{content}</p>
              </section>
            ))}

            {[
              { label:'值得记住的细节', items: atlas.keyDetailsToRemember },
              { label:'下次可以聊的话题', items: atlas.conversationTopics },
              { label:'适合一起做的活动', items: atlas.suitableActivities },
            ].map(({ label, items }) => items.length > 0 && (
              <section key={label} style={{ background:'rgba(226,185,111,0.04)', border:'1px solid rgba(226,185,111,0.15)',
                borderRadius:14, padding:'20px 24px' }}>
                <div style={{ color:'rgba(226,185,111,0.6)', fontSize:10, letterSpacing:3, marginBottom:12 }}>✦ {label}</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {items.map(item => (
                    <span key={item} style={{ padding:'4px 12px', border:'1px solid rgba(226,185,111,0.25)',
                      borderRadius:20, color:'#e2b96f', fontSize:11 }}>{item}</span>
                  ))}
                </div>
              </section>
            ))}

            <section style={{ background:'rgba(226,185,111,0.04)', border:'1px solid rgba(226,185,111,0.15)', borderRadius:14, padding:'20px 24px' }}>
              <div style={{ color:'rgba(226,185,111,0.6)', fontSize:10, letterSpacing:3, marginBottom:12 }}>✦ 礼物建议</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {atlas.giftIdeas.map(g => (
                  <span key={g} style={{ padding:'4px 12px', border:'1px solid rgba(226,185,111,0.25)', borderRadius:20, color:'#e2b96f', fontSize:11 }}>{g}</span>
                ))}
              </div>
            </section>

            <section style={{ background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:14, padding:'20px 24px' }}>
              <div style={{ color:'rgba(239,68,68,0.6)', fontSize:10, letterSpacing:3, marginBottom:12 }}>⚠ 相处注意</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {atlas.warnings.map(w => (
                  <span key={w} style={{ padding:'4px 12px', border:'1px solid rgba(239,68,68,0.2)', borderRadius:20, color:'rgba(252,165,165,0.8)', fontSize:11 }}>{w}</span>
                ))}
              </div>
            </section>

            <div style={{ textAlign:'center', marginTop:8 }}>
              <button onClick={() => generate()} disabled={loading} style={{
                padding:'8px 24px', background:'none',
                border:'1px solid rgba(226,185,111,0.2)', borderRadius:10,
                color:'rgba(226,185,111,0.5)', fontSize:10, letterSpacing:1, cursor:'pointer',
              }}>{loading ? '✦ 生成中...' : '重新生成'}</button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
