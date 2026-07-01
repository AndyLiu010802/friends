'use client'
import { generateFriendInsights } from '@/lib/insights'
import type { Friend } from '@/lib/types'

interface Props {
  friends: Friend[]
  onSelectFriend: (friendId: string) => void
}

export default function InsightPanel({ friends, onSelectFriend }: Props) {
  const insights = generateFriendInsights(friends)

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
          {insights.map(insight => (
            <button
              key={insight.id}
              type="button"
              onClick={() => onSelectFriend(insight.friendId)}
              style={{
                textAlign:'left', background:'rgba(255,255,255,0.03)',
                border:'1px solid rgba(226,185,111,0.12)', borderRadius:8,
                padding:'8px 10px', color:'#e2e8f0', fontSize:11, lineHeight:1.6,
                cursor:'pointer', fontFamily:'Noto Serif SC, serif',
              }}
            >
              {insight.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
