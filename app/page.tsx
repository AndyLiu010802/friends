'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import OrreryEntry from '@/components/StarMap/OrreryEntry'
import InsightPanel from '@/components/InsightPanel'
import { getFriends } from '@/lib/store'
import { pullAll } from '@/lib/supabase'
import type { Friend } from '@/lib/types'

const StarMap = dynamic(() => import('@/components/StarMap/StarMap'), { ssr: false })

// Module-level (not component state): survives client-side navigation away from and
// back to "/" within the same page load, so the entry splash doesn't replay every time
// the user returns from editing a friend or viewing an atlas. Resets naturally on a real
// page reload since that re-executes this module from scratch.
let hasEnteredThisPageLoad = false

export default function HomePage() {
  const [entered, setEntered] = useState(hasEnteredThisPageLoad)
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null)

  useEffect(() => {
    if (!entered) return
    pullAll()
      .catch(console.error)
      .finally(() => setFriends(getFriends()))
  }, [entered])

  return (
    <>
      {/* Top nav */}
      {entered && (
        <nav style={{
          position:'fixed', top:0, left:0, right:0, zIndex:30,
          display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'calc(14px + env(safe-area-inset-top)) 16px 14px',
          background:'linear-gradient(to bottom, rgba(2,4,8,0.8), transparent)',
          pointerEvents:'none',
        }}>
          <span style={{ color:'#e2b96f', fontFamily:'Ma Shan Zheng, cursive',
            fontSize:16, letterSpacing:4 }}>✦ 友记</span>
          <Link href="/friend/new" style={{
            color:'#e2b96f', fontSize:11, letterSpacing:2,
            border:'1px solid rgba(226,185,111,0.35)', borderRadius:20,
            padding:'10px 18px', textDecoration:'none', pointerEvents:'auto',
          }}>✦ 新纪录</Link>
        </nav>
      )}

      {!entered && <OrreryEntry onEnter={() => { hasEnteredThisPageLoad = true; setEntered(true) }} />}
      {entered && (
        <>
          <StarMap selectedFriendId={selectedFriendId} onDeselect={() => setSelectedFriendId(null)} />
          <InsightPanel friends={friends} onSelectFriend={setSelectedFriendId} />
        </>
      )}
    </>
  )
}
