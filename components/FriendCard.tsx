import type { CSSProperties } from 'react'
import type { Friend } from '@/lib/types'
import Link from 'next/link'

interface Props { friend: Friend; style?: CSSProperties }

export default function FriendCard({ friend, style }: Props) {
  return (
    <div style={{
      position:'fixed', zIndex:20, minWidth:160,
      background:'rgba(4,7,20,0.94)', border:'1px solid rgba(226,185,111,0.3)',
      borderRadius:12, padding:'14px 20px',
      backdropFilter:'blur(12px)', pointerEvents:'auto',
      ...style,
    }}>
      <div style={{ color:'#e2b96f', fontSize:15, marginBottom:4 }}>{friend.name}</div>
      <div style={{ color:'rgba(155,142,196,0.75)', fontSize:10, lineHeight:1.8 }}>
        {friend.mbti} · {friend.zodiac}<br/>
        {friend.nickname ?? ''}
      </div>
      <div style={{ marginTop:10, display:'flex', gap:8 }}>
        <Link href={`/friend/${friend.id}`}
          style={{ color:'#e2b96f', fontSize:10, letterSpacing:1, textDecoration:'none',
            border:'1px solid rgba(226,185,111,0.3)', borderRadius:10, padding:'4px 10px' }}>
          编辑
        </Link>
        {friend.atlasId && (
          <Link href={`/atlas/${friend.id}`}
            style={{ color:'rgba(155,142,196,0.8)', fontSize:10, letterSpacing:1, textDecoration:'none',
              border:'1px solid rgba(155,142,196,0.3)', borderRadius:10, padding:'4px 10px' }}>
            图鉴
          </Link>
        )}
      </div>
    </div>
  )
}
