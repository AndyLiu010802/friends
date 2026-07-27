# v0.3 Memory Timeline Edit/Delete + Relationship Line Priority + Today's Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between the v0.3 design doc (`docs/superpowers/plans/../../../` — see project root design doc) and the current codebase: add memory edit/delete, fix pinned-vs-hover relationship-line priority, add shared-tags/lonely-star/insights utilities with tests, build the InsightPanel, and enhance FriendCard — without touching scene/camera/StarBuilder internals.

**Architecture:** Most of the v0.3 spec (MemoryTimeline add, RelationshipEditor add/remove, constellationLines closeness styling, hover highlighting, growthStage/friendEnergy/profileCompletion/birthdayStatus) is **already implemented and working** — confirmed by reading the current source. This plan implements only the real gaps:

1. `MemoryTimeline` has add-only; needs edit + delete + empty state.
2. `StarMap.tsx`'s `onMouseMove`/`onCanvasMouseUp`/`onKeyDown` closures are created once inside a `useEffect` with `[]` deps, so they capture a stale `pinnedFriend` value (always `null`) — hover always overrides the pinned friend's line highlight, which contradicts the spec. Fix with a ref.
3. `lib/sharedTags.ts`, `lib/lonelyStar.ts`, `lib/insights.ts`, `lib/dateUtils.ts` don't exist — new pure-logic modules, each with a Vitest test file following the existing local-fixture convention (see `lib/growthStage.test.ts`).
4. `components/InsightPanel.tsx` doesn't exist — new component.
5. `FriendCard.tsx` is missing latest-memory, lonely-star message, relationship count, and shared-tags display.
6. `StarMap` self-loads friends via `pullAll()+getFriends()` inside its own effect and takes no props. It needs a minimal `selectedFriendId` prop so `InsightPanel` clicks can pin a friend, without a bigger refactor.

**Tech Stack:** Next.js (App Router, client components), TypeScript, Three.js (StarMap), Vitest + jsdom for unit tests, localStorage-backed `lib/store.ts` with best-effort Supabase sync via `lib/supabase.ts`.

---

## File Structure

New files:
- `lib/dateUtils.ts` — `parseDateOnly`, `daysBetween` (local-date-safe, no UTC-parsing bugs)
- `lib/dateUtils.test.ts`
- `lib/sharedTags.ts` — `getFriendTags`, `getSharedTags`
- `lib/sharedTags.test.ts`
- `lib/lonelyStar.ts` — `isLonelyStar`
- `lib/lonelyStar.test.ts`
- `lib/insights.ts` — `FriendInsightType`, `FriendInsight`, `generateFriendInsights`
- `lib/insights.test.ts`
- `components/InsightPanel.tsx`

Modified files:
- `components/MemoryTimeline.tsx` — add edit + delete + empty state + button copy
- `components/FriendCard.tsx` — latest memory, lonely-star message, relationship count, shared tags
- `components/StarMap/StarMap.tsx` — pinned-priority line highlighting fix + `selectedFriendId` prop
- `app/page.tsx` — load friends, track `selectedFriendId`, render `InsightPanel`

No changes to: `components/StarMap/scene.ts`, `StarBuilder.ts`, `starfield.ts`, `mouseTrail.ts`, `components/StarMap/constellationLines.ts`, `components/RelationshipEditor.tsx`, `components/FriendForm.tsx`, `lib/store.ts`, `lib/supabase.ts`, `lib/types.ts`, `lib/growthStage.ts`, `lib/friendEnergy.ts`, `lib/profileCompletion.ts`, `lib/birthdayStatus.ts`, `lib/conversationHint.ts`.

---

### Task 1: `lib/dateUtils.ts` — local-date-safe day math

**Files:**
- Create: `lib/dateUtils.ts`
- Test: `lib/dateUtils.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/dateUtils.test.ts
import { describe, it, expect } from 'vitest'
import { parseDateOnly, daysBetween } from './dateUtils'

describe('parseDateOnly', () => {
  it('parses a YYYY-MM-DD string into a local Date at midnight', () => {
    const d = parseDateOnly('2026-07-01')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(6)
    expect(d!.getDate()).toBe(1)
  })
  it('returns null for malformed input', () => {
    expect(parseDateOnly('not-a-date')).toBeNull()
    expect(parseDateOnly('2026-13-40')).toBeNull()
    expect(parseDateOnly('')).toBeNull()
  })
})

describe('daysBetween', () => {
  it('returns 0 for the same day', () => {
    expect(daysBetween(new Date(2026, 5, 1), new Date(2026, 5, 1))).toBe(0)
  })
  it('returns a positive count when b is after a', () => {
    expect(daysBetween(new Date(2026, 5, 1), new Date(2026, 5, 11))).toBe(10)
  })
  it('returns a negative count when b is before a', () => {
    expect(daysBetween(new Date(2026, 5, 11), new Date(2026, 5, 1))).toBe(-10)
  })
  it('ignores time-of-day when counting days', () => {
    const a = new Date(2026, 5, 1, 23, 0)
    const b = new Date(2026, 5, 2, 1, 0)
    expect(daysBetween(a, b)).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dateUtils.test.ts`
Expected: FAIL — `Cannot find module './dateUtils'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/dateUtils.ts
export function parseDateOnly(date: string): Date | null {
  const parts = date.split('-').map(Number)
  if (parts.length !== 3) return null
  const [year, month, day] = parts
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null
  return new Date(year, month - 1, day)
}

export function daysBetween(dateA: Date, dateB: Date): number {
  const a = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate())
  const b = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dateUtils.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/dateUtils.ts lib/dateUtils.test.ts
git commit -m "feat: add local-date-safe dateUtils (parseDateOnly, daysBetween)"
```

---

### Task 2: `lib/sharedTags.ts`

**Files:**
- Create: `lib/sharedTags.ts`
- Test: `lib/sharedTags.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/sharedTags.test.ts
import { describe, it, expect } from 'vitest'
import { getFriendTags, getSharedTags } from './sharedTags'
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

describe('getFriendTags', () => {
  it('collects tags from hobbies', () => {
    expect(getFriendTags(baseFriend({ hobbies: ['摄影'] }))).toEqual(['摄影'])
  })
  it('collects tags from likes', () => {
    expect(getFriendTags(baseFriend({ likes: ['咖啡'] }))).toEqual(['咖啡'])
  })
  it('collects tags from memory.tags', () => {
    const memories = [{ id:'m1', date:'2026-01-01', title:'t', content:'', tags:['旅行'], media:[] }]
    expect(getFriendTags(baseFriend({ memories }))).toEqual(['旅行'])
  })
  it('dedupes across hobbies, likes, and memory tags', () => {
    const memories = [{ id:'m1', date:'2026-01-01', title:'t', content:'', tags:['咖啡'], media:[] }]
    const tags = getFriendTags(baseFriend({ hobbies: ['咖啡'], likes: ['咖啡'], memories }))
    expect(tags).toEqual(['咖啡'])
  })
  it('filters out falsy tags', () => {
    expect(getFriendTags(baseFriend({ hobbies: ['', '摄影'] }))).toEqual(['摄影'])
  })
})

describe('getSharedTags', () => {
  it('returns tags present on both friends', () => {
    const a = baseFriend({ id:'a', hobbies: ['摄影', '咖啡'] })
    const b = baseFriend({ id:'b', likes: ['咖啡', '旅行'] })
    expect(getSharedTags(a, b)).toEqual(['咖啡'])
  })
  it('returns [] when there is no overlap', () => {
    const a = baseFriend({ id:'a', hobbies: ['摄影'] })
    const b = baseFriend({ id:'b', hobbies: ['滑雪'] })
    expect(getSharedTags(a, b)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/sharedTags.test.ts`
Expected: FAIL — `Cannot find module './sharedTags'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/sharedTags.ts
import type { Friend } from './types'

export function getFriendTags(friend: Friend): string[] {
  const tags = new Set<string>()

  friend.hobbies.forEach(t => tags.add(t))
  friend.likes.forEach(t => tags.add(t))
  friend.memories.forEach(memory => {
    memory.tags.forEach(t => tags.add(t))
  })

  return [...tags].filter(Boolean)
}

export function getSharedTags(friendA: Friend, friendB: Friend): string[] {
  const a = new Set(getFriendTags(friendA))
  return getFriendTags(friendB).filter(tag => a.has(tag))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/sharedTags.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/sharedTags.ts lib/sharedTags.test.ts
git commit -m "feat: add sharedTags utility for computing common friend tags"
```

---

### Task 3: `lib/lonelyStar.ts`

**Files:**
- Create: `lib/lonelyStar.ts`
- Test: `lib/lonelyStar.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/lonelyStar.test.ts
import { describe, it, expect } from 'vitest'
import { isLonelyStar } from './lonelyStar'
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

describe('isLonelyStar', () => {
  it('is true when there are no memories and no relationships', () => {
    expect(isLonelyStar(baseFriend())).toBe(true)
  })
  it('is false when there are memories', () => {
    const memories = [{ id:'m1', date:'2026-01-01', title:'t', content:'', tags:[], media:[] }]
    expect(isLonelyStar(baseFriend({ memories }))).toBe(false)
  })
  it('is false when there are relationships', () => {
    const relationships = [{ friendId:'f2', label:'同学', closeness: 2 as const }]
    expect(isLonelyStar(baseFriend({ relationships }))).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/lonelyStar.test.ts`
Expected: FAIL — `Cannot find module './lonelyStar'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/lonelyStar.ts
import type { Friend } from './types'

export function isLonelyStar(friend: Friend): boolean {
  return friend.memories.length === 0 && friend.relationships.length === 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/lonelyStar.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/lonelyStar.ts lib/lonelyStar.test.ts
git commit -m "feat: add isLonelyStar utility"
```

---

### Task 4: `lib/insights.ts` — 今日星象 insight generation

Depends on Tasks 1 and 3 (`dateUtils`, `lonelyStar`) plus existing `getBirthdayStatus` and `calculateProfileCompletion`.

**Files:**
- Create: `lib/insights.ts`
- Test: `lib/insights.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/insights.test.ts
import { describe, it, expect } from 'vitest'
import { generateFriendInsights } from './insights'
import type { Friend } from './types'

const NOW = new Date(2026, 6, 1) // 2026-07-01, matches today's date in this project

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

describe('generateFriendInsights', () => {
  it('flags a birthday today at priority 3', () => {
    const friend = baseFriend({ name: '小雨', birthday: '2000-07-01' })
    const insights = generateFriendInsights([friend], NOW)
    const birthday = insights.find(i => i.type === 'birthday')
    expect(birthday).toBeDefined()
    expect(birthday!.priority).toBe(3)
    expect(birthday!.text).toContain('小雨')
  })

  it('flags a birthday 3 days away at priority 3', () => {
    const friend = baseFriend({ name: '小雨', birthday: '2000-07-04' })
    const insights = generateFriendInsights([friend], NOW)
    const birthday = insights.find(i => i.type === 'birthday')
    expect(birthday).toBeDefined()
    expect(birthday!.priority).toBe(3)
    expect(birthday!.text).toContain('3 天后')
  })

  it('flags profile completion below 50% as an incomplete insight', () => {
    const friend = baseFriend({ name: '空档案' })
    const insights = generateFriendInsights([friend], NOW)
    expect(insights.some(i => i.type === 'incomplete')).toBe(true)
  })

  it('flags an important friend with no memory in the last 30 days', () => {
    const friend = baseFriend({
      name: 'Nick', important: true,
      memories: [{ id:'m1', date:'2026-01-01', title:'t', content:'', tags:[], media:[] }],
    })
    const insights = generateFriendInsights([friend], NOW)
    const important = insights.find(i => i.type === 'important')
    expect(important).toBeDefined()
    expect(important!.priority).toBe(2)
  })

  it('flags a lonely star', () => {
    const friend = baseFriend({ name: 'Tom' })
    const insights = generateFriendInsights([friend], NOW)
    expect(insights.some(i => i.type === 'lonely')).toBe(true)
  })

  it('returns at most 5 insights', () => {
    const friends = Array.from({ length: 10 }, (_, i) => baseFriend({ id: `f${i}`, name: `F${i}` }))
    const insights = generateFriendInsights(friends, NOW)
    expect(insights.length).toBeLessThanOrEqual(5)
  })

  it('sorts higher-priority insights first', () => {
    const friends = [
      baseFriend({ id: 'a', name: 'A' }), // lonely -> priority 1, incomplete -> priority 1
      baseFriend({ id: 'b', name: 'B', birthday: '2000-07-01' }), // birthday today -> priority 3
    ]
    const insights = generateFriendInsights(friends, NOW)
    expect(insights[0].priority).toBe(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/insights.test.ts`
Expected: FAIL — `Cannot find module './insights'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/insights.ts
import type { Friend } from './types'
import { getBirthdayStatus } from './birthdayStatus'
import { calculateProfileCompletion } from './profileCompletion'
import { isLonelyStar } from './lonelyStar'
import { parseDateOnly, daysBetween } from './dateUtils'

export type FriendInsightType =
  | 'birthday'
  | 'inactive'
  | 'incomplete'
  | 'recent-memory'
  | 'important'
  | 'lonely'

export interface FriendInsight {
  id: string
  type: FriendInsightType
  friendId: string
  friendName: string
  text: string
  priority: 1 | 2 | 3
}

function latestMemoryOf(friend: Friend) {
  return [...friend.memories].sort((a, b) => b.date.localeCompare(a.date))[0]
}

function daysSinceLatestMemory(friend: Friend, now: Date): number | null {
  const latest = latestMemoryOf(friend)
  if (!latest) return null
  const date = parseDateOnly(latest.date)
  if (!date) return null
  return daysBetween(date, now)
}

export function generateFriendInsights(friends: Friend[], now: Date = new Date()): FriendInsight[] {
  const insights: FriendInsight[] = []

  for (const friend of friends) {
    const birthday = getBirthdayStatus(friend.birthday, now)
    if (birthday.isToday) {
      insights.push({
        id: `${friend.id}-birthday`, type: 'birthday', friendId: friend.id, friendName: friend.name,
        text: `今天是${friend.name}生日 🎂`, priority: 3,
      })
    } else if (birthday.isSoon && birthday.daysUntil !== null) {
      insights.push({
        id: `${friend.id}-birthday`, type: 'birthday', friendId: friend.id, friendName: friend.name,
        text: `${birthday.daysUntil} 天后是${friend.name}生日`, priority: 3,
      })
    }

    const memoryAge = daysSinceLatestMemory(friend, now)
    if (memoryAge !== null) {
      if (memoryAge > 60) {
        insights.push({
          id: `${friend.id}-inactive`, type: 'inactive', friendId: friend.id, friendName: friend.name,
          text: `你已经 ${memoryAge} 天没有更新${friend.name}的记录`, priority: 2,
        })
      }
      if (memoryAge <= 7) {
        insights.push({
          id: `${friend.id}-recent-memory`, type: 'recent-memory', friendId: friend.id, friendName: friend.name,
          text: `最近新增了关于${friend.name}的回忆`, priority: 2,
        })
      }
    } else {
      const createdDays = daysBetween(new Date(friend.createdAt), now)
      if (createdDays > 14) {
        insights.push({
          id: `${friend.id}-inactive`, type: 'inactive', friendId: friend.id, friendName: friend.name,
          text: `${friend.name}还没有任何回忆记录`, priority: 1,
        })
      }
    }

    const completion = calculateProfileCompletion(friend)
    if (completion.percent < 50) {
      insights.push({
        id: `${friend.id}-incomplete`, type: 'incomplete', friendId: friend.id, friendName: friend.name,
        text: `${friend.name}的档案还很空，可以补充：${completion.missing.slice(0, 2).join('、')}`, priority: 1,
      })
    }

    if (friend.important && (memoryAge === null || memoryAge > 30)) {
      insights.push({
        id: `${friend.id}-important`, type: 'important', friendId: friend.id, friendName: friend.name,
        text: `重要朋友${friend.name}最近还没有新记录`, priority: 2,
      })
    }

    if (isLonelyStar(friend)) {
      insights.push({
        id: `${friend.id}-lonely`, type: 'lonely', friendId: friend.id, friendName: friend.name,
        text: `${friend.name}还是一颗孤星，可以添加回忆或连接朋友`, priority: 1,
      })
    }
  }

  return insights
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority
      if (a.type === 'birthday' && b.type !== 'birthday') return -1
      if (b.type === 'birthday' && a.type !== 'birthday') return 1
      return 0
    })
    .slice(0, 5)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/insights.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/insights.ts lib/insights.test.ts
git commit -m "feat: add generateFriendInsights for the 今日星象 panel"
```

---

### Task 5: `MemoryTimeline` — edit, delete, empty state

**Files:**
- Modify: `components/MemoryTimeline.tsx` (full file, 71 lines currently)

No test file — this component has no existing test coverage and the repo convention only unit-tests `lib/*`, not `components/*.tsx` (confirmed: zero `.test.tsx` files exist in the repo). Verify manually per Task 11.

- [ ] **Step 1: Replace the full file contents**

```tsx
// components/MemoryTimeline.tsx
'use client'
import { useState } from 'react'
import type { Memory, Media } from '@/lib/types'
import MediaUpload from './MediaUpload'

interface Props { friendId: string; memories: Memory[]; onChange: (m: Memory[]) => void }

type Draft = Omit<Partial<Memory>, 'tags'> & { tags?: string }

export default function MemoryTimeline({ friendId, memories, onChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>({})

  function saveMemory() {
    if (!draft.title || !draft.date) return
    const mem: Memory = {
      id: crypto.randomUUID(),
      date:    draft.date!,
      title:   draft.title!,
      content: draft.content ?? '',
      tags:    (draft.tags ?? '').split(',').map(t=>t.trim()).filter(Boolean),
      media:   [],
    }
    onChange([...memories, mem].sort((a,b)=>b.date.localeCompare(a.date)))
    setDraft({}); setAdding(false)
  }

  function addMedia(memId: string, media: Media) {
    onChange(memories.map(m => m.id===memId ? {...m, media:[...m.media, media]} : m))
  }

  function startEdit(m: Memory) {
    setEditingId(m.id)
    setEditDraft({ date: m.date, title: m.title, content: m.content, tags: m.tags.join(', ') })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({})
  }

  function saveEdit() {
    if (!editingId || !editDraft.title || !editDraft.date) return
    const updated = memories.map(m => m.id === editingId ? {
      ...m,
      date:    editDraft.date!,
      title:   editDraft.title!,
      content: editDraft.content ?? '',
      tags:    (editDraft.tags ?? '').split(',').map(t=>t.trim()).filter(Boolean),
    } : m)
    onChange(updated.sort((a,b)=>b.date.localeCompare(a.date)))
    cancelEdit()
  }

  function deleteMemory(id: string) {
    onChange(memories.filter(m => m.id !== id))
  }

  const inp: React.CSSProperties = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(226,185,111,0.15)',
    borderRadius:6, padding:'8px 12px', color:'#e2e8f0', fontSize:12, width:'100%', fontFamily:'Noto Serif SC, serif' }

  const actionBtn: React.CSSProperties = { background:'none', border:'none', cursor:'pointer',
    fontSize:11, letterSpacing:1, padding:'2px 6px' }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <span style={{ color:'rgba(226,185,111,0.7)', fontSize:11, letterSpacing:2 }}>行动记录</span>
        <button type="button" onClick={()=>setAdding(true)} style={{ ...inp, width:'auto', padding:'4px 12px', cursor:'pointer' }}>+ 记录一颗星尘</button>
      </div>

      {adding && (
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(226,185,111,0.15)',
          borderRadius:10, padding:16, marginBottom:16, display:'flex', flexDirection:'column', gap:10 }}>
          <input placeholder="日期" type="date" value={draft.date??''} onChange={e=>setDraft({...draft,date:e.target.value})} style={inp}/>
          <input placeholder="标题" value={draft.title??''} onChange={e=>setDraft({...draft,title:e.target.value})} style={inp}/>
          <textarea placeholder="描述" rows={3} value={draft.content??''} onChange={e=>setDraft({...draft,content:e.target.value})} style={{...inp,resize:'vertical'}}/>
          <input placeholder="标签（逗号分隔）" value={draft.tags??''} onChange={e=>setDraft({...draft,tags:e.target.value})} style={inp}/>
          <button type="button" onClick={saveMemory} style={{...inp,width:'auto',cursor:'pointer',color:'#e2b96f'}}>保存</button>
        </div>
      )}

      {memories.length === 0 && !adding && (
        <div style={{ color:'rgba(155,142,196,0.6)', fontSize:12, lineHeight:1.8, padding:'8px 0' }}>
          这里还没有回忆。<br/>记录一次见面、一句话、一个小细节，都会让这颗星星更亮。
        </div>
      )}

      {memories.map(m => (
        <div key={m.id} style={{ borderLeft:'2px solid rgba(226,185,111,0.2)', paddingLeft:16, marginBottom:20 }}>
          {editingId === m.id ? (
            <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(226,185,111,0.15)',
              borderRadius:10, padding:16, display:'flex', flexDirection:'column', gap:10 }}>
              <input type="date" value={editDraft.date??''} onChange={e=>setEditDraft({...editDraft,date:e.target.value})} style={inp}/>
              <input placeholder="标题" value={editDraft.title??''} onChange={e=>setEditDraft({...editDraft,title:e.target.value})} style={inp}/>
              <textarea placeholder="描述" rows={3} value={editDraft.content??''} onChange={e=>setEditDraft({...editDraft,content:e.target.value})} style={{...inp,resize:'vertical'}}/>
              <input placeholder="标签（逗号分隔）" value={editDraft.tags??''} onChange={e=>setEditDraft({...editDraft,tags:e.target.value})} style={inp}/>
              <div style={{ display:'flex', gap:8 }}>
                <button type="button" onClick={saveEdit} style={{...inp,width:'auto',cursor:'pointer',color:'#e2b96f'}}>保存</button>
                <button type="button" onClick={cancelEdit} style={{...inp,width:'auto',cursor:'pointer',color:'rgba(226,185,111,0.5)'}}>取消</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ color:'rgba(226,185,111,0.5)', fontSize:10 }}>{m.date}</div>
                <div style={{ display:'flex', gap:4 }}>
                  <button type="button" onClick={()=>startEdit(m)} style={{...actionBtn, color:'rgba(226,185,111,0.7)'}}>编辑</button>
                  <button type="button" onClick={()=>deleteMemory(m.id)} style={{...actionBtn, color:'rgba(252,165,165,0.7)'}}>删除</button>
                </div>
              </div>
              <div style={{ color:'#e2e8f0', fontSize:13, margin:'4px 0' }}>{m.title}</div>
              {m.content && <div style={{ color:'rgba(155,142,196,0.7)', fontSize:11, lineHeight:1.6 }}>{m.content}</div>}
              {m.tags.length > 0 && (
                <div style={{ color:'rgba(155,142,196,0.5)', fontSize:10, marginTop:4 }}>{m.tags.join(' · ')}</div>
              )}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
                {m.media.map(md => (
                  <div key={md.id} style={{ width:60, height:60, borderRadius:6, overflow:'hidden', background:'rgba(255,255,255,0.05)' }}>
                    {md.type==='photo'
                      ? <img src={md.thumbnailUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt={md.caption}/>
                      : <video src={md.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted/>}
                  </div>
                ))}
                <MediaUpload friendId={friendId} folder={`memories/${m.id}`} onUploaded={md=>addMedia(m.id,md)}/>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/MemoryTimeline.tsx
git commit -m "feat: add memory edit, delete, and empty state to MemoryTimeline"
```

---

### Task 6: `StarMap.tsx` — pinned-priority relationship-line highlighting

The current `onMouseMove`/`onCanvasMouseUp`/`onKeyDown` handlers are created once inside the `useEffect(() => {...}, [])` on mount, so any read of the `pinnedFriend` *state* inside them is stale (always the initial `null`) — only the `set*` calls work correctly, because setters are stable. That's why hovering a different star currently always steals the relationship-line highlight away from a pinned friend. Fix: track the pinned friend id in a `ref` (refs are always current inside closures) and call `highlightLines` explicitly at every point the pinned selection changes.

**Files:**
- Modify: `components/StarMap/StarMap.tsx`

- [ ] **Step 1: Add a ref to track the pinned friend id**

In `components/StarMap/StarMap.tsx`, after line 23 (`const linesRef = useRef<LineObject[]>([])`), add:

```tsx
  const linesRef  = useRef<LineObject[]>([])
  const pinnedFriendIdRef = useRef<string | null>(null)
```

- [ ] **Step 2: Update `onMouseMove` to respect the pinned friend**

Replace the current `onMouseMove` body (lines 52-75):

```tsx
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
        highlightLines(linesRef.current, pinnedFriendIdRef.current ?? star.friendId)
        gsap.to(star.root.scale, { x:1.22, y:1.22, z:1.22, duration:.3, ease:'back.out(2)' })
      } else {
        setHoveredFriend(null)
        highlightLines(linesRef.current, pinnedFriendIdRef.current)
        starsRef.current.forEach(s => gsap.to(s.root.scale, { x:1, y:1, z:1, duration:.3 }))
      }
    }
```

(Only the two `highlightLines` calls changed: they now use `pinnedFriendIdRef.current ?? star.friendId` and `pinnedFriendIdRef.current` respectively, instead of always keying off the hovered star / `null`.)

- [ ] **Step 3: Update `onCanvasMouseUp` to sync the ref and re-apply line highlighting**

Replace the current `onCanvasMouseUp` body (lines 87-105):

```tsx
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
        pinnedFriendIdRef.current = friend?.id ?? null
        setPinnedFriend(friend)
        setPinnedPos({ x: e.clientX + 22, y: e.clientY - 12 })
        highlightLines(linesRef.current, pinnedFriendIdRef.current)
      } else {
        pinnedFriendIdRef.current = null
        setPinnedFriend(null)
        setPinnedPos(null)
        highlightLines(linesRef.current, null)
      }
    }
```

- [ ] **Step 4: Update `onKeyDown` (Escape) to clear the ref and re-apply line highlighting**

Replace the current `onKeyDown` body (lines 107-109):

```tsx
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        pinnedFriendIdRef.current = null
        setPinnedFriend(null)
        setPinnedPos(null)
        highlightLines(linesRef.current, null)
      }
    }
```

- [ ] **Step 5: Update the FriendCard's close button to clear the ref too**

Replace the pinned `FriendCard`'s `onClose` (around line 153):

```tsx
      {pinnedFriend && pinnedPos && (
        <FriendCard
          friend={pinnedFriend}
          pinned
          onClose={() => {
            pinnedFriendIdRef.current = null
            setPinnedFriend(null)
            setPinnedPos(null)
            highlightLines(linesRef.current, null)
          }}
          style={{ left: pinnedPos.x, top: pinnedPos.y }}
        />
      )}
```

- [ ] **Step 6: Verify manually**

Run `npm run dev`, open the app, add at least two friends with a relationship between them (closeness 2 or 3) and a third unrelated friend. Click (pin) one of the related friends, then hover the unrelated third friend — the relationship line to the pinned friend should stay highlighted, not fade because you're hovering elsewhere. Press Escape or click empty space — lines should return to default opacity.

- [ ] **Step 7: Commit**

```bash
git add components/StarMap/StarMap.tsx
git commit -m "fix: keep relationship lines focused on pinned friend when hovering elsewhere"
```

---

### Task 7: `FriendCard.tsx` — latest memory, relationship count, shared tags, lonely-star message

Depends on Task 2 (`sharedTags`) and Task 3 (`lonelyStar`).

**Files:**
- Modify: `components/FriendCard.tsx`

- [ ] **Step 1: Add imports and computed values**

Replace lines 1-26 of `components/FriendCard.tsx`:

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
import { getFriends } from '@/lib/store'
import { getSharedTags } from '@/lib/sharedTags'
import { isLonelyStar } from '@/lib/lonelyStar'

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
  const lonely = isLonelyStar(friend)
  const latestMemory = [...friend.memories].sort((a, b) => b.date.localeCompare(a.date))[0]
  const firstRelationship = friend.relationships[0]
  const relatedFriend = firstRelationship
    ? getFriends().find(f => f.id === firstRelationship.friendId)
    : undefined
  const sharedTags = relatedFriend ? getSharedTags(friend, relatedFriend) : []

  const meta = [friend.mbti, friend.zodiac, growth.label].filter(Boolean).join(' · ')
  const energyPercent = Math.round(Math.min(energy.score / 15, 1) * 100)
```

- [ ] **Step 2: Insert the "最近回忆" block after the energy block**

After the existing block (originally lines 55-58):

```tsx
      <div style={{ marginTop:10, fontSize:11, color:'#e2e8f0', lineHeight:1.8 }}>
        <div>关系温度：{energy.level}（{energyPercent}%）</div>
        <div style={{ color:'rgba(155,142,196,0.7)' }}>{energy.lastActivityText}</div>
      </div>
```

add:

```tsx
      {latestMemory && (
        <div style={{ marginTop:8, fontSize:11, color:'#e2e8f0', lineHeight:1.6 }}>
          最近回忆：{latestMemory.title} · {latestMemory.date}
        </div>
      )}
```

- [ ] **Step 3: Insert relationship count, shared tags, and lonely-star message after the profile-completion block**

After the existing block (originally lines 64-69):

```tsx
      {completion.percent < 100 && (
        <div style={{ marginTop:8, fontSize:10, color:'rgba(155,142,196,0.6)', lineHeight:1.6 }}>
          档案完整度：{completion.percent}%<br/>
          建议补充：{completion.missing.join('、')}
        </div>
      )}
```

add:

```tsx
      {friend.relationships.length > 0 && (
        <div style={{ marginTop:8, fontSize:10, color:'rgba(155,142,196,0.6)' }}>
          已连接 {friend.relationships.length} 位朋友
        </div>
      )}

      {sharedTags.length > 0 && (
        <div style={{ marginTop:4, fontSize:10, color:'rgba(155,142,196,0.6)' }}>
          共同标签：{sharedTags.join('、')}
        </div>
      )}

      {lonely && (
        <div style={{ marginTop:8, fontSize:10, color:'rgba(226,185,111,0.6)', lineHeight:1.6 }}>
          这还是一颗孤星。<br/>建议：添加一条回忆，或者连接一个共同朋友。
        </div>
      )}
```

- [ ] **Step 4: Verify manually**

Run `npm run dev`. Hover/pin a friend with a memory — "最近回忆" line appears. Hover/pin a friend with a relationship whose linked friend shares a hobby/like/memory tag — "共同标签" line appears. Hover/pin a friend with zero memories and zero relationships — the "这还是一颗孤星" message appears.

- [ ] **Step 5: Commit**

```bash
git add components/FriendCard.tsx
git commit -m "feat: show latest memory, relationship count, shared tags, and lonely-star message on FriendCard"
```

---

### Task 8: `components/InsightPanel.tsx`

Depends on Task 4 (`lib/insights.ts`).

**Files:**
- Create: `components/InsightPanel.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/InsightPanel.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/InsightPanel.tsx
git commit -m "feat: add InsightPanel for 今日星象"
```

---

### Task 9: `StarMap.tsx` — accept `selectedFriendId` to pin from outside

Depends on Task 6 (uses `pinnedFriendIdRef` introduced there).

**Files:**
- Modify: `components/StarMap/StarMap.tsx`

- [ ] **Step 1: Add a `Props` interface and accept `selectedFriendId`**

Replace line 15 (`export default function StarMap() {`) with:

```tsx
interface Props {
  selectedFriendId?: string | null
}

export default function StarMap({ selectedFriendId = null }: Props) {
```

- [ ] **Step 2: Track the loaded friends list in a ref**

In the `pullAll().then(...)` callback (lines 33-42), store the loaded friends in a ref so the new effect in Step 3 can look them up without re-fetching. Add a new ref declaration next to the other refs — `pinnedFriendIdRef` already exists from Task 6 Step 1, so only add `friendsRef`:

```tsx
  const friendsRef = useRef<Friend[]>([])
```

Then update the `pullAll().then(...)` callback:

```tsx
    pullAll().then(() => {
      const friends = getFriends()
      friendsRef.current = friends
      const stars   = friends.map(f => buildStar(f))
      starsRef.current = stars
      stars.forEach(s => pivot.add(s.root))

      const lines = buildConstellationLines(friends)
      linesRef.current = lines
      lines.forEach(l => pivot.add(l.line))
    }).catch(console.error)
```

- [ ] **Step 3: Add an effect that pins the friend named by `selectedFriendId`**

Add this effect after the main mount `useEffect` (after its closing `}, [])`, still inside the component body, before the `return`:

```tsx
  useEffect(() => {
    if (!selectedFriendId) return
    const friend = friendsRef.current.find(f => f.id === selectedFriendId)
    if (!friend) return
    pinnedFriendIdRef.current = friend.id
    setPinnedFriend(friend)
    setPinnedPos({ x: window.innerWidth / 2 - 130, y: window.innerHeight / 2 - 80 })
    highlightLines(linesRef.current, friend.id)
  }, [selectedFriendId])
```

- [ ] **Step 4: Verify manually**

This will be exercised end-to-end once Task 10 wires `app/page.tsx`. For now, run `npm run test` and `npm run build` to confirm no type errors from the new prop/effect.

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 5: Commit**

```bash
git add components/StarMap/StarMap.tsx
git commit -m "feat: let StarMap pin a friend via selectedFriendId prop"
```

---

### Task 10: `app/page.tsx` — wire up InsightPanel and friend selection

Depends on Task 8 (`InsightPanel`) and Task 9 (`StarMap`'s `selectedFriendId` prop).

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the full file contents**

```tsx
// app/page.tsx
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

export default function HomePage() {
  const [entered, setEntered] = useState(false)
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
          padding:'18px 32px',
          background:'linear-gradient(to bottom, rgba(2,4,8,0.8), transparent)',
          pointerEvents:'none',
        }}>
          <span style={{ color:'#e2b96f', fontFamily:'Ma Shan Zheng, cursive',
            fontSize:16, letterSpacing:4 }}>✦ 友记</span>
          <Link href="/friend/new" style={{
            color:'#e2b96f', fontSize:11, letterSpacing:2,
            border:'1px solid rgba(226,185,111,0.35)', borderRadius:20,
            padding:'6px 16px', textDecoration:'none', pointerEvents:'auto',
          }}>✦ 新纪录</Link>
        </nav>
      )}

      {!entered && <OrreryEntry onEnter={() => setEntered(true)} />}
      {entered && (
        <>
          <StarMap selectedFriendId={selectedFriendId} />
          <InsightPanel friends={friends} onSelectFriend={setSelectedFriendId} />
        </>
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify manually**

Run `npm run dev`. Enter the star map (click through `OrreryEntry`). The "今日星象" panel should appear bottom-right. Add/edit a friend so at least one insight is generated (e.g. leave a friend with an empty profile — triggers "incomplete", or set `important: true` with no recent memory). Click an insight — the corresponding friend's `FriendCard` should appear pinned in the center of the screen.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire InsightPanel into the home page with click-to-pin"
```

---

### Task 11: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the 7 new `lib/dateUtils.test.ts`, 7 new `lib/sharedTags.test.ts`, 3 new `lib/lonelyStar.test.ts`, and 7 new `lib/insights.test.ts` tests, plus all pre-existing tests still green.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Manual test checklist**

Run `npm run dev` and verify, in order:

1. Edit a friend, add 1 memory, refresh the page — memory still present (existing behavior, confirm not broken).
2. Edit that memory's title/content via the new "编辑" button, save — content updates and re-sorts by date.
3. Delete a memory via "删除" — it disappears immediately.
4. Add memories until a friend has 3+ — friend's growth-stage label (in `meta` on the card) changes to "恒星" (already-existing `getGrowthStage` logic, now exercisable end-to-end via edit/delete).
5. Add a relationship between two friends (via 完整档案 → 共同好友 on the edit page) — a line appears between their stars on the star map.
6. Hover a star with a relationship — only its own line(s) stay bright; unrelated lines dim.
7. Pin (click) a friend with a relationship, then hover a different, unrelated star — the pinned friend's line stays highlighted (this is the Task 6 fix; before this plan, hovering elsewhere would have stolen the highlight).
8. Click empty space or press Escape while pinned — lines return to default opacity.
9. FriendCard for a friend with memories shows "最近回忆：...".
10. FriendCard for a friend with zero memories and zero relationships shows "这还是一颗孤星。建议：添加一条回忆，或者连接一个共同朋友。"
11. Home page shows "今日星象" panel bottom-right.
12. A friend with `birthday` within 7 days appears in 今日星象 with correct day count.
13. A friend with profile completion below 50% appears in 今日星象.
14. Clicking an insight pins the corresponding friend's `FriendCard`.
15. No new console errors during any of the above.

- [ ] **Step 4: Report results**

Summarize: which of the 15 manual checks passed, `npm run test` output (pass/fail counts), and any deviations found. Do not mark the plan complete until `npm run test` passes and manual checks 1-14 are confirmed working (no unhandled console errors is check 15, best-effort).

---

## What's deferred to v0.4+ (per design doc §12 and confirmed not needed now)

- Image/video upload changes beyond what `MediaUpload`/`media: []` already support.
- Automatic bidirectional relationship writes (A adds B ⇒ B also gets A).
- Relationship-line hover tooltips showing shared tags directly on the star map.
- Camera-focus/fly-to animation when clicking an InsightPanel entry (current implementation just pins the card at screen center — matches the design doc's stated minimum acceptable behavior).
- Any Supabase schema changes — this plan only touches localStorage-backed `lib/store.ts` reads/writes already wired through existing `saveFriend`/`pushFriend` calls in `app/friend/[friendId]/page.tsx` and `components/FriendForm.tsx` (untouched by this plan).
