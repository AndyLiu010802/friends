'use client'
import type { CSSProperties } from 'react'
import type { Friend } from '@/lib/types'
import Link from 'next/link'

interface Props {
  friend: Friend
  style?: CSSProperties
  pinned?: boolean
  onClose?: () => void
}

export default function FriendCard({ friend, style, pinned, onClose }: Props) {
  const meta = [friend.mbti, friend.zodiac].filter(Boolean).join(' · ')

  return (
    <div style={{
      position:'fixed', zIndex:20, minWidth:160,
      background:'rgba(4,7,20,0.94)', border:'1px solid rgba(226,185,111,0.3)',
      borderRadius:12, padding:'14px 20px',
      backdropFilter:'blur(12px)', pointerEvents:'auto',
      ...style,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div style={{ color:'#e2b96f', fontSize:15 }}>{friend.name}</div>
        {pinned && (
          <button type="button" onClick={onClose} style={{
            background:'none', border:'none', color:'rgba(226,185,111,0.5)',
            cursor:'pointer', fontSize:14, lineHeight:1, padding:0,
          }}>✕</button>
        )}
      </div>
      <div style={{ color:'rgba(155,142,196,0.75)', fontSize:10, lineHeight:1.8, marginTop:4 }}>
        {meta}<br/>
        {friend.nickname ?? ''}
      </div>
      <div style={{ marginTop:10, display:'flex', gap:8 }}>
        <Link href={`/friend/${friend.id}`}
          style={{ color:'#e2b96f', fontSize:10, letterSpacing:1, textDecoration:'none',
            border:'1px solid rgba(226,185,111,0.3)', borderRadius:10, padding:'4px 10px' }}>
          编辑
        </Link>
        <Link href={`/atlas/${friend.id}`}
          style={{ color:'rgba(155,142,196,0.8)', fontSize:10, letterSpacing:1, textDecoration:'none',
            border:'1px solid rgba(155,142,196,0.3)', borderRadius:10, padding:'4px 10px' }}>
          {friend.atlasId ? '图鉴' : '生成图鉴'}
        </Link>
      </div>
    </div>
  )
}
