'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getFriends, saveFriend } from '@/lib/store'
import { pushFriend } from '@/lib/supabase'
import type { Friend, Memory } from '@/lib/types'
import FriendForm from '@/components/FriendForm'
import MemoryTimeline from '@/components/MemoryTimeline'
import Link from 'next/link'

export default function EditFriendPage() {
  const { friendId } = useParams<{ friendId: string }>()
  const [friend, setFriend] = useState<Friend | null | undefined>(undefined)

  useEffect(() => {
    const found = getFriends().find(f => f.id === friendId) ?? null
    // One-time client-only localStorage read keyed on friendId; not a subscription to an
    // external system, and there's no render-time alternative since localStorage doesn't
    // exist during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFriend(found)
  }, [friendId])

  function handleMemoriesChange(memories: Memory[]) {
    if (!friend) return
    const updated: Friend = { ...friend, memories, updatedAt: new Date().toISOString() }
    setFriend(updated)
    saveFriend(updated)
    pushFriend(updated).catch(console.error)
  }

  if (friend === undefined) {
    return (
      <main style={{
        minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        background:'radial-gradient(ellipse at 30% 40%, #0d1b4b 0%, #020408 70%)',
      }}>
        <div style={{ color:'rgba(226,185,111,0.5)', fontSize:12, letterSpacing:2 }}>加载中...</div>
      </main>
    )
  }

  if (friend === null) {
    return (
      <main style={{
        minHeight:'100vh', padding:'60px 24px 80px',
        background:'radial-gradient(ellipse at 30% 40%, #0d1b4b 0%, #020408 70%)',
      }}>
        <div style={{ width:'100%', maxWidth:560, margin:'0 auto' }}>
          <Link href="/" style={{ color:'rgba(226,185,111,0.5)', fontSize:11, letterSpacing:2,
            textDecoration:'none', display:'block', marginBottom:32 }}>← 返回星图</Link>
          <div style={{color:'#e2b96f',padding:40}}>好友不存在</div>
        </div>
      </main>
    )
  }

  return (
    <main style={{
      minHeight:'100vh', padding:'60px 24px 80px',
      background:'radial-gradient(ellipse at 30% 40%, #0d1b4b 0%, #020408 70%)',
    }}>
      <div style={{ width:'100%', maxWidth:560, margin:'0 auto' }}>
        <Link href="/" style={{ color:'rgba(226,185,111,0.5)', fontSize:11, letterSpacing:2,
          textDecoration:'none', display:'block', marginBottom:32 }}>← 返回星图</Link>
        <h1 style={{ color:'#e2b96f', fontFamily:'Ma Shan Zheng, cursive',
          fontSize:28, letterSpacing:4, marginBottom:32 }}>✦ {friend.name}</h1>
        <FriendForm initial={friend} />
        <div style={{ marginTop:48 }}>
          <MemoryTimeline
            friendId={friend.id}
            memories={friend.memories}
            onChange={handleMemoriesChange}
          />
        </div>
        {!friend.atlasId && (
          <div style={{ marginTop:40, textAlign:'center' }}>
            <Link href={`/atlas/${friend.id}`} style={{
              display:'inline-block', padding:'12px 32px',
              background:'rgba(226,185,111,0.08)', border:'1px solid rgba(226,185,111,0.35)',
              borderRadius:12, color:'#e2b96f', fontSize:12, letterSpacing:2, textDecoration:'none',
            }}>✦ 生成图鉴</Link>
          </div>
        )}
      </div>
    </main>
  )
}
