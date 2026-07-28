'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { searchFriends } from '@/lib/friendSearch'
import { extractMemory, buildQuickMemory, sortMemoriesDesc } from '@/lib/quickMemory'
import { getFriends, saveFriend } from '@/lib/store'
import { pushFriend } from '@/lib/supabase'
import { useIsMobile } from '@/lib/useIsMobile'
import { fs, text, gold, purple, border, surface, radius, font } from '@/lib/ui/tokens'
import type { Friend } from '@/lib/types'

interface Props {
  friends: Friend[]
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultFriendId?: string
  onSaved: (friendId: string) => void
}

type Step = 'pick' | 'write' | 'done'

export default function QuickNoteOverlay({ friends, open, onOpenChange, defaultFriendId, onSaved }: Props) {
  const [step, setStep] = useState<Step>('pick')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openRef = useRef(open)
  const isMobile = useIsMobile()

  useEffect(() => { openRef.current = open }, [open])

  // 全局快捷键:Ctrl/Cmd+J 开(输入框聚焦时不劫持),Esc 关;捕获阶段先于 StarMap
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.isComposing) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        const tag = (e.target as HTMLElement | null)?.tagName
        if (!open && (tag === 'INPUT' || tag === 'TEXTAREA')) return
        e.preventDefault()
        onOpenChange(!open)
      } else if (e.key === 'Escape' && open) {
        e.preventDefault()
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, onOpenChange])

  // 每次打开重置;defaultFriendId 有效时直达记录步。
  // 依赖刻意不含 friends:保存后父页刷新 friends 不应把仍在「已记入」态的浮层重置回选人步。
  useEffect(() => {
    if (open) {
      if (closeTimer.current) clearTimeout(closeTimer.current)
      const preset = defaultFriendId && friends.some(f => f.id === defaultFriendId)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(preset ? 'write' : 'pick')
      setPickedId(preset ? defaultFriendId! : null)
      setQuery(''); setNoteText(''); setSaving(false); setNotFound(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultFriendId])

  // 卸载时清理自动关闭定时器(单独 effect,避免被上面的重置周期误清)
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  if (!open) return null

  const picked = friends.find(f => f.id === pickedId)
  const results = searchFriends(friends, query)

  async function save() {
    const content = noteText.trim()
    if (!content || saving || !picked) return
    setSaving(true)
    const extract = await extractMemory(content, picked.name)
    const fresh = getFriends().find(f => f.id === picked.id)
    if (!fresh) { setSaving(false); setNotFound(true); return }
    const updated: Friend = {
      ...fresh,
      memories: sortMemoriesDesc([...fresh.memories, buildQuickMemory(content, extract, new Date())]),
      updatedAt: new Date().toISOString(),
    }
    saveFriend(updated)
    pushFriend(updated).catch(console.error)
    onSaved(picked.id)
    navigator.vibrate?.(10) // 触觉确认,不支持时为 undefined 安全跳过
    setSaving(false)
    if (!openRef.current) return // 已被关闭:保存已完成,不再进入 done 态
    setStep('done')
    closeTimer.current = setTimeout(() => onOpenChange(false), 1200)
  }

  const panel: React.CSSProperties = {
    width:'100%', maxWidth:480, alignSelf: isMobile ? 'stretch' : 'flex-start',
    background: surface.card, border:`1px solid ${border.gold}`,
    borderRadius: radius.lg, overflow:'hidden',
    display:'flex', flexDirection:'column',
    maxHeight: isMobile ? '100%' : '60vh',
  }

  return (
    <div
      onClick={() => onOpenChange(false)}
      style={{
        position:'fixed', inset:0, zIndex:40,
        background:'rgba(2,4,8,0.6)', backdropFilter:'blur(4px)',
        display:'flex', justifyContent:'center',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        padding: isMobile
          ? 'calc(12px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom))'
          : '15vh 16px 0',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={panel}>
        <div style={{ padding:'12px 16px', borderBottom:`1px solid ${border.goldFaint}`,
          color: gold.base, fontSize: fs.meta, letterSpacing:2 }}>✎ 记一笔</div>

        {friends.length === 0 && (
          <div style={{ padding:'28px 16px', textAlign:'center' }}>
            <div style={{ color: purple.muted, fontSize: fs.sub, marginBottom:12 }}>你的宇宙还空着</div>
            <Link href="/friend/new" onClick={() => onOpenChange(false)} style={{
              color: gold.base, fontSize: fs.meta, letterSpacing:2,
              border:`1px solid ${border.gold}`, borderRadius: radius.pill,
              padding:'8px 16px', textDecoration:'none',
            }}>✦ 新纪录</Link>
          </div>
        )}

        {friends.length > 0 && step === 'pick' && (
          <>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="记给谁?搜索或直接选"
              style={{
                background: surface.input, border:'none', outline:'none',
                borderBottom:`1px solid ${border.goldFaint}`,
                padding:'12px 16px', color: text.primary,
                fontSize: fs.body, fontFamily: font.serif,
              }}
            />
            <div style={{ overflowY:'auto', padding:'8px 0' }}>
              {results.length === 0 && (
                <div style={{ padding:'20px 16px', color: purple.muted, fontSize: fs.sub }}>没有找到这位朋友</div>
              )}
              {results.map(r => (
                <button key={r.friend.id} type="button"
                  onClick={() => { setPickedId(r.friend.id); setStep('write') }}
                  style={{
                    display:'flex', alignItems:'center', gap:10, width:'100%',
                    textAlign:'left', padding:'10px 16px', cursor:'pointer',
                    background:'none', border:'none', fontFamily: font.serif,
                  }}>
                  <span style={{
                    width:8, height:8, borderRadius: radius.pill, flexShrink:0,
                    background: r.friend.starConfig.coreColor,
                    boxShadow:`0 0 6px ${r.friend.starConfig.glowColor}`,
                  }} />
                  <span style={{ color: text.primary, fontSize: fs.body }}>{r.friend.name}</span>
                  {r.friend.nickname && (
                    <span style={{ color: text.faint, fontSize: fs.meta }}>{r.friend.nickname}</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {friends.length > 0 && step === 'write' && picked && (
          <div style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{
                width:8, height:8, borderRadius: radius.pill,
                background: picked.starConfig.coreColor,
                boxShadow:`0 0 6px ${picked.starConfig.glowColor}`,
              }} />
              <span style={{ color: text.primary, fontSize: fs.body, flex:1 }}>{picked.name}</span>
              <button type="button" onClick={() => setStep('pick')} style={{
                background:'none', border:'none', cursor:'pointer',
                color: gold.muted, fontSize: fs.meta, letterSpacing:1,
              }}>换人</button>
            </div>
            <textarea
              autoFocus rows={3} value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="发生了什么?随手一记,AI 会整理好标题、标签和心情"
              style={{
                background: surface.input, border:`1px solid ${border.goldFaint}`,
                borderRadius: radius.sm, padding:'8px 12px', color: text.primary,
                fontSize: fs.sub, fontFamily: font.serif, resize:'vertical',
              }}
            />
            {notFound && <div style={{ color: purple.muted, fontSize: fs.meta }}>好友不存在</div>}
            <button type="button" onClick={save} disabled={!noteText.trim() || saving} style={{
              background: surface.input, border:`1px solid ${border.goldFaint}`,
              borderRadius: radius.sm, padding:'8px 12px', width:'auto', alignSelf:'flex-start',
              color: gold.base, fontSize: fs.sub, fontFamily: font.serif,
              cursor: saving ? 'wait' : 'pointer',
              opacity: !noteText.trim() || saving ? 0.6 : 1,
            }}>
              {saving ? 'AI 整理中…' : '保存'}
            </button>
          </div>
        )}

        {step === 'done' && picked && (
          <div style={{ padding:'28px 16px', textAlign:'center', color: gold.base, fontSize: fs.sub }}>
            已记入 ✦ {picked.name} 的星尘
          </div>
        )}
      </div>
    </div>
  )
}
