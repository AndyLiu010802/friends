'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { searchFriends, lastInteractionDate, type MatchField } from '@/lib/friendSearch'
import { formatRelativeDate } from '@/lib/dateUtils'
import { useIsMobile } from '@/lib/useIsMobile'
import { fs, text, gold, purple, border, surface, radius, font } from '@/lib/ui/tokens'
import type { Friend } from '@/lib/types'

interface Props {
  friends: Friend[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (friendId: string) => void
}

const MATCH_LABEL: Partial<Record<MatchField, string>> = {
  like: '喜欢', dislike: '雷区', hobby: '爱好', tag: '标签',
}

export default function SearchOverlay({ friends, open, onOpenChange, onPick }: Props) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()

  // 全局快捷键:Ctrl/Cmd+K 开(输入框聚焦时不劫持),Esc 关
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.isComposing) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const tag = (e.target as HTMLElement | null)?.tagName
        if (!open && (tag === 'INPUT' || tag === 'TEXTAREA')) return
        e.preventDefault()
        onOpenChange(!open)
      } else if (e.key === 'Escape' && open) {
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  // 每次打开重置查询并聚焦
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      inputRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  const results = searchFriends(friends, query)

  function pick(friendId: string) {
    onPick(friendId)
    onOpenChange(false)
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIndex]) {
      pick(results[activeIndex].friend.id)
    }
  }

  const emptyHint = (message: string) => (
    <div style={{ padding:'28px 16px', textAlign:'center' }}>
      <div style={{ color: purple.muted, fontSize: fs.sub, marginBottom:12 }}>{message}</div>
      <Link href="/friend/new" onClick={() => onOpenChange(false)} style={{
        color: gold.base, fontSize: fs.meta, letterSpacing:2,
        border:`1px solid ${border.gold}`, borderRadius: radius.pill,
        padding:'8px 16px', textDecoration:'none',
      }}>✦ 新纪录</Link>
    </div>
  )

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
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:'100%', maxWidth:480, alignSelf: isMobile ? 'stretch' : 'flex-start',
          background: surface.card, border:`1px solid ${border.gold}`,
          borderRadius: radius.lg, overflow:'hidden',
          display:'flex', flexDirection:'column',
          maxHeight: isMobile ? '100%' : '60vh',
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setActiveIndex(0) }}
          onKeyDown={onInputKeyDown}
          placeholder="⌕ 寻找一位朋友…"
          style={{
            background: surface.input, border:'none', outline:'none',
            borderBottom:`1px solid ${border.goldFaint}`,
            padding:'14px 16px', color: text.primary,
            fontSize: fs.body, fontFamily: font.serif,
          }}
        />
        <div style={{ overflowY:'auto', padding:'8px 0' }}>
          {friends.length === 0 && emptyHint('你的宇宙还空着')}
          {friends.length > 0 && results.length === 0 && emptyHint('没有找到这位朋友')}
          {results.map((r, i) => (
            <button
              key={r.friend.id}
              type="button"
              onClick={() => pick(r.friend.id)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display:'flex', alignItems:'center', gap:10, width:'100%',
                textAlign:'left', padding:'10px 16px', cursor:'pointer',
                background: i === activeIndex ? surface.raise : 'none',
                border:'none', fontFamily: font.serif,
              }}
            >
              <span style={{
                width:8, height:8, borderRadius: radius.pill, flexShrink:0,
                background: r.friend.starConfig.coreColor,
                boxShadow:`0 0 6px ${r.friend.starConfig.glowColor}`,
              }} />
              <span style={{ minWidth:0, flex:1 }}>
                <span style={{ color: text.primary, fontSize: fs.body }}>{r.friend.name}</span>
                {r.friend.nickname && (
                  <span style={{ color: text.faint, fontSize: fs.meta, marginLeft:8 }}>{r.friend.nickname}</span>
                )}
                {r.matchField && MATCH_LABEL[r.matchField] && (
                  <span style={{ display:'block', color: purple.muted, fontSize: fs.meta }}>
                    {MATCH_LABEL[r.matchField]}:{r.matchText}
                  </span>
                )}
              </span>
              <span style={{ color: text.faint, fontSize: fs.meta, flexShrink:0 }}>
                {formatRelativeDate(lastInteractionDate(r.friend))}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
