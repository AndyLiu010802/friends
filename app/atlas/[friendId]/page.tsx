'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { getFriends, getAtlasByFriendId, saveAtlas, saveFriend, deleteAtlas } from '@/lib/store'
import { pushAtlas, pushFriend } from '@/lib/supabase'
import { buildFriendAtlasContext } from '@/lib/ai/contextBuilder'
import { estimateAtlasGenerationCost } from '@/lib/ai/tokenEstimate'
import { calculateAtlasConfidence } from '@/lib/atlasConfidence'
import type { Atlas, Friend } from '@/lib/types'
import Link from 'next/link'
import AtlasChatBox from '@/components/AtlasChatBox'
import { fs, text, gold, purple, danger, border, surface, radius, font } from '@/lib/ui/tokens'

const CONFIDENCE_LABEL: Record<'low' | 'medium' | 'high', string> = { low: '低', medium: '中', high: '高' }

export default function AtlasPage() {
  const { friendId } = useParams<{ friendId: string }>()
  const [friend, setFriend] = useState<Friend | null | undefined>(undefined)
  const [allFriends, setAllFriends] = useState<Friend[]>([])
  const [atlas, setAtlas] = useState<Atlas | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const friends = getFriends()
    const found = friends.find(f => f.id === friendId) ?? null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFriend(found)
    setAllFriends(friends)
    setAtlas(getAtlasByFriendId(friendId) ?? null)
  }, [friendId])

  async function generate() {
    if (!friend) return
    const context = buildFriendAtlasContext(friend, allFriends)
    const estimate = estimateAtlasGenerationCost(context)

    if (estimate.estimatedCostUsd > 5) {
      if (!confirm('这次请求成本较高。建议减少传入 memories 数量。是否仍然继续？')) return
    } else if (estimate.estimatedCostUsd > 1) {
      if (!confirm('这次图鉴使用的记录较多，预计成本超过 $1。是否继续？')) return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/generate-atlas', {
        method: 'POST',
        body: JSON.stringify({ context }),
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setError(data.error ?? 'AI 暂时没有回应，请稍后再试。')
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
      setError('AI 暂时没有回应，请稍后再试。')
    } finally {
      setLoading(false)
    }
  }

  if (friend === undefined) {
    return (
      <main style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        background:'radial-gradient(ellipse at 20% 30%, #0d1b4b 0%, #020408 70%)' }}>
        <div style={{ color: gold.muted, fontSize: fs.meta, letterSpacing:2 }}>加载中...</div>
      </main>
    )
  }

  if (friend === null) {
    return (
      <main style={{ minHeight:'100vh', padding:'60px 24px 80px',
        background:'radial-gradient(ellipse at 20% 30%, #0d1b4b 0%, #020408 70%)' }}>
        <div style={{ width:'100%', maxWidth:620, margin:'0 auto' }}>
          <Link href="/" style={{ color: gold.muted, fontSize: fs.meta, letterSpacing:2,
            textDecoration:'none', display:'block', marginBottom:32 }}>← 返回星图</Link>
          <div style={{ color: gold.base, padding:40 }}>好友不存在</div>
        </div>
      </main>
    )
  }

  const confidence = calculateAtlasConfidence(friend)
  const estimatePreview = estimateAtlasGenerationCost(buildFriendAtlasContext(friend, allFriends))

  return (
    <main style={{ height:'100vh', padding:'60px 24px 80px', overflowY:'auto',
      background:'radial-gradient(ellipse at 20% 30%, #0d1b4b 0%, #020408 70%)' }}>
      <div style={{ maxWidth:620, margin:'0 auto' }}>
        <Link href="/" style={{ color: gold.muted, fontSize: fs.meta, letterSpacing:2,
          textDecoration:'none', display:'block', marginBottom:32 }}>← 返回星图</Link>

        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ color: purple.muted, fontSize: fs.eyebrow, letterSpacing:3, marginBottom:8 }}>FRIEND ATLAS</div>
          <h1 style={{ color: gold.base, fontFamily: font.hand, fontSize: fs.hero, letterSpacing:6 }}>{friend.name}</h1>
          {[friend.mbti, friend.zodiac].filter(Boolean).join(' · ') && (
            <div style={{ color: purple.muted, fontSize: fs.meta, marginTop:6 }}>
              {[friend.mbti, friend.zodiac].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        <div style={{ textAlign:'center', color: text.faint, fontSize: fs.meta, marginBottom:8 }}>
          预计本次会消耗约 {estimatePreview.estimatedInputTokens.toLocaleString()} input tokens + {estimatePreview.estimatedOutputTokens.toLocaleString()} output tokens，预计成本约 ${estimatePreview.estimatedCostUsd.toFixed(2)}。
        </div>

        <div style={{ textAlign:'center', color: text.faint, fontSize: fs.meta, marginBottom:24 }}>
          图鉴可信度：{CONFIDENCE_LABEL[confidence.level]}——{confidence.reason}
        </div>

        {error && <div style={{ textAlign:'center', color: danger.text, fontSize: fs.sub, marginBottom:16 }}>{error}</div>}

        {!atlas && (
          <div style={{ textAlign:'center' }}>
            <button onClick={generate} disabled={loading} style={{
              padding:'14px 40px', background: surface.chip,
              border:`1px solid ${border.goldStrong}`, borderRadius: radius.lg,
              color: gold.base, fontSize: fs.sub, letterSpacing:2, cursor:'pointer',
            }}>{loading ? '✦ 生成中...' : '✦ 生成图鉴'}</button>
          </div>
        )}

        {atlas && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            <div style={{ textAlign:'center', color: text.faint, fontSize: fs.meta }}>
              由 {atlas.model} 生成于 {new Date(atlas.generatedAt).toLocaleString()}
            </div>

            {[
              { label:'人物总结', content: atlas.summary },
              { label:'你生活中的位置', content: atlas.roleInMyLife },
              { label:'最近互动', content: atlas.recentInteractionInsight },
              { label:'关系趋势', content: atlas.relationshipTrend },
            ].map(({ label, content }) => (
              <section key={label} style={{ background: surface.section, border:`1px solid ${border.goldFaint}`,
                borderRadius: radius.lg, padding:'20px 24px' }}>
                <div style={{ color: gold.muted, fontSize: fs.meta, letterSpacing:3, marginBottom:10 }}>✦ {label}</div>
                <p style={{ color: text.primary, fontSize: fs.body, lineHeight:2 }}>{content}</p>
              </section>
            ))}

            {[
              { label:'值得记住的细节', items: atlas.keyDetailsToRemember },
              { label:'下次可以聊的话题', items: atlas.conversationTopics },
              { label:'适合一起做的活动', items: atlas.suitableActivities },
            ].map(({ label, items }) => items.length > 0 && (
              <section key={label} style={{ background: surface.section, border:`1px solid ${border.goldFaint}`,
                borderRadius: radius.lg, padding:'20px 24px' }}>
                <div style={{ color: gold.muted, fontSize: fs.meta, letterSpacing:3, marginBottom:12 }}>✦ {label}</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {items.map(item => (
                    <span key={item} style={{ padding:'4px 12px', border:`1px solid ${border.gold}`,
                      borderRadius: radius.pill, color: gold.base, fontSize: fs.meta }}>{item}</span>
                  ))}
                </div>
              </section>
            ))}

            <section style={{ background: surface.section, border:`1px solid ${border.goldFaint}`, borderRadius: radius.lg, padding:'20px 24px' }}>
              <div style={{ color: gold.muted, fontSize: fs.meta, letterSpacing:3, marginBottom:12 }}>✦ 礼物建议</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {atlas.giftIdeas.map(g => (
                  <span key={g} style={{ padding:'4px 12px', border:`1px solid ${border.gold}`, borderRadius: radius.pill, color: gold.base, fontSize: fs.meta }}>{g}</span>
                ))}
              </div>
            </section>

            <section style={{ background: danger.bg, border:`1px solid ${danger.borderFaint}`, borderRadius: radius.lg, padding:'20px 24px' }}>
              <div style={{ color: danger.text, fontSize: fs.meta, letterSpacing:3, marginBottom:12 }}>⚠ 相处注意</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {atlas.warnings.map(w => (
                  <span key={w} style={{ padding:'4px 12px', border:`1px solid ${danger.border}`, borderRadius: radius.pill, color: danger.text, fontSize: fs.meta }}>{w}</span>
                ))}
              </div>
            </section>

            {(atlas.missingInfoQuestions?.length ?? 0) > 0 && (
              <section style={{ background:'rgba(155,142,196,0.05)', border:`1px solid ${border.purple}`,
                borderRadius: radius.lg, padding:'20px 24px' }}>
                <div style={{ color: purple.base, fontSize: fs.meta, letterSpacing:3, marginBottom:12 }}>
                  ✧ 补充这些，图鉴会更准
                </div>
                <ul style={{ margin:0, paddingLeft:18, display:'flex', flexDirection:'column', gap:8 }}>
                  {atlas.missingInfoQuestions!.map(q => (
                    <li key={q} style={{ color: text.dim, fontSize: fs.sub, lineHeight:1.8 }}>{q}</li>
                  ))}
                </ul>
              </section>
            )}

            <AtlasChatBox friend={friend} allFriends={allFriends} atlas={atlas} />

            <div style={{ textAlign:'center', marginTop:8 }}>
              <button onClick={generate} disabled={loading} style={{
                padding:'8px 24px', background:'none',
                border:`1px solid ${border.goldFaint}`, borderRadius: radius.sm,
                color: gold.muted, fontSize: fs.meta, letterSpacing:1, cursor:'pointer',
              }}>{loading ? '✦ 生成中...' : '重新生成'}</button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
