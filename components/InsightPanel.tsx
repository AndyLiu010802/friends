'use client'
import { useState } from 'react'
import { generateFriendInsights } from '@/lib/insights'
import { useIsMobile } from '@/lib/useIsMobile'
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
        textAlign:'left', background:'rgba(255,255,255,0.03)',
        border:'1px solid rgba(226,185,111,0.12)', borderRadius:8,
        padding: isMobile ? '12px 12px' : '8px 10px',
        color:'#e2e8f0', fontSize:11, lineHeight:1.6,
        cursor:'pointer', fontFamily:'Noto Serif SC, serif',
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
          background:'rgba(4,7,20,0.9)', border:'1px solid rgba(226,185,111,0.3)',
          borderRadius:22, padding:'10px 18px', backdropFilter:'blur(12px)',
          color:'#e2b96f', fontSize:12, letterSpacing:2, cursor:'pointer',
          fontFamily:'Noto Serif SC, serif',
        }}>
          ✦ 今日星象 · {insights.length}
        </button>
      )
    }
    return (
      <div style={{
        position:'fixed', left:0, right:0, bottom:0, zIndex:25,
        background:'rgba(4,7,20,0.94)', border:'1px solid rgba(226,185,111,0.3)',
        borderRadius:'16px 16px 0 0', padding:'16px 18px',
        paddingBottom:'calc(16px + env(safe-area-inset-bottom))',
        backdropFilter:'blur(12px)', maxHeight:'50vh', overflowY:'auto',
        animation:'youji-sheet-in .25s ease-out',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <span style={{ color:'#e2b96f', fontSize:12, letterSpacing:2 }}>今日星象</span>
          <button type="button" onClick={() => setExpanded(false)} style={{
            background:'none', border:'none', color:'rgba(226,185,111,0.5)',
            cursor:'pointer', fontSize:14, padding:'4px 8px',
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
      background:'rgba(4,7,20,0.9)', border:'1px solid rgba(226,185,111,0.3)',
      borderRadius:12, padding:'16px 18px', backdropFilter:'blur(12px)',
    }}>
      <div style={{ color:'#e2b96f', fontSize:12, letterSpacing:2, marginBottom:12 }}>今日星象</div>

      {insights.length === 0 ? (
        <div style={{ color:'rgba(155,142,196,0.6)', fontSize:11, lineHeight:1.6 }}>
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
