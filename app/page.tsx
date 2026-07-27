'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import OrreryEntry from '@/components/StarMap/OrreryEntry'
import InsightPanel from '@/components/InsightPanel'
import EmptyUniverse from '@/components/EmptyUniverse'
import FirstRunHint from '@/components/FirstRunHint'
import SearchOverlay from '@/components/SearchOverlay'
import QuickNoteOverlay from '@/components/QuickNoteOverlay'
import { getFriends } from '@/lib/store'
import { pullAll } from '@/lib/supabase'
import { useIsMobile } from '@/lib/useIsMobile'
import { fs, gold, border, radius, font } from '@/lib/ui/tokens'
import type { Friend } from '@/lib/types'
import { generateFriendInsights } from '@/lib/insights'
import { getDismissals, dismissSignal, filterDismissed } from '@/lib/signalDismissals'

const StarMap = dynamic(() => import('@/components/StarMap/StarMap'), { ssr: false })

// Module-level (not component state): survives client-side navigation away from and
// back to "/" within the same page load, so the entry splash doesn't replay every time
// the user returns from editing a friend or viewing an atlas. Resets naturally on a real
// page reload since that re-executes this module from scratch.
let hasEnteredThisPageLoad = false

export default function HomePage() {
  const [entered, setEntered] = useState(hasEnteredThisPageLoad)
  // 本次页面加载首次经入场页进入才播 stagger/推镜；从编辑页返回不重播
  const [cinematic] = useState(!hasEnteredThisPageLoad)
  const [friends, setFriends] = useState<Friend[]>([])
  const [dataReady, setDataReady] = useState(false)
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null)
  // 聚焦模式：卡片停靠右侧期间隐藏洞察面板，避免右侧重叠；关闭卡片即恢复
  const [focusedFriendId, setFocusedFriendId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteFriendId, setNoteFriendId] = useState<string | undefined>(undefined)
  const [dismissals, setDismissals] = useState<Record<string, string>>({})
  const isMobile = useIsMobile()

  // 挂载即拉数——入场页兼职加载屏，不把加载成本转嫁给点击之后
  useEffect(() => {
    pullAll()
      .catch(console.error)
      .finally(() => { setFriends(getFriends()); setDataReady(true) })
  }, [])

  // 忽略表是 client-only localStorage 状态,SSR 期不存在,无渲染期替代方案
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissals(getDismissals())
  }, [])

  const insights = filterDismissed(generateFriendInsights(friends), dismissals)
  const hasUrgent = insights.some(i => i.priority === 3)

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
          <span style={{ position:'relative', color: gold.base, fontFamily: font.hand,
            fontSize: fs.title, letterSpacing:4 }}>
            ✦ 友记
            {hasUrgent && <span style={{
              position:'absolute', top:2, right:-12, width:8, height:8,
              borderRadius: radius.pill, background: gold.base,
              boxShadow:`0 0 6px ${gold.base}`,
            }} />}
          </span>
          <span style={{ display:'flex', gap:10 }}>
            <button type="button" onClick={() => { setNoteFriendId(undefined); setNoteOpen(true) }} style={{
              color: gold.base, fontSize: fs.meta, letterSpacing: isMobile ? 0 : 2,
              border:`1px solid ${border.gold}`, borderRadius: radius.pill,
              padding: isMobile ? '10px 12px' : '10px 18px', background:'none', cursor:'pointer',
              fontFamily:'inherit', pointerEvents:'auto',
            }}>{isMobile ? '✎' : '✎ 记一笔'}</button>
            <button type="button" onClick={() => setSearchOpen(true)} style={{
              color: gold.base, fontSize: fs.meta, letterSpacing: isMobile ? 0 : 2,
              border:`1px solid ${border.gold}`, borderRadius: radius.pill,
              padding: isMobile ? '10px 12px' : '10px 18px', background:'none', cursor:'pointer',
              fontFamily:'inherit', pointerEvents:'auto',
            }}>{isMobile ? '⌕' : '⌕ 寻星'}</button>
            <Link href="/friend/new" style={{
              color: gold.base, fontSize: fs.meta, letterSpacing: isMobile ? 0 : 2,
              border:`1px solid ${border.gold}`, borderRadius: radius.pill,
              padding: isMobile ? '10px 12px' : '10px 18px', textDecoration:'none', pointerEvents:'auto',
            }}>{isMobile ? '✦' : '✦ 新纪录'}</Link>
          </span>
        </nav>
      )}

      {!entered && <OrreryEntry ready={dataReady} onEnter={() => { hasEnteredThisPageLoad = true; setEntered(true) }} />}
      {entered && (
        <>
          <StarMap
            friends={friends}
            cinematic={cinematic}
            selectedFriendId={selectedFriendId}
            onSelect={setFocusedFriendId}
            onDeselect={() => { setSelectedFriendId(null); setFocusedFriendId(null) }}
          />
          {!focusedFriendId && (
            <InsightPanel
              insights={insights}
              onSelectFriend={id => { setSelectedFriendId(id); setFocusedFriendId(id) }}
              onQuickNote={id => { setNoteFriendId(id); setNoteOpen(true) }}
              onDismiss={ins => setDismissals(dismissSignal(ins.id, ins.fingerprint))}
            />
          )}
          {dataReady && friends.length === 0 && <EmptyUniverse />}
          {dataReady && friends.length > 0 && <FirstRunHint />}
          <SearchOverlay
            friends={friends}
            open={searchOpen}
            onOpenChange={setSearchOpen}
            onPick={id => { setSelectedFriendId(id); setFocusedFriendId(id) }}
          />
          <QuickNoteOverlay
            friends={friends}
            open={noteOpen}
            onOpenChange={o => { if (!o) setNoteFriendId(undefined); setNoteOpen(o) }}
            defaultFriendId={noteFriendId}
            onSaved={() => setFriends(getFriends())}
          />
        </>
      )}
    </>
  )
}
