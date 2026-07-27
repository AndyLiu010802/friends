'use client'
import { useState } from 'react'
import { generateFriendInsights } from '@/lib/insights'
import { useIsMobile } from '@/lib/useIsMobile'
import { fs, text, gold, purple, border, surface, radius, font } from '@/lib/ui/tokens'
import type { Friend } from '@/lib/types'

interface Props {
  friends: Friend[]
  onSelectFriend: (friendId: string) => void
}

export default function InsightPanel({ friends, onSelectFriend }: Props) {
  const insights = generateFriendInsights(friends)
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(false)

  const insightButton = (insight: { id: string; friendId: string; text: string }) => (
    <button
      key={insight.id}
      type="button"
      onClick={() => { onSelectFriend(insight.friendId); setExpanded(false) }}
      style={{
        textAlign:'left', background: surface.raise,
        border:`1px solid ${border.goldFaint}`, borderRadius: radius.sm,
        padding: isMobile ? '12px 12px' : '8px 10px',
        color: text.primary, fontSize: fs.sub, lineHeight:1.6,
        cursor:'pointer', fontFamily: font.serif,
      }}
    >
      {insight.text}
    </button>
  )

  if (isMobile) {
    if (insights.length === 0) return null
    if (!expanded) {
      return (
        <button type="button" onClick={() => setExpanded(true)} style={{
          position:'fixed', left:16, bottom:'calc(16px + env(safe-area-inset-bottom))',
          zIndex:25, minHeight:44,
          background: surface.card, border:`1px solid ${border.gold}`,
          borderRadius: radius.pill, padding:'10px 18px', backdropFilter:'blur(12px)',
          color: gold.base, fontSize: fs.meta, letterSpacing:2, cursor:'pointer',
          fontFamily: font.serif,
        }}>
          ✦ 今日星象 · {insights.length}
        </button>
      )
    }
    return (
      <div style={{
        position:'fixed', left:0, right:0, bottom:0, zIndex:25,
        background: surface.card, border:`1px solid ${border.gold}`,
        borderRadius:`${radius.lg}px ${radius.lg}px 0 0`, padding:'16px 18px',
        paddingBottom:'calc(16px + env(safe-area-inset-bottom))',
        backdropFilter:'blur(12px)', maxHeight:'50vh', overflowY:'auto',
        animation:'youji-sheet-in .25s ease-out',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <span style={{ color: gold.base, fontSize: fs.meta, letterSpacing:2 }}>今日星象</span>
          <button type="button" onClick={() => setExpanded(false)} style={{
            background:'none', border:'none', color: gold.muted,
            cursor:'pointer', fontSize: fs.body, padding:'4px 8px',
          }}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {insights.map(insightButton)}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position:'fixed', right:24, bottom:24, zIndex:25, width:280,
      background: surface.card, border:`1px solid ${border.gold}`,
      borderRadius: radius.md, padding:'16px 18px', backdropFilter:'blur(12px)',
    }}>
      <div style={{ color: gold.base, fontSize: fs.meta, letterSpacing:2, marginBottom:12 }}>今日星象</div>

      {insights.length === 0 ? (
        <div style={{ color: purple.muted, fontSize: fs.sub, lineHeight:1.6 }}>
          今天的朋友宇宙很安静。
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {insights.map(insightButton)}
        </div>
      )}
    </div>
  )
}
