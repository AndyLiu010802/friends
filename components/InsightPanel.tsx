'use client'
import { useState } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { fs, text, gold, purple, border, surface, radius, font } from '@/lib/ui/tokens'
import type { FriendInsight } from '@/lib/insights'

interface Props {
  insights: FriendInsight[]
  onSelectFriend: (friendId: string) => void
  onQuickNote: (friendId: string) => void
  onDismiss: (insight: FriendInsight) => void
}

const GROUPS: { priority: 1 | 2 | 3; title: string }[] = [
  { priority: 3, title: '今天必看' },
  { priority: 2, title: '值得留意' },
  { priority: 1, title: '顺手补全' },
]

export default function InsightPanel({ insights, onSelectFriend, onQuickNote, onDismiss }: Props) {
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(false)

  const actionBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: fs.meta, letterSpacing: 1, padding: '2px 6px', fontFamily: font.serif,
  }

  const insightRow = (insight: FriendInsight) => (
    <div key={insight.id} style={{
      background: surface.raise, border: `1px solid ${border.goldFaint}`,
      borderRadius: radius.sm, padding: isMobile ? '12px 12px' : '8px 10px',
    }}>
      <div style={{ color: text.primary, fontSize: fs.sub, lineHeight: 1.6, fontFamily: font.serif }}>
        {insight.text}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <button type="button" style={{ ...actionBtn, color: gold.base }}
          onClick={() => { onQuickNote(insight.friendId); setExpanded(false) }}>✎ 记一笔</button>
        <button type="button" style={{ ...actionBtn, color: gold.muted }}
          onClick={() => { onSelectFriend(insight.friendId); setExpanded(false) }}>去看看</button>
        {insight.dismissible && (
          <button type="button" style={{ ...actionBtn, color: purple.muted, marginLeft: 'auto' }}
            onClick={() => onDismiss(insight)}>知道了</button>
        )}
      </div>
    </div>
  )

  const groupedList = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {GROUPS.map(g => {
        const items = insights.filter(i => i.priority === g.priority)
        if (items.length === 0) return null
        return (
          <div key={g.priority}>
            <div style={{ color: gold.muted, fontSize: fs.meta, letterSpacing: 2, marginBottom: 8 }}>
              {g.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(insightRow)}
            </div>
          </div>
        )
      })}
    </div>
  )

  if (isMobile) {
    if (insights.length === 0) return null
    if (!expanded) {
      return (
        <button type="button" onClick={() => setExpanded(true)} style={{
          position: 'fixed', left: 16, bottom: 'calc(16px + env(safe-area-inset-bottom))',
          zIndex: 25, minHeight: 44,
          background: surface.card, border: `1px solid ${border.gold}`,
          borderRadius: radius.pill, padding: '10px 18px', backdropFilter: 'blur(12px)',
          color: gold.base, fontSize: fs.meta, letterSpacing: 2, cursor: 'pointer',
          fontFamily: font.serif,
        }}>
          ✦ 星语提醒 · {insights.length}
        </button>
      )
    }
    return (
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 25,
        background: surface.card, border: `1px solid ${border.gold}`,
        borderRadius: `${radius.lg}px ${radius.lg}px 0 0`, padding: '16px 18px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        backdropFilter: 'blur(12px)', maxHeight: '50vh', overflowY: 'auto',
        animation: 'youji-sheet-in .25s ease-out',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ color: gold.base, fontSize: fs.meta, letterSpacing: 2 }}>星语提醒</span>
          <button type="button" onClick={() => setExpanded(false)} style={{
            background: 'none', border: 'none', color: gold.muted,
            cursor: 'pointer', fontSize: fs.body, padding: '4px 8px',
          }}>✕</button>
        </div>
        {groupedList}
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', right: 24, bottom: 24, zIndex: 25, width: 300,
      background: surface.card, border: `1px solid ${border.gold}`,
      borderRadius: radius.md, padding: '16px 18px', backdropFilter: 'blur(12px)',
      maxHeight: '60vh', overflowY: 'auto',
    }}>
      <div style={{ color: gold.base, fontSize: fs.meta, letterSpacing: 2, marginBottom: 12 }}>星语提醒</div>
      {insights.length === 0 ? (
        <div style={{ color: purple.muted, fontSize: fs.sub, lineHeight: 1.6 }}>
          今天的朋友宇宙很安静。
        </div>
      ) : groupedList}
    </div>
  )
}
