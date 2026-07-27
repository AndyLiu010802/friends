# 友记 v0.2 Bug 修复 + 关系状态化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three reported v0.1 bugs (unclickable stars, unstyled form, mandatory MBTI/low-contrast dropdowns — four issues total once split out) and ship the V0.2 relationship-state feature batch (growth stage, relationship temperature, conversation hints, birthday status, profile completion) into the existing friend-star-map Next.js app.

**Architecture:** `Friend.mbti`/`birthday`/`zodiac` become optional and a new `important: boolean` field is added. Five new pure-function `lib` modules compute derived relationship state at *render time* (not persisted into `StarConfig`), so `StarBuilder.buildStar(friend)` and `FriendCard` always reflect current data without requiring a form re-save. Star click handling moves from a fragile hover-only tooltip to an explicit click-to-pin interaction split across `mousedown`/`mouseup` with a movement threshold.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Three.js + GSAP, vitest + jsdom, localStorage + optional Supabase sync.

**Spec:** `docs/superpowers/specs/2026-07-01-friend-star-map-v2-design.md`

---

### Task 1: `lib/types.ts` — optional fields + `important`

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Update the `Friend` interface**

Replace the `Friend` interface (currently lines 42-60) with:

```ts
export interface Friend {
  id: string
  name: string
  nickname?: string
  birthday?: string
  zodiac?: string
  mbti?: string
  important: boolean
  likes: string[]
  dislikes: string[]
  hobbies: string[]
  portraits: Media[]
  memories: Memory[]
  relationships: Relationship[]
  notes?: string
  starConfig: StarConfig
  atlasId?: string
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: make Friend.mbti/birthday/zodiac optional, add important flag"
```

---

### Task 2: `lib/store.ts` — `normalizeFriend` for backward compatibility

**Files:**
- Modify: `lib/store.ts`
- Modify: `lib/store.test.ts`

- [ ] **Step 1: Write the failing test**

Update `lib/store.test.ts` — add `important: false` to `MOCK_FRIEND` (now required by the type) and add a new test for legacy records missing the field:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getFriends, saveFriend, deleteFriend } from './store'
import type { Friend } from './types'

const MOCK_FRIEND: Friend = {
  id: 'f1', name: '小雨', birthday: '1999-06-05', zodiac: '双子座',
  mbti: 'ENFP', important: false, likes: [], dislikes: [], hobbies: [],
  portraits: [], memories: [], relationships: [],
  starConfig: { kind:'radiant', coreColor:'#38bdf8', glowColor:'#818cf8',
    size:1, twinkleSpeed:2, position:[0,0,0] },
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
}

beforeEach(() => localStorage.clear())

describe('store', () => {
  it('returns empty array when no data', () => {
    expect(getFriends()).toEqual([])
  })
  it('saves and retrieves a friend', () => {
    saveFriend(MOCK_FRIEND)
    expect(getFriends()).toHaveLength(1)
    expect(getFriends()[0].name).toBe('小雨')
  })
  it('updates existing friend', () => {
    saveFriend(MOCK_FRIEND)
    saveFriend({ ...MOCK_FRIEND, name: '小雨雨' })
    const friends = getFriends()
    expect(friends).toHaveLength(1)
    expect(friends[0].name).toBe('小雨雨')
  })
  it('deletes a friend', () => {
    saveFriend(MOCK_FRIEND)
    deleteFriend('f1')
    expect(getFriends()).toHaveLength(0)
  })
  it('backfills important:false for legacy records missing the field', () => {
    const legacy = { ...MOCK_FRIEND } as Partial<Friend>
    delete legacy.important
    localStorage.setItem('yj_friends', JSON.stringify([legacy]))
    const friends = getFriends()
    expect(friends[0].important).toBe(false)
  })
  it('defaults missing array fields to empty arrays for legacy records', () => {
    const legacy = { id: 'f2', name: 'Old Friend', createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    localStorage.setItem('yj_friends', JSON.stringify([legacy]))
    const friends = getFriends()
    expect(friends[0].likes).toEqual([])
    expect(friends[0].memories).toEqual([])
    expect(friends[0].relationships).toEqual([])
    expect(friends[0].starConfig.kind).toBe('nebula')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- store.test.ts`
Expected: FAIL — `important` missing on legacy record comes back `undefined`, not `false`; second new test fails because `getFriends()` currently does a raw `JSON.parse` with no normalization, so `friends[0].starConfig` is `undefined` and `.kind` throws.

- [ ] **Step 3: Implement `normalizeFriend` in `lib/store.ts`**

Replace the full contents of `lib/store.ts` with:

```ts
import type { Friend, Atlas, StarConfig } from './types'

const FRIENDS_KEY = 'yj_friends'
const ATLAS_KEY   = 'yj_atlas'

const DEFAULT_STAR_CONFIG: StarConfig = {
  kind: 'nebula', coreColor: '#94a3b8', glowColor: '#cbd5e1',
  size: 1, twinkleSpeed: 2.4, position: [0, 0, 0],
}

function normalizeFriend(friend: Partial<Friend>): Friend {
  return {
    id: friend.id ?? crypto.randomUUID(),
    name: friend.name ?? '未命名好友',
    nickname: friend.nickname,
    birthday: friend.birthday,
    zodiac: friend.zodiac,
    mbti: friend.mbti,
    important: friend.important ?? false,
    likes: friend.likes ?? [],
    dislikes: friend.dislikes ?? [],
    hobbies: friend.hobbies ?? [],
    portraits: friend.portraits ?? [],
    memories: friend.memories ?? [],
    relationships: friend.relationships ?? [],
    notes: friend.notes,
    starConfig: friend.starConfig ?? DEFAULT_STAR_CONFIG,
    atlasId: friend.atlasId,
    createdAt: friend.createdAt ?? new Date().toISOString(),
    updatedAt: friend.updatedAt ?? new Date().toISOString(),
  }
}

export function getFriends(): Friend[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FRIENDS_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.map(normalizeFriend)
  } catch { return [] }
}

export function saveFriend(friend: Friend): void {
  const list = getFriends()
  const idx  = list.findIndex(f => f.id === friend.id)
  if (idx >= 0) list[idx] = friend
  else list.push(friend)
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(list))
}

export function deleteFriend(id: string): void {
  const list = getFriends().filter(f => f.id !== id)
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(list))
}

export function getAtlasList(): Atlas[] {
  try {
    return JSON.parse(localStorage.getItem(ATLAS_KEY) ?? '[]')
  } catch { return [] }
}

export function saveAtlas(atlas: Atlas): void {
  const list = getAtlasList()
  const idx  = list.findIndex(a => a.id === atlas.id)
  if (idx >= 0) list[idx] = atlas
  else list.push(atlas)
  localStorage.setItem(ATLAS_KEY, JSON.stringify(list))
}

export function getAtlasByFriendId(friendId: string): Atlas | undefined {
  return getAtlasList().find(a => a.friendId === friendId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- store.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts lib/store.test.ts
git commit -m "feat: normalize legacy Friend records on read from localStorage"
```

---

### Task 3: `lib/starGen.ts` — handle missing mbti/zodiac

**Files:**
- Modify: `lib/starGen.ts`
- Modify: `lib/starGen.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/starGen.test.ts` (inside the existing `describe('generateStarConfig', ...)` block, after the last `it`):

```ts
  it('defaults to nebula kind when mbti is undefined', () => {
    const cfg = generateStarConfig(undefined, '双子座', [], [0,0,0])
    expect(cfg.kind).toBe('nebula')
  })
  it('defaults to neutral colors when zodiac is undefined', () => {
    const cfg = generateStarConfig('ENFP', undefined, [], [0,0,0])
    expect(cfg.coreColor).toBe('#94a3b8')
    expect(cfg.glowColor).toBe('#cbd5e1')
  })
  it('does not throw when both mbti and zodiac are undefined', () => {
    expect(() => generateStarConfig(undefined, undefined, [], [0,0,0])).not.toThrow()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- starGen.test.ts`
Expected: FAIL — current `generateStarConfig` signature requires `mbti: string` and calls `mbti.slice(...)`/`mbti[0]`, throwing a TypeScript build error and (if run anyway) a runtime `TypeError` on `undefined.slice`.

- [ ] **Step 3: Implement the guarded version**

Replace the full contents of `lib/starGen.ts` with:

```ts
import type { StarConfig, StarKind } from './types'
import { getZodiacElement } from './zodiac'

const KIND_MAP: Record<string, StarKind> = {
  EN: 'radiant',
  IN: 'nebula',
  ES: 'blossom',
  IS: 'giant',
}

const ELEMENT_COLORS: Record<string, { core: string; glow: string }> = {
  fire:  { core: '#ef4444', glow: '#f59e0b' },
  earth: { core: '#d97706', glow: '#fbbf24' },
  air:   { core: '#38bdf8', glow: '#818cf8' },
  water: { core: '#7c3aed', glow: '#ec4899' },
}

const UNKNOWN_ELEMENT_COLOR = { core: '#94a3b8', glow: '#cbd5e1' }

export function generateStarConfig(
  mbti: string | undefined,
  zodiac: string | undefined,
  hobbies: string[],
  position: [number, number, number]
): StarConfig {
  const prefix = mbti?.slice(0, 2).toUpperCase()
  const kind: StarKind = (prefix && KIND_MAP[prefix]) ?? 'nebula'

  const element = zodiac ? getZodiacElement(zodiac) : null
  const { core: coreColor, glow: glowColor } = element
    ? ELEMENT_COLORS[element]
    : UNKNOWN_ELEMENT_COLOR

  const hasArt     = hobbies.some(h => /音乐|艺术|绘画|摄影/.test(h))
  const hasSport   = hobbies.some(h => /运动|健身|户外|爬山/.test(h))
  const isIntrovert = mbti?.[0]?.toUpperCase() === 'I'

  const size = kind === 'giant' ? 1.3
    : isIntrovert ? 0.75
    : 1.0

  const twinkleSpeed = hasArt   ? 1.2
    : hasSport  ? 0.8
    : isIntrovert ? 3.5
    : 2.0

  return { kind, coreColor, glowColor, size, twinkleSpeed, position }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- starGen.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/starGen.ts lib/starGen.test.ts
git commit -m "feat: degrade star generation gracefully when mbti/zodiac are missing"
```

---

### Task 4: `components/FriendForm.tsx` — quick/full mode redesign

**Files:**
- Modify: `components/FriendForm.tsx`

- [ ] **Step 1: Replace the full file content**

```tsx
'use client'
import { useState } from 'react'
import type { Friend, Relationship } from '@/lib/types'
import { getZodiac } from '@/lib/zodiac'
import { generateStarConfig } from '@/lib/starGen'
import { findSafePosition } from '@/lib/poissonDisk'
import { saveFriend, getFriends } from '@/lib/store'
import { pushFriend } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import RelationshipEditor from './RelationshipEditor'

const MBTI_OPTIONS = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP']

interface Props { initial?: Friend }

export default function FriendForm({ initial }: Props) {
  const router = useRouter()
  const [mode,    setMode]    = useState<'quick' | 'full'>(initial ? 'full' : 'quick')
  const [name,    setName]    = useState(initial?.name ?? '')
  const [nick,    setNick]    = useState(initial?.nickname ?? '')
  const [bday,    setBday]    = useState(initial?.birthday ?? '')
  const [mbti,    setMbti]    = useState(initial?.mbti ?? '')
  const [likes,   setLikes]   = useState(initial?.likes.join(', ') ?? '')
  const [dislikes,setDislikes]= useState(initial?.dislikes.join(', ') ?? '')
  const [hobbies, setHobbies] = useState(initial?.hobbies.join(', ') ?? '')
  const [notes,   setNotes]   = useState(initial?.notes ?? '')
  const [important, setImportant] = useState(initial?.important ?? false)
  const [rels,    setRels]    = useState<Relationship[]>(initial?.relationships ?? [])
  const [saving,  setSaving]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const zodiac  = bday ? getZodiac(bday) : undefined
    const existing = getFriends()
    const positions = existing
      .filter(f => f.id !== initial?.id)
      .map(f => f.starConfig.position as [number,number,number])
    const position  = initial?.starConfig.position ?? findSafePosition(positions)
    const starConfig = generateStarConfig(mbti || undefined, zodiac, hobbies.split(',').map(h=>h.trim()), position)

    const friend: Friend = {
      id:        initial?.id ?? crypto.randomUUID(),
      name, nickname: nick || undefined,
      birthday: bday || undefined, zodiac, mbti: mbti || undefined,
      important,
      likes:    likes.split(',').map(s=>s.trim()).filter(Boolean),
      dislikes: dislikes.split(',').map(s=>s.trim()).filter(Boolean),
      hobbies:  hobbies.split(',').map(s=>s.trim()).filter(Boolean),
      portraits: initial?.portraits ?? [],
      memories:  initial?.memories  ?? [],
      relationships: rels,
      notes:    notes || undefined,
      starConfig,
      atlasId:  initial?.atlasId,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    saveFriend(friend)
    await pushFriend(friend).catch(console.error)
    router.push('/')
  }

  const field = (label: string, el: React.ReactNode) => (
    <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <span style={{ color:'rgba(226,185,111,0.7)', fontSize:11, letterSpacing:2 }}>{label}</span>
      {el}
    </label>
  )

  const inputStyle: React.CSSProperties = {
    background:'rgba(255,255,255,0.04)', border:'1px solid rgba(226,185,111,0.2)',
    borderRadius:8, padding:'10px 14px', color:'#e2e8f0', fontSize:13,
    outline:'none', fontFamily:'Noto Serif SC, serif',
  }

  const section = (title: string, children: React.ReactNode) => (
    <div style={{ border:'1px solid rgba(226,185,111,0.15)', borderRadius:12, padding:'16px 18px',
      display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ color:'#e2b96f', fontSize:12, letterSpacing:2 }}>{title}</div>
      {children}
    </div>
  )

  const modeButtonStyle = (active: boolean): React.CSSProperties => ({
    padding:'6px 16px', borderRadius:20, cursor:'pointer', fontSize:11, letterSpacing:1,
    border: active ? '1px solid #e2b96f' : '1px solid rgba(226,185,111,0.25)',
    background: active ? 'rgba(226,185,111,0.15)' : 'transparent',
    color: active ? '#e2b96f' : 'rgba(226,185,111,0.5)',
  })

  const importanceButtonStyle = (active: boolean): React.CSSProperties => ({
    padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize:12,
    border: active ? '1px solid #e2b96f' : '1px solid rgba(226,185,111,0.25)',
    background: active ? 'rgba(226,185,111,0.12)' : 'transparent',
    color: active ? '#e2b96f' : '#cbd5e1',
  })

  const importantToggle = (
    <div style={{ display:'flex', gap:8 }}>
      <button type="button" onClick={()=>setImportant(false)} style={importanceButtonStyle(!important)}>普通</button>
      <button type="button" onClick={()=>setImportant(true)} style={importanceButtonStyle(important)}>重要 ✦</button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', gap:8 }}>
        <button type="button" onClick={()=>setMode('quick')} style={modeButtonStyle(mode==='quick')}>快速添加</button>
        <button type="button" onClick={()=>setMode('full')} style={modeButtonStyle(mode==='full')}>完整档案</button>
      </div>

      {mode === 'quick' ? (
        <>
          {field('名字 *', <input value={name} onChange={e=>setName(e.target.value)} required style={inputStyle}/>)}
          {field('一句话备注', <input value={notes} onChange={e=>setNotes(e.target.value)} style={inputStyle}/>)}
          {field('重要程度', importantToggle)}
        </>
      ) : (
        <>
          {section('基本信息', <>
            {field('名字 *', <input value={name} onChange={e=>setName(e.target.value)} required style={inputStyle}/>)}
            {field('昵称', <input value={nick} onChange={e=>setNick(e.target.value)} style={inputStyle}/>)}
            {field('生日', <input type="date" value={bday} onChange={e=>setBday(e.target.value)} style={inputStyle}/>)}
            {field('重要程度', importantToggle)}
          </>)}
          {section('性格与喜好（选填）', <>
            {field('MBTI',
              <select value={mbti} onChange={e=>setMbti(e.target.value)} style={inputStyle}>
                <option value="">不填写</option>
                {MBTI_OPTIONS.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            )}
            {field('喜欢的东西（逗号分隔）', <input value={likes} onChange={e=>setLikes(e.target.value)} style={inputStyle}/>)}
            {field('讨厌的东西（逗号分隔）', <input value={dislikes} onChange={e=>setDislikes(e.target.value)} style={inputStyle}/>)}
            {field('兴趣爱好（逗号分隔）', <input value={hobbies} onChange={e=>setHobbies(e.target.value)} style={inputStyle}/>)}
          </>)}
          {section('关系与备注', <>
            {initial && field('共同好友',
              <RelationshipEditor
                currentFriendId={initial.id}
                relationships={rels}
                onChange={setRels}
              />
            )}
            {field('备注', <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} style={{...inputStyle,resize:'vertical'}}/>)}
          </>)}
        </>
      )}

      <button type="submit" disabled={saving || !name.trim()} style={{
        marginTop:8, padding:'12px 0', background:'rgba(226,185,111,0.12)',
        border:'1px solid rgba(226,185,111,0.4)', borderRadius:12,
        color:'#e2b96f', fontSize:13, letterSpacing:2, cursor:'pointer',
      }}>
        {saving ? '保存中...' : '✦ 保存好友'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Manually verify**

Run: `npm run dev`, open `http://localhost:3000/friend/new`
Expected: page defaults to "快速添加" showing only 名字/一句话备注/重要程度; clicking "完整档案" reveals the three sectioned blocks without losing what was typed in 名字/备注; submitting with only a name saves successfully and redirects to `/`. Then open an existing friend's edit page (`/friend/[id]`) and confirm it defaults to "完整档案".

- [ ] **Step 3: Commit**

```bash
git add components/FriendForm.tsx
git commit -m "feat: redesign FriendForm with quick/full modes and optional MBTI/birthday"
```

---

### Task 5: Click-to-pin star interaction (`StarMap.tsx` + `FriendCard.tsx`)

**Files:**
- Modify: `components/FriendCard.tsx`
- Modify: `components/StarMap/StarMap.tsx`

- [ ] **Step 1: Replace `components/FriendCard.tsx`**

```tsx
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
```

- [ ] **Step 2: Replace `components/StarMap/StarMap.tsx`**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { initScene, disposeScene } from './scene'
import { buildStarfield } from './starfield'
import { initTrail } from './mouseTrail'
import { buildStar, type StarObject } from './StarBuilder'
import { buildConstellationLines, highlightLines, type LineObject } from './constellationLines'
import FriendCard from '@/components/FriendCard'
import { getFriends } from '@/lib/store'
import { pullAll } from '@/lib/supabase'
import type { Friend } from '@/lib/types'
import * as THREE from 'three'

export default function StarMap() {
  const threeRef = useRef<HTMLCanvasElement>(null)
  const trailRef = useRef<HTMLCanvasElement>(null)
  const [hoveredFriend, setHoveredFriend] = useState<Friend | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const [pinnedFriend, setPinnedFriend] = useState<Friend | null>(null)
  const [pinnedPos, setPinnedPos] = useState<{ x: number; y: number } | null>(null)
  const starsRef  = useRef<StarObject[]>([])
  const linesRef  = useRef<LineObject[]>([])

  useEffect(() => {
    const { renderer, scene, camera, pivot } = initScene(threeRef.current!)
    initTrail(trailRef.current!)

    // Background
    scene.add(buildStarfield())

    // Load friends
    pullAll().then(() => {
      const friends = getFriends()
      const stars   = friends.map(f => buildStar(f))
      starsRef.current = stars
      stars.forEach(s => pivot.add(s.root))

      const lines = buildConstellationLines(friends)
      linesRef.current = lines
      lines.forEach(l => pivot.add(l.line))
    }).catch(console.error)

    // Raycaster for hover + click
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2(-99, -99)
    let isDrag = false, lx = 0, ly = 0
    let pointerDown: { x: number; y: number } | null = null

    const canvas = threeRef.current!

    const onMouseMove = (e: MouseEvent) => {
      mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
      if (isDrag) {
        pivot.rotation.y += (e.clientX - lx) * 0.006
        pivot.rotation.x += (e.clientY - ly) * 0.004
        lx = e.clientX; ly = e.clientY; return
      }
      // Hover
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(starsRef.current.map(s => s.hitMesh))
      if (hits.length) {
        const star = starsRef.current.find(s => s.hitMesh === hits[0].object)!
        const friend = getFriends().find(f => f.id === star.friendId) ?? null
        setHoveredFriend(friend)
        setHoverPos({ x: e.clientX + 22, y: e.clientY - 12 })
        highlightLines(linesRef.current, star.friendId)
        gsap.to(star.root.scale, { x:1.22, y:1.22, z:1.22, duration:.3, ease:'back.out(2)' })
      } else {
        setHoveredFriend(null)
        highlightLines(linesRef.current, null)
        starsRef.current.forEach(s => gsap.to(s.root.scale, { x:1, y:1, z:1, duration:.3 }))
      }
    }

    const onMouseDown = (e: MouseEvent) => {
      pointerDown = { x: e.clientX, y: e.clientY }
      isDrag = true; lx = e.clientX; ly = e.clientY
    }

    // Always resets drag state, even if the pointer is released over the FriendCard overlay.
    const onWindowMouseUp = () => { isDrag = false }

    // Only fires when the mouseup target is the canvas itself — clicks on the FriendCard
    // (higher z-index, pointerEvents:auto) never reach this handler, so its buttons work.
    const onCanvasMouseUp = (e: MouseEvent) => {
      const start = pointerDown
      pointerDown = null
      if (!start) return
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      if (moved >= 5) return

      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(starsRef.current.map(s => s.hitMesh))
      if (hits.length) {
        const star = starsRef.current.find(s => s.hitMesh === hits[0].object)!
        const friend = getFriends().find(f => f.id === star.friendId) ?? null
        setPinnedFriend(friend)
        setPinnedPos({ x: e.clientX + 22, y: e.clientY - 12 })
      } else {
        setPinnedFriend(null)
        setPinnedPos(null)
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPinnedFriend(null); setPinnedPos(null) }
    }

    const onWheel = (e: WheelEvent) => {
      camera.position.z = Math.max(3.5, Math.min(16, camera.position.z + e.deltaY * .007))
    }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mouseup', onCanvasMouseUp)
    window.addEventListener('mouseup', onWindowMouseUp)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('keydown', onKeyDown)
    canvas.addEventListener('wheel', onWheel, { passive: true })

    // Render loop
    let raf: number
    const loop = () => { raf = requestAnimationFrame(loop); renderer.render(scene, camera) }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onWindowMouseUp)
      window.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onCanvasMouseUp)
      canvas.removeEventListener('wheel', onWheel)
      disposeScene()
    }
  }, [])

  return (
    <>
      <canvas ref={threeRef} style={{ position:'fixed', inset:0, cursor:'none' }} />
      <canvas ref={trailRef} style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:5 }} />
      {!pinnedFriend && hoveredFriend && (
        <FriendCard
          friend={hoveredFriend}
          style={{ left: hoverPos.x, top: hoverPos.y }}
        />
      )}
      {pinnedFriend && pinnedPos && (
        <FriendCard
          friend={pinnedFriend}
          pinned
          onClose={() => { setPinnedFriend(null); setPinnedPos(null) }}
          style={{ left: pinnedPos.x, top: pinnedPos.y }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Manually verify**

Run: `npm run dev`, open `http://localhost:3000`, click through the orrery entry into the star map (need at least one friend — create one via `/friend/new` first if the map is empty).
Expected: clicking a star pins a `FriendCard` that stays in place while you move the mouse toward its "编辑" button; clicking "编辑" navigates to `/friend/[id]`; clicking empty space or pressing `Escape` closes the pinned card; dragging to rotate the star map still works and doesn't accidentally pin/unpin a card.

- [ ] **Step 4: Commit**

```bash
git add components/FriendCard.tsx components/StarMap/StarMap.tsx
git commit -m "fix: pin FriendCard on star click instead of hover-only tooltip"
```

---

### Task 6: `lib/growthStage.ts`

**Files:**
- Create: `lib/growthStage.ts`
- Create: `lib/growthStage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { getGrowthStage } from './growthStage'
import type { Friend } from './types'

function baseFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'f1', name: 'Test', important: false,
    likes: [], dislikes: [], hobbies: [],
    portraits: [], memories: [], relationships: [],
    starConfig: { kind:'nebula', coreColor:'#94a3b8', glowColor:'#cbd5e1', size:1, twinkleSpeed:2, position:[0,0,0] },
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  }
}

describe('getGrowthStage', () => {
  it('is dust when only the name is set', () => {
    expect(getGrowthStage(baseFriend()).stage).toBe('dust')
  })
  it('is young when birthday is set', () => {
    expect(getGrowthStage(baseFriend({ birthday: '2000-01-01' })).stage).toBe('young')
  })
  it('is young when notes is set', () => {
    expect(getGrowthStage(baseFriend({ notes: '大学同学' })).stage).toBe('young')
  })
  it('is bright when mbti is set', () => {
    expect(getGrowthStage(baseFriend({ mbti: 'ENFP' })).stage).toBe('bright')
  })
  it('is bright when likes is non-empty', () => {
    expect(getGrowthStage(baseFriend({ likes: ['咖啡'] })).stage).toBe('bright')
  })
  it('is bright when hobbies is non-empty', () => {
    expect(getGrowthStage(baseFriend({ hobbies: ['摄影'] })).stage).toBe('bright')
  })
  it('is stellar with 3 or more memories', () => {
    const memories = [1,2,3].map(n => ({ id:`m${n}`, date:'2026-01-01', title:`记录${n}`, content:'', tags:[], media:[] }))
    expect(getGrowthStage(baseFriend({ memories })).stage).toBe('stellar')
  })
  it('is constellation-core with relationships and 3+ memories', () => {
    const memories = [1,2,3].map(n => ({ id:`m${n}`, date:'2026-01-01', title:`记录${n}`, content:'', tags:[], media:[] }))
    const relationships = [{ friendId: 'f2', label: '同学', closeness: 2 as const }]
    expect(getGrowthStage(baseFriend({ memories, relationships })).stage).toBe('constellation-core')
  })
  it('provides a Chinese label and nextHint', () => {
    const result = getGrowthStage(baseFriend())
    expect(result.label).toBe('星尘')
    expect(result.nextHint.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- growthStage.test.ts`
Expected: FAIL with "Cannot find module './growthStage'"

- [ ] **Step 3: Implement `lib/growthStage.ts`**

```ts
import type { Friend } from './types'

export type GrowthStage = 'dust' | 'young' | 'bright' | 'stellar' | 'constellation-core'

const STAGE_LABEL: Record<GrowthStage, string> = {
  dust: '星尘',
  young: '幼星',
  bright: '亮星',
  stellar: '恒星',
  'constellation-core': '星座核心',
}

export function getGrowthStage(friend: Friend): {
  stage: GrowthStage
  label: string
  nextHint: string
} {
  const hasRelationships = friend.relationships.length > 0
  const memoryCount = friend.memories.length
  const hasPersonalityInfo = Boolean(friend.mbti) || friend.likes.length > 0 || friend.hobbies.length > 0
  const hasBasicInfo = Boolean(friend.birthday) || Boolean(friend.notes)

  let stage: GrowthStage
  if (hasRelationships && memoryCount >= 3) stage = 'constellation-core'
  else if (memoryCount >= 3) stage = 'stellar'
  else if (hasPersonalityInfo) stage = 'bright'
  else if (hasBasicInfo) stage = 'young'
  else stage = 'dust'

  let nextHint: string
  switch (stage) {
    case 'dust': nextHint = '填写生日或备注即可成长为幼星'; break
    case 'young': nextHint = '填写 MBTI、喜欢或兴趣爱好即可成长为亮星'; break
    case 'bright': nextHint = `还差 ${Math.max(3 - memoryCount, 0)} 条回忆即可成长为恒星`; break
    case 'stellar': nextHint = '添加共同好友即可成长为星座核心'; break
    case 'constellation-core': nextHint = '已经是最高阶段'; break
  }

  return { stage, label: STAGE_LABEL[stage], nextHint }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- growthStage.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/growthStage.ts lib/growthStage.test.ts
git commit -m "feat: add getGrowthStage to compute friend profile growth stage"
```

---

### Task 7: `lib/friendEnergy.ts`

**Files:**
- Create: `lib/friendEnergy.ts`
- Create: `lib/friendEnergy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { calculateFriendEnergy } from './friendEnergy'
import type { Friend, Memory } from './types'

function baseFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'f1', name: 'Test', important: false,
    likes: [], dislikes: [], hobbies: [],
    portraits: [], memories: [], relationships: [],
    starConfig: { kind:'nebula', coreColor:'#94a3b8', glowColor:'#cbd5e1', size:1, twinkleSpeed:2, position:[0,0,0] },
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function memory(overrides: Partial<Memory> = {}): Memory {
  return { id:'m1', date:'2026-01-01', title:'记录', content:'', tags:[], media:[], ...overrides }
}

const NOW = new Date('2026-07-01T00:00:00.000Z')

describe('calculateFriendEnergy', () => {
  it('is low with no memories or relationships', () => {
    const result = calculateFriendEnergy(baseFriend(), NOW)
    expect(result.level).toBe('low')
    expect(result.score).toBe(0)
    expect(result.lastActivityText).toBe('还没有记录')
  })
  it('adds 1 point per memory', () => {
    const result = calculateFriendEnergy(baseFriend({ memories: [memory(), memory({ id:'m2' })] }), NOW)
    expect(result.score).toBe(2)
  })
  it('adds 2 points for a memory with media', () => {
    const withMedia = memory({ media: [{ id:'md1', type:'photo', url:'x', thumbnailUrl:'x', size:1 }] })
    const result = calculateFriendEnergy(baseFriend({ memories: [withMedia] }), NOW)
    expect(result.score).toBe(3) // 1 (memory) + 2 (media)
  })
  it('adds 1 point for long memory content', () => {
    const longContent = memory({ content: 'x'.repeat(51) })
    const result = calculateFriendEnergy(baseFriend({ memories: [longContent] }), NOW)
    expect(result.score).toBe(2) // 1 (memory) + 1 (long content)
  })
  it('adds relationship closeness as points', () => {
    const result = calculateFriendEnergy(baseFriend({
      relationships: [{ friendId:'f2', label:'同学', closeness: 3 }],
    }), NOW)
    expect(result.score).toBe(3)
  })
  it('adds 3 points when the latest memory is within 30 days', () => {
    const recent = memory({ date: '2026-06-20' })
    const result = calculateFriendEnergy(baseFriend({ memories: [recent] }), NOW)
    expect(result.score).toBe(4) // 1 (memory) + 3 (recent)
    expect(result.lastActivityText).toBe('最近一次记录：2026-06-20')
  })
  it('does not add recency points when the latest memory is older than 30 days', () => {
    const old = memory({ date: '2026-01-01' })
    const result = calculateFriendEnergy(baseFriend({ memories: [old] }), NOW)
    expect(result.score).toBe(1) // just the memory point, no recency bonus
  })
  it('falls back to updatedAt for the recency bonus only when there are no memories', () => {
    const result = calculateFriendEnergy(baseFriend({ updatedAt: '2026-06-25T00:00:00.000Z' }), NOW)
    expect(result.score).toBe(3) // recency bonus from updatedAt
    expect(result.lastActivityText).toBe('还没有记录') // text never claims a memory that doesn't exist
  })
  it('reaches legendary at 13+ points', () => {
    const memories = [1,2,3,4,5].map(n => memory({ id:`m${n}`, date:'2026-06-25', content:'x'.repeat(51) }))
    const result = calculateFriendEnergy(baseFriend({ memories }), NOW)
    expect(result.score).toBeGreaterThanOrEqual(13)
    expect(result.level).toBe('legendary')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- friendEnergy.test.ts`
Expected: FAIL with "Cannot find module './friendEnergy'"

- [ ] **Step 3: Implement `lib/friendEnergy.ts`**

```ts
import type { Friend } from './types'

export type EnergyLevel = 'low' | 'medium' | 'high' | 'legendary'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function isWithin30Days(dateStr: string, now: Date): boolean {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return false
  const diff = now.getTime() - date.getTime()
  return diff >= 0 && diff <= THIRTY_DAYS_MS
}

export function calculateFriendEnergy(
  friend: Friend,
  now: Date = new Date(),
): {
  score: number
  level: EnergyLevel
  lastActivityText: string
} {
  let score = 0

  for (const memory of friend.memories) {
    score += 1
    if (memory.media.length > 0) score += 2
    if (memory.content.length > 50) score += 1
  }

  for (const rel of friend.relationships) {
    score += rel.closeness
  }

  const latestMemory = [...friend.memories].sort((a, b) => b.date.localeCompare(a.date))[0]
  const recencyDate = latestMemory ? latestMemory.date : friend.updatedAt
  if (isWithin30Days(recencyDate, now)) score += 3

  const level: EnergyLevel =
    score >= 13 ? 'legendary' :
    score >= 7  ? 'high' :
    score >= 3  ? 'medium' : 'low'

  const lastActivityText = latestMemory
    ? `最近一次记录：${latestMemory.date}`
    : '还没有记录'

  return { score, level, lastActivityText }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- friendEnergy.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/friendEnergy.ts lib/friendEnergy.test.ts
git commit -m "feat: add calculateFriendEnergy for relationship temperature scoring"
```

---

### Task 8: `lib/birthdayStatus.ts`

**Files:**
- Create: `lib/birthdayStatus.ts`
- Create: `lib/birthdayStatus.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { getBirthdayStatus } from './birthdayStatus'

const NOW = new Date(2026, 6, 1) // July 1, 2026 (local time, month is 0-indexed)

describe('getBirthdayStatus', () => {
  it('returns nulls when birthday is undefined', () => {
    const result = getBirthdayStatus(undefined, NOW)
    expect(result).toEqual({ daysUntil: null, label: null, isToday: false, isSoon: false })
  })
  it('returns nulls when birthday is malformed', () => {
    const result = getBirthdayStatus('not-a-date', NOW)
    expect(result.daysUntil).toBeNull()
  })
  it('detects today as the birthday', () => {
    const result = getBirthdayStatus('1990-07-01', NOW)
    expect(result.isToday).toBe(true)
    expect(result.isSoon).toBe(true)
    expect(result.label).toBe('今天生日 🎂')
    expect(result.daysUntil).toBe(0)
  })
  it('detects a birthday 3 days away as soon', () => {
    const result = getBirthdayStatus('1990-07-04', NOW)
    expect(result.daysUntil).toBe(3)
    expect(result.isSoon).toBe(true)
    expect(result.isToday).toBe(false)
    expect(result.label).toBe('3 天后生日')
  })
  it('does not flag a birthday 8 days away as soon', () => {
    const result = getBirthdayStatus('1990-07-09', NOW)
    expect(result.daysUntil).toBe(8)
    expect(result.isSoon).toBe(false)
    expect(result.label).toBeNull()
  })
  it('wraps to next year when the birthday already passed', () => {
    const result = getBirthdayStatus('1990-06-25', NOW)
    expect(result.isSoon).toBe(false)
    expect(result.daysUntil).toBeGreaterThan(300)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- birthdayStatus.test.ts`
Expected: FAIL with "Cannot find module './birthdayStatus'"

- [ ] **Step 3: Implement `lib/birthdayStatus.ts`**

```ts
function parseBirthday(birthday: string): { month: number; day: number } | null {
  const parts = birthday.split('-').map(Number)
  if (parts.length !== 3) return null
  const [, month, day] = parts
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null
  return { month, day }
}

export function getBirthdayStatus(
  birthday?: string,
  now: Date = new Date(),
): {
  daysUntil: number | null
  label: string | null
  isToday: boolean
  isSoon: boolean
} {
  const parsed = birthday ? parseBirthday(birthday) : null
  if (!parsed) {
    return { daysUntil: null, label: null, isToday: false, isSoon: false }
  }

  const { month, day } = parsed
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let nextBirthday = new Date(now.getFullYear(), month - 1, day)
  if (nextBirthday < today) {
    nextBirthday = new Date(now.getFullYear() + 1, month - 1, day)
  }
  const daysUntil = Math.round((nextBirthday.getTime() - today.getTime()) / 86400000)

  if (daysUntil === 0) {
    return { daysUntil, label: '今天生日 🎂', isToday: true, isSoon: true }
  }
  if (daysUntil <= 7) {
    return { daysUntil, label: `${daysUntil} 天后生日`, isToday: false, isSoon: true }
  }
  return { daysUntil, label: null, isToday: false, isSoon: false }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- birthdayStatus.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/birthdayStatus.ts lib/birthdayStatus.test.ts
git commit -m "feat: add getBirthdayStatus with timezone-safe date parsing"
```

---

### Task 9: `lib/conversationHint.ts`

**Files:**
- Create: `lib/conversationHint.ts`
- Create: `lib/conversationHint.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { generateConversationHint } from './conversationHint'
import type { Friend } from './types'

function baseFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'f1', name: 'Test', important: false,
    likes: [], dislikes: [], hobbies: [],
    portraits: [], memories: [], relationships: [],
    starConfig: { kind:'nebula', coreColor:'#94a3b8', glowColor:'#cbd5e1', size:1, twinkleSpeed:2, position:[0,0,0] },
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  }
}

describe('generateConversationHint', () => {
  it('uses the latest memory title when memories exist', () => {
    const memories = [
      { id:'m1', date:'2026-01-01', title:'第一次吃饭', content:'', tags:[], media:[] },
      { id:'m2', date:'2026-06-01', title:'一起看展', content:'', tags:[], media:[] },
    ]
    const hint = generateConversationHint(baseFriend({ memories }))
    expect(hint).toBe('下次可以问问 TA 最近的『一起看展』')
  })
  it('falls back to hobbies when there are no memories', () => {
    const hint = generateConversationHint(baseFriend({ hobbies: ['摄影', '爬山'] }))
    expect(hint).toBe('可以聊聊 TA 的兴趣爱好：摄影')
  })
  it('falls back to likes when there are no memories or hobbies', () => {
    const hint = generateConversationHint(baseFriend({ likes: ['咖啡'] }))
    expect(hint).toBe('可以聊聊 TA 喜欢的：咖啡')
  })
  it('gives a generic prompt when there is no data at all', () => {
    const hint = generateConversationHint(baseFriend())
    expect(hint).toBe('还不了解 TA，下次可以多问问喜好')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- conversationHint.test.ts`
Expected: FAIL with "Cannot find module './conversationHint'"

- [ ] **Step 3: Implement `lib/conversationHint.ts`**

```ts
import type { Friend } from './types'

export function generateConversationHint(friend: Friend): string {
  const latestMemory = [...friend.memories].sort((a, b) => b.date.localeCompare(a.date))[0]
  if (latestMemory) {
    return `下次可以问问 TA 最近的『${latestMemory.title}』`
  }
  if (friend.hobbies.length > 0) {
    return `可以聊聊 TA 的兴趣爱好：${friend.hobbies[0]}`
  }
  if (friend.likes.length > 0) {
    return `可以聊聊 TA 喜欢的：${friend.likes[0]}`
  }
  return '还不了解 TA，下次可以多问问喜好'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- conversationHint.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/conversationHint.ts lib/conversationHint.test.ts
git commit -m "feat: add generateConversationHint template-based suggestions"
```

---

### Task 10: `lib/profileCompletion.ts`

**Files:**
- Create: `lib/profileCompletion.ts`
- Create: `lib/profileCompletion.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { calculateProfileCompletion } from './profileCompletion'
import type { Friend } from './types'

function baseFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'f1', name: 'Test', important: false,
    likes: [], dislikes: [], hobbies: [],
    portraits: [], memories: [], relationships: [],
    starConfig: { kind:'nebula', coreColor:'#94a3b8', glowColor:'#cbd5e1', size:1, twinkleSpeed:2, position:[0,0,0] },
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  }
}

describe('calculateProfileCompletion', () => {
  it('is 0% with only a name', () => {
    const result = calculateProfileCompletion(baseFriend())
    expect(result.percent).toBe(0)
    expect(result.missing).toHaveLength(8)
  })
  it('adds 15 for birthday', () => {
    expect(calculateProfileCompletion(baseFriend({ birthday: '2000-01-01' })).percent).toBe(15)
  })
  it('adds 10 for mbti', () => {
    expect(calculateProfileCompletion(baseFriend({ mbti: 'ENFP' })).percent).toBe(10)
  })
  it('adds 15 for likes', () => {
    expect(calculateProfileCompletion(baseFriend({ likes: ['咖啡'] })).percent).toBe(15)
  })
  it('adds 10 for dislikes', () => {
    expect(calculateProfileCompletion(baseFriend({ dislikes: ['吵闹'] })).percent).toBe(10)
  })
  it('adds 10 for hobbies', () => {
    expect(calculateProfileCompletion(baseFriend({ hobbies: ['摄影'] })).percent).toBe(10)
  })
  it('adds 10 for notes', () => {
    expect(calculateProfileCompletion(baseFriend({ notes: '大学同学' })).percent).toBe(10)
  })
  it('adds 20 for at least one memory', () => {
    const memories = [{ id:'m1', date:'2026-01-01', title:'记录', content:'', tags:[], media:[] }]
    expect(calculateProfileCompletion(baseFriend({ memories })).percent).toBe(20)
  })
  it('adds 10 for a photo in portraits', () => {
    const portraits = [{ id:'p1', type:'photo' as const, url:'x', thumbnailUrl:'x', size:1 }]
    expect(calculateProfileCompletion(baseFriend({ portraits })).percent).toBe(10)
  })
  it('adds 10 for a photo inside a memory even with no portraits', () => {
    const memories = [{
      id:'m1', date:'2026-01-01', title:'记录', content:'', tags:[],
      media:[{ id:'md1', type:'photo' as const, url:'x', thumbnailUrl:'x', size:1 }],
    }]
    const result = calculateProfileCompletion(baseFriend({ memories }))
    expect(result.percent).toBe(30) // 20 (at least one memory) + 10 (photo found via memory media)
    expect(result.missing).not.toContain('至少一张照片')
  })
  it('is 100% with everything filled in', () => {
    const memories = [{ id:'m1', date:'2026-01-01', title:'记录', content:'', tags:[], media:[] }]
    const portraits = [{ id:'p1', type:'photo' as const, url:'x', thumbnailUrl:'x', size:1 }]
    const result = calculateProfileCompletion(baseFriend({
      birthday: '2000-01-01', mbti: 'ENFP', likes: ['咖啡'], dislikes: ['吵闹'],
      hobbies: ['摄影'], notes: '大学同学', memories, portraits,
    }))
    expect(result.percent).toBe(100)
    expect(result.missing).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- profileCompletion.test.ts`
Expected: FAIL with "Cannot find module './profileCompletion'"

- [ ] **Step 3: Implement `lib/profileCompletion.ts`**

```ts
import type { Friend } from './types'

const WEIGHTS = {
  birthday: 15,
  mbti: 10,
  likes: 15,
  dislikes: 10,
  hobbies: 10,
  notes: 10,
  memory: 20,
  photo: 10,
} as const

const LABELS: Record<keyof typeof WEIGHTS, string> = {
  birthday: '生日',
  mbti: 'MBTI',
  likes: '喜欢的东西',
  dislikes: '讨厌的东西',
  hobbies: '兴趣爱好',
  notes: '备注',
  memory: '至少一条回忆',
  photo: '至少一张照片',
}

export function calculateProfileCompletion(friend: Friend): {
  percent: number
  missing: string[]
} {
  const hasPhoto = friend.portraits.some(m => m.type === 'photo')
    || friend.memories.some(memory => memory.media.some(m => m.type === 'photo'))

  const checks: Record<keyof typeof WEIGHTS, boolean> = {
    birthday: Boolean(friend.birthday),
    mbti: Boolean(friend.mbti),
    likes: friend.likes.length > 0,
    dislikes: friend.dislikes.length > 0,
    hobbies: friend.hobbies.length > 0,
    notes: Boolean(friend.notes),
    memory: friend.memories.length > 0,
    photo: hasPhoto,
  }

  let percent = 0
  const missing: string[] = []
  for (const key of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
    if (checks[key]) percent += WEIGHTS[key]
    else missing.push(LABELS[key])
  }

  return { percent, missing }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- profileCompletion.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/profileCompletion.ts lib/profileCompletion.test.ts
git commit -m "feat: add calculateProfileCompletion with weighted field scoring"
```

---

### Task 11: `FriendCard.tsx` content upgrade

**Files:**
- Modify: `components/FriendCard.tsx`

- [ ] **Step 1: Replace the full file content**

```tsx
'use client'
import type { CSSProperties } from 'react'
import type { Friend } from '@/lib/types'
import Link from 'next/link'
import { getGrowthStage } from '@/lib/growthStage'
import { calculateFriendEnergy } from '@/lib/friendEnergy'
import { generateConversationHint } from '@/lib/conversationHint'
import { getBirthdayStatus } from '@/lib/birthdayStatus'
import { calculateProfileCompletion } from '@/lib/profileCompletion'

interface Props {
  friend: Friend
  style?: CSSProperties
  pinned?: boolean
  onClose?: () => void
}

export default function FriendCard({ friend, style, pinned, onClose }: Props) {
  const growth = getGrowthStage(friend)
  const energy = calculateFriendEnergy(friend)
  const hint = generateConversationHint(friend)
  const birthday = getBirthdayStatus(friend.birthday)
  const completion = calculateProfileCompletion(friend)

  const meta = [friend.mbti, friend.zodiac, growth.label].filter(Boolean).join(' · ')
  const energyPercent = Math.round(Math.min(energy.score / 15, 1) * 100)

  return (
    <div style={{
      position:'fixed', zIndex:20, minWidth:220, maxWidth:260,
      background:'rgba(4,7,20,0.94)', border:'1px solid rgba(226,185,111,0.3)',
      borderRadius:12, padding:'16px 20px',
      backdropFilter:'blur(12px)', pointerEvents:'auto',
      ...style,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div style={{ color:'#e2b96f', fontSize:16 }}>{friend.name}</div>
        {pinned && (
          <button type="button" onClick={onClose} style={{
            background:'none', border:'none', color:'rgba(226,185,111,0.5)',
            cursor:'pointer', fontSize:14, lineHeight:1, padding:0,
          }}>✕</button>
        )}
      </div>

      {meta && <div style={{ color:'rgba(155,142,196,0.75)', fontSize:10, marginTop:4 }}>{meta}</div>}

      {(friend.important || birthday.label) && (
        <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
          {friend.important && <span style={{ color:'#e2b96f', fontSize:10 }}>✦ 重要</span>}
          {birthday.label && <span style={{ color:'#e2b96f', fontSize:10 }}>{birthday.label}</span>}
        </div>
      )}

      <div style={{ marginTop:10, fontSize:11, color:'#e2e8f0', lineHeight:1.8 }}>
        <div>关系温度：{energy.level}（{energyPercent}%）</div>
        <div style={{ color:'rgba(155,142,196,0.7)' }}>{energy.lastActivityText}</div>
      </div>

      <div style={{ marginTop:8, fontSize:11, color:'rgba(226,185,111,0.85)', lineHeight:1.6 }}>
        下次可以聊：{hint}
      </div>

      {completion.percent < 100 && (
        <div style={{ marginTop:8, fontSize:10, color:'rgba(155,142,196,0.6)', lineHeight:1.6 }}>
          档案完整度：{completion.percent}%<br/>
          建议补充：{completion.missing.join('、')}
        </div>
      )}

      <div style={{ marginTop:12, display:'flex', gap:8 }}>
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
```

- [ ] **Step 2: Manually verify**

Run: `npm run dev`, click a star with an incomplete profile.
Expected: pinned card shows 关系温度/最近一次记录/下次可以聊/档案完整度 with 建议补充 list; a friend with a fully filled profile does not show the "档案完整度" block at all (since `completion.percent === 100`).

- [ ] **Step 3: Commit**

```bash
git add components/FriendCard.tsx
git commit -m "feat: show growth stage, relationship temperature, and conversation hint on FriendCard"
```

---

### Task 12: `StarBuilder.ts` — growth stage size, guardian ring, birthday ring

**Files:**
- Modify: `components/StarMap/StarBuilder.ts`

- [ ] **Step 1: Replace the full file content**

```ts
import * as THREE from 'three'
import { gsap } from 'gsap'
import type { Friend } from '@/lib/types'
import { getGrowthStage, type GrowthStage } from '@/lib/growthStage'
import { getBirthdayStatus } from '@/lib/birthdayStatus'

function radialTex(size: number, stops: [number,string][]): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size
  const ctx = c.getContext('2d')!, r = size/2
  const g = ctx.createRadialGradient(r,r,0,r,r,r)
  stops.forEach(([t,col]) => g.addColorStop(t,col))
  ctx.fillStyle = g; ctx.fillRect(0,0,size,size)
  return new THREE.CanvasTexture(c)
}

function burstTex(size: number, color: string, rays=8): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size
  const ctx = c.getContext('2d')!, r = size/2
  const g = ctx.createRadialGradient(r,r,0,r,r,r)
  g.addColorStop(0,'rgba(255,255,255,1)')
  g.addColorStop(0.08,color.replace(')',',0.95)').replace('rgb','rgba'))
  g.addColorStop(0.35,color.replace(')',',0.4)').replace('rgb','rgba'))
  g.addColorStop(0.75,color.replace(')',',0.08)').replace('rgb','rgba'))
  g.addColorStop(1,'rgba(0,0,0,0)')
  ctx.fillStyle = g; ctx.fillRect(0,0,size,size)
  ctx.save(); ctx.translate(r,r); ctx.globalCompositeOperation='screen'
  for (let i=0;i<rays;i++) {
    const ang=(i/rays)*Math.PI*2
    const lg=ctx.createLinearGradient(0,0,Math.cos(ang)*r*.88,Math.sin(ang)*r*.88)
    lg.addColorStop(0,'rgba(255,255,255,0.85)'); lg.addColorStop(.35,'rgba(255,255,255,0.2)'); lg.addColorStop(1,'rgba(255,255,255,0)')
    ctx.fillStyle=lg; ctx.save(); ctx.rotate(ang)
    ctx.beginPath(); ctx.moveTo(-1,0); ctx.lineTo(1,0); ctx.lineTo(0,r*.84); ctx.closePath()
    ctx.fill(); ctx.restore()
  }
  ctx.restore()
  return new THREE.CanvasTexture(c)
}

function ringTex(size: number, color: string, w=0.1): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size
  const ctx = c.getContext('2d')!, r = size/2, inner=r*(1-w*2.2), outer=r*(1-w*.3)
  const g = ctx.createRadialGradient(r,r,inner,r,r,outer)
  g.addColorStop(0,'rgba(0,0,0,0)')
  g.addColorStop(.35,color.replace(')',',0.65)').replace('rgb','rgba'))
  g.addColorStop(.7,color.replace(')',',0.3)').replace('rgb','rgba'))
  g.addColorStop(1,'rgba(0,0,0,0)')
  ctx.fillStyle=g; ctx.fillRect(0,0,size,size)
  return new THREE.CanvasTexture(c)
}

function sp(tex: THREE.Texture, scale: number, op=1.0): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false }))
  s.scale.set(scale,scale,1); return s
}

export interface StarObject {
  root: THREE.Group
  hitMesh: THREE.Mesh
  friendId: string
}

const STAGE_SIZE: Record<GrowthStage, number> = {
  dust: 0.55, young: 0.75, bright: 1.0, stellar: 1.15, 'constellation-core': 1.3,
}

export function buildStar(friend: Friend): StarObject {
  const { starConfig: cfg } = friend
  const root = new THREE.Group()
  root.position.set(...cfg.position)

  const stageInfo = getGrowthStage(friend)
  const birthdayInfo = getBirthdayStatus(friend.birthday)

  const size = cfg.size * STAGE_SIZE[stageInfo.stage]
  const twinkleSpeed = stageInfo.stage === 'dust' ? cfg.twinkleSpeed * 1.6 : cfg.twinkleSpeed

  const hex = (h: string) => `rgb(${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)})`
  const coreRgb = hex(cfg.coreColor)
  const glowRgb = hex(cfg.glowColor)

  switch (cfg.kind) {
    case 'radiant': {
      const core = sp(burstTex(256,coreRgb,8), size*.82)
      root.add(core)
      root.add(sp(radialTex(128,[[0,`rgba(0,0,0,0)`],[.3,`${cfg.glowColor}28`],[.72,`${cfg.glowColor}10`],[1,'rgba(0,0,0,0)']]),size*1.8))
      const rot = sp(burstTex(256,glowRgb,4), size*.76, .35); root.add(rot)
      gsap.to(rot.material,{rotation:Math.PI*2, duration:18, repeat:-1, ease:'none'})
      const dg=new THREE.Group(); root.add(dg)
      const dot=sp(radialTex(64,[[0,'rgba(255,255,200,1)'],[.4,'rgba(255,200,80,0.6)'],[1,'rgba(0,0,0,0)']]),size*.16)
      dot.position.set(size*.48,0,0); dg.add(dot)
      gsap.to(dg.rotation,{z:-Math.PI*2, duration:7, repeat:-1, ease:'none'})
      gsap.to(core.material,{opacity:.72, duration:twinkleSpeed*.7, repeat:-1, yoyo:true, ease:'sine.inOut'})
      break
    }
    case 'nebula': {
      const core=sp(radialTex(256,[[0,'rgba(255,255,255,1)'],[.06,`${cfg.coreColor}f2`],[.25,`${cfg.glowColor}80`],[.55,`${cfg.coreColor}2d`],[.82,`${cfg.coreColor}0f`],[1,'rgba(0,0,0,0)']]),size*.76); root.add(core)
      const h1=sp(ringTex(256,glowRgb,.11),size*1.35,.48); root.add(h1)
      gsap.to(h1.material,{rotation:Math.PI*2, duration:22, repeat:-1, ease:'none'})
      const h2=sp(ringTex(256,coreRgb,.07),size*2.0,.28); root.add(h2)
      gsap.to(h2.material,{rotation:-Math.PI*2, duration:36, repeat:-1, ease:'none'})
      gsap.to(core.material,{opacity:.65, duration:twinkleSpeed, repeat:-1, yoyo:true, ease:'sine.inOut', delay:.8})
      break
    }
    case 'blossom': {
      const core=sp(burstTex(256,coreRgb,6),size*.70); root.add(core)
      root.add(sp(radialTex(128,[[0,'rgba(253,164,175,0)'],[.4,'rgba(253,164,175,0.18)'],[.76,'rgba(251,113,133,0.07)'],[1,'rgba(0,0,0,0)']]),size*1.65))
      for(let i=0;i<5;i++){
        const ang=(i/5)*Math.PI*2, pg=new THREE.Group(); root.add(pg)
        const p=sp(radialTex(64,[[0,'rgba(255,200,210,1)'],[.4,'rgba(253,164,175,0.6)'],[1,'rgba(0,0,0,0)']]),size*.14+Math.random()*.07,.75)
        p.position.set(Math.cos(ang)*size*.42,Math.sin(ang)*size*.42,0); pg.add(p)
        gsap.to(pg.rotation,{z:-Math.PI*2, duration:8+i*1.5, repeat:-1, ease:'none'})
        gsap.to(p.material,{opacity:.18, duration:(8+i*1.5)/5, repeat:-1, yoyo:true, ease:'sine.inOut', delay:i*.3})
      }
      gsap.to(core.material,{opacity:.68, duration:twinkleSpeed, repeat:-1, yoyo:true, ease:'sine.inOut'})
      break
    }
    case 'giant': {
      const core=sp(radialTex(256,[[0,'rgba(255,255,220,1)'],[.08,`${cfg.coreColor}f2`],[.28,`${cfg.coreColor}ad`],[.55,`${cfg.coreColor}47`],[.82,`${cfg.coreColor}17`],[1,'rgba(0,0,0,0)']]),size*.98); root.add(core)
      ;[[1.05,1.55,.26],[1.2,1.75,.15],[1.35,1.95,.09]].forEach(([i,o,op])=>{
        const rg=new THREE.RingGeometry(i*.75*size,o*.75*size,96)
        const rm=new THREE.MeshBasicMaterial({color:0xe2b96f,side:THREE.DoubleSide,transparent:true,opacity:op,blending:THREE.AdditiveBlending})
        const ring=new THREE.Mesh(rg,rm); ring.rotation.x=1.1; ring.rotation.z=.25; root.add(ring)
        gsap.to(ring.rotation,{z:ring.rotation.z+Math.PI*2, duration:28, repeat:-1, ease:'none'})
      })
      gsap.to(core.material,{opacity:.72, duration:twinkleSpeed, repeat:-1, yoyo:true, ease:'sine.inOut'})
      break
    }
    case 'pulsar': {
      const core=sp(burstTex(256,coreRgb,4),size*.54); root.add(core)
      root.add(sp(radialTex(128,[[0,'rgba(0,0,0,0)'],[.5,`${cfg.coreColor}1a`],[.82,`${cfg.coreColor}0a`],[1,'rgba(0,0,0,0)']]),size*1.5))
      for(let p=0;p<3;p++){
        const ring=sp(ringTex(128,glowRgb,.15),size*.45,.5); root.add(ring)
        const tl=gsap.timeline({repeat:-1,delay:p*.38})
        tl.fromTo(ring.scale,{x:.3,y:.3},{x:1.8,y:1.8,duration:1.1,ease:'power1.out'})
          .fromTo(ring.material,{opacity:.55},{opacity:0,duration:1.1,ease:'power1.out'},'<')
      }
      gsap.to(core.material,{opacity:.38, duration:twinkleSpeed*.3, repeat:-1, yoyo:true, ease:'sine.inOut'})
      break
    }
    case 'twin': {
      ;[{col:coreRgb,r:.30,spd:4.5,sz:.44},{col:glowRgb,r:.30,spd:4.5,sz:.33}].forEach((p,pi)=>{
        const og=new THREE.Group(); root.add(og)
        const star=sp(burstTex(128,p.col,6),p.sz*size)
        star.position.set(p.r*(pi===0?1:-1)*size,0,0); og.add(star)
        const gh=sp(radialTex(64,[[0,'rgba(0,0,0,0)'],[.45,'rgba(180,170,255,0.22)'],[1,'rgba(0,0,0,0)']]),p.sz*2.0*size)
        gh.position.copy(star.position); og.add(gh)
        gsap.to(og.rotation,{z:(pi===0?-1:1)*Math.PI*2, duration:p.spd*(pi===0?1:1.1), repeat:-1, ease:'none'})
        gsap.to(star.material,{opacity:.62, duration:twinkleSpeed, repeat:-1, yoyo:true, ease:'sine.inOut', delay:pi*.8})
      })
      root.add(sp(radialTex(128,[[0,'rgba(200,190,255,0.55)'],[.38,'rgba(167,139,250,0.12)'],[1,'rgba(0,0,0,0)']]),size*.75))
      break
    }
  }

  if (friend.important) {
    const guardRing = sp(ringTex(256, 'rgb(226,185,111)', .06), size * 2.3, .22)
    root.add(guardRing)
    gsap.to(guardRing.rotation, { z: Math.PI * 2, duration: 40, repeat: -1, ease: 'none' })
  }

  if (birthdayInfo.isSoon || birthdayInfo.isToday) {
    const bRing = sp(ringTex(256, 'rgb(226,185,111)', .1), size * 2.7, .5)
    root.add(bRing)
    const pulseDuration = birthdayInfo.isToday ? .5 : 1.1
    gsap.to(bRing.scale, { x: size*2.9, y: size*2.9, duration: pulseDuration, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    gsap.to(bRing.material, { opacity: birthdayInfo.isToday ? .75 : .35, duration: pulseDuration, repeat: -1, yoyo: true, ease: 'sine.inOut' })
  }

  root.scale.setScalar(0)
  gsap.to(root.scale,{x:1,y:1,z:1, duration:1.4, ease:'back.out(2)'})

  const hitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(size*.55,8,8),
    new THREE.MeshBasicMaterial({visible:false})
  )
  root.add(hitMesh)

  return { root, hitMesh, friendId: friend.id }
}
```

- [ ] **Step 2: Manually verify**

Run: `npm run dev`.
1. Create a friend with only a name → its star should render noticeably smaller/dimmer than a fully-filled friend's star (dust stage, `size` multiplier 0.55).
2. Add 3 memories to that friend via `/friend/[id]`, then return to `/` → the star should be visibly larger (stellar stage, multiplier 1.15) without re-submitting the form.
3. Mark a friend "重要" in the full-mode form → its star should show a slow-rotating gold ring around it.
4. Set a friend's birthday to 3 days from today → its star should show a pulsing gold ring.

- [ ] **Step 3: Commit**

```bash
git add components/StarMap/StarBuilder.ts
git commit -m "feat: render growth stage size, guardian ring, and birthday ring on stars"
```

---

### Task 13: Global `select`/`option` contrast fix

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Append the dark select styles**

Add to the end of `app/globals.css`:

```css

select {
  background-color: #0d1428;
  color: #f1e9d8;
}
select option {
  background-color: #0d1428;
  color: #f1e9d8;
}
```

- [ ] **Step 2: Manually verify**

Run: `npm run dev`, open `/friend/new`, switch to "完整档案", open the MBTI dropdown. Also open an existing friend's edit page and open the "选择好友"/"亲密度" dropdowns in the relationship editor.
Expected: dropdown option list has a dark background with light gold/cream text, readable in Chrome/Edge.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "fix: dark background for select/option dropdowns to fix low contrast"
```

---

### Task 14: Optional-field guards in atlas page and stub API

**Files:**
- Modify: `app/atlas/[friendId]/page.tsx`
- Modify: `app/api/generate-atlas/route.ts`

- [ ] **Step 1: Fix `app/atlas/[friendId]/page.tsx`**

Replace line 82 (`<div style={{ color:'rgba(155,142,196,0.6)', fontSize:11, marginTop:6 }}>{friend.mbti} · {friend.zodiac}</div>`) with:

```tsx
{[friend.mbti, friend.zodiac].filter(Boolean).join(' · ') && (
  <div style={{ color:'rgba(155,142,196,0.6)', fontSize:11, marginTop:6 }}>
    {[friend.mbti, friend.zodiac].filter(Boolean).join(' · ')}
  </div>
)}
```

- [ ] **Step 2: Fix `app/api/generate-atlas/route.ts`**

Replace the `atlas` object construction with:

```ts
export async function POST(req: NextRequest) {
  const friend: Friend = await req.json()

  const traits = [friend.zodiac, friend.mbti].filter(Boolean).join('的')
  const summary = traits
    ? `${friend.name}是一个${traits}，个性独特，值得深交。`
    : `${friend.name}的故事还在慢慢展开，个性独特，值得深交。`
  const personality = friend.mbti
    ? `作为${friend.mbti}类型，${friend.name}在人际关系中展现出独特的魅力...`
    : `${friend.name}在人际关系中展现出独特的魅力...`

  // Stub — replace with Claude API call in next phase
  const atlas: Atlas = {
    id:          crypto.randomUUID(),
    friendId:    friend.id,
    generatedAt: new Date().toISOString(),
    summary,
    personality,
    predictions: `根据${friend.name}的星座特征和性格类型，预计在艺术、创意领域有较强共鸣。`,
    giftIdeas:   ['手工制品', '独特体验', '个性化定制礼物'],
    warnings:    ['需要给予足够的个人空间', '避免在公开场合批评'],
    rawInput:    { id:friend.id, name:friend.name, mbti:friend.mbti, zodiac:friend.zodiac, likes:friend.likes },
  }

  return NextResponse.json(atlas)
}
```

- [ ] **Step 3: Manually verify**

Run: `npm run dev`, generate an atlas for a friend that has no MBTI/zodiac set.
Expected: no literal `undefined` appears anywhere in the summary text or on the atlas page header.

- [ ] **Step 4: Commit**

```bash
git add "app/atlas/[friendId]/page.tsx" app/api/generate-atlas/route.ts
git commit -m "fix: guard optional mbti/zodiac in atlas page and generation stub"
```

---

### Task 15: Full test suite + manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `npm run test`
Expected: all test files pass (`types` has no test file; `store.test.ts`, `starGen.test.ts`, `zodiac.test.ts`, `growthStage.test.ts`, `friendEnergy.test.ts`, `birthdayStatus.test.ts`, `conversationHint.test.ts`, `profileCompletion.test.ts` all green).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors (warnings acceptable only if they already existed before this plan).

- [ ] **Step 3: Manual walkthrough**

Run: `npm run dev`, then work through this checklist end to end:

1. `/friend/new` defaults to "快速添加"; saving with only a name succeeds
2. New friend's star appears on `/` at dust size (small/dim)
3. Click the star → FriendCard pins in place
4. Move mouse from the star toward the card's "编辑" button without the card disappearing, then click it → navigates to `/friend/[id]`
5. Edit page defaults to "完整档案"; MBTI dropdown text is readable when opened
6. Add a birthday within 7 days, save, return to `/` → star shows a pulsing gold ring, FriendCard shows "N 天后生日"
7. Mark the friend "重要", save, return to `/` → star shows a slow gold guardian ring
8. Add 3 memories via `/friend/[id]` (no need to re-save the form) → return to `/`, star is visibly larger (stellar stage)
9. FriendCard shows 关系温度/最近一次记录/下次可以聊/档案完整度 with sensible values
10. Click empty space or press `Escape` → pinned card closes
11. Refresh the page → all data persists (localStorage)
12. Create a legacy-shaped record directly in `localStorage` (e.g. via devtools: `localStorage.setItem('yj_friends', JSON.stringify([{id:'x',name:'Old',createdAt:'2026-01-01',updatedAt:'2026-01-01'}]))` then reload) → app does not crash, star renders

- [ ] **Step 4: Report status**

No commit for this task — if all checks pass, the v0.2 batch is complete. If any manual check fails, file it as a follow-up rather than silently patching outside this plan's tasks.

---

## Self-Review Notes

- **Spec coverage:** All ten numbered sections of the design spec (二.1–二.4 bug fixes, 三 data model, 四.2 five lib modules, 四.3 StarBuilder, 四.4 starGen, 四.5 FriendCard, 五 Supabase no-op, 七 file list including the atlas page/route fix) map to Tasks 1–14. Task 15 covers 九 (testing plan) end to end.
- **Placeholder scan:** no TBD/"add appropriate handling"-style steps; every code step contains complete, runnable file contents or exact diffs.
- **Type consistency:** `GrowthStage` type and `getGrowthStage` return shape (Task 6) match the import and usage in `StarBuilder.ts` (Task 12) and `FriendCard.tsx` (Task 11). `calculateFriendEnergy(friend, now?)` signature matches its only two call sites (FriendCard with default `now`, and its own tests with fixed `now`). `getBirthdayStatus(birthday?, now?)` signature is consistent across Task 8's implementation, Task 11's FriendCard usage (default `now`), and Task 12's StarBuilder usage (default `now`). `generateStarConfig`'s new `(mbti: string | undefined, zodiac: string | undefined, ...)` signature (Task 3) matches its only call site in `FriendForm.tsx` (Task 4: `generateStarConfig(mbti || undefined, zodiac, ...)`).
