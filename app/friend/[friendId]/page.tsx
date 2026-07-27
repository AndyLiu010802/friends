'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getFriends, saveFriend, deleteFriend } from '@/lib/store'
import { pushFriend, deleteFriendRemote } from '@/lib/supabase'
import type { Friend, Memory } from '@/lib/types'
import FriendForm from '@/components/FriendForm'
import MemoryTimeline from '@/components/MemoryTimeline'
import Link from 'next/link'
import { fs, gold, danger, border, surface, radius, font } from '@/lib/ui/tokens'

export default function EditFriendPage() {
  const { friendId } = useParams<{ friendId: string }>()
  const router = useRouter()
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

  function handleDelete() {
    if (!friend) return
    if (!window.confirm(`确定要删除「${friend.name}」吗？这个操作无法撤销。`)) return
    deleteFriend(friend.id)
    deleteFriendRemote(friend.id).catch(console.error)
    router.push('/')
  }

  if (friend === undefined) {
    return (
      <main style={{
        minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        background:'radial-gradient(ellipse at 30% 40%, #0d1b4b 0%, #020408 70%)',
      }}>
        <div style={{ color: gold.muted, fontSize: fs.meta, letterSpacing:2 }}>加载中...</div>
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
          <Link href="/" style={{ color: gold.muted, fontSize: fs.meta, letterSpacing:2,
            textDecoration:'none', display:'block', marginBottom:32 }}>← 返回星图</Link>
          <div style={{color: gold.base, padding:40}}>好友不存在</div>
        </div>
      </main>
    )
  }

  return (
    <main style={{
      height:'100vh', padding:'60px 24px 80px', overflowY:'auto',
      background:'radial-gradient(ellipse at 30% 40%, #0d1b4b 0%, #020408 70%)',
    }}>
      <div style={{ width:'100%', maxWidth:560, margin:'0 auto' }}>
        <Link href="/" style={{ color: gold.muted, fontSize: fs.meta, letterSpacing:2,
          textDecoration:'none', display:'block', marginBottom:32 }}>← 返回星图</Link>
        <h1 style={{ color: gold.base, fontFamily: font.hand,
          fontSize: fs.display, letterSpacing:4, marginBottom:32 }}>✦ {friend.name}</h1>
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
              background: surface.chip, border:`1px solid ${border.gold}`,
              borderRadius: radius.md, color: gold.base, fontSize: fs.sub, letterSpacing:2, textDecoration:'none',
            }}>✦ 生成图鉴</Link>
          </div>
        )}
        <div style={{ marginTop:56, textAlign:'center' }}>
          <button type="button" onClick={handleDelete} style={{
            background:'none', border:`1px solid ${danger.border}`, borderRadius: radius.sm,
            color: danger.text, fontSize: fs.meta, letterSpacing:2, padding:'8px 20px',
            cursor:'pointer',
          }}>删除好友</button>
        </div>
      </div>
    </main>
  )
}
