# 全局指挥台(好友搜索)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 随处可唤起的好友搜索浮层——桌面 `Ctrl+K`/`Cmd+K` 或点导航按钮,3 秒内找到任何朋友并飞向那颗星。

**Architecture:** 纯客户端、零新依赖。`lib/friendSearch.ts` 提供匹配排序纯函数;`components/SearchOverlay.tsx` 是受控浮层组件(页面持有 `open` 状态);首页接入现有 `setSelectedFriendId`/`setFocusedFriendId` 飞星动线,好友详情页接入 `router.push` 跳转。

**Tech Stack:** Next.js 16 App Router(客户端组件)、React 19、Vitest + Testing Library、`lib/ui/tokens.ts` 设计 token。

**注意:** 本仓库 AGENTS.md 要求写代码前查 `node_modules/next/dist/docs/` 中的相关指南。本计划只用代码库中已在用的 API(`'use client'`、`next/navigation` 的 `useRouter`、`next/link`),与 `app/friend/[friendId]/page.tsx` 现状一致;若执行中遇到行为差异,先查 `node_modules/next/dist/docs/01-app/` 再改。

Spec: `docs/superpowers/specs/2026-07-27-global-search-design.md`

---

### Task 1: `formatRelativeDate` 相对日期格式化

**Files:**
- Modify: `lib/dateUtils.ts`
- Test: `lib/dateUtils.test.ts`

- [ ] **Step 1: 写失败测试**

在 `lib/dateUtils.test.ts` 现有 describe 之后追加:

```ts
describe('formatRelativeDate', () => {
  const now = new Date(2026, 6, 27) // 2026-07-27
  it('今天', () => expect(formatRelativeDate('2026-07-27', now)).toBe('今天'))
  it('昨天', () => expect(formatRelativeDate('2026-07-26', now)).toBe('昨天'))
  it('30 天内显示 N 天前', () => expect(formatRelativeDate('2026-07-24', now)).toBe('3 天前'))
  it('30 天及以上显示原日期', () => expect(formatRelativeDate('2026-06-01', now)).toBe('2026-06-01'))
  it('未来日期按今天处理', () => expect(formatRelativeDate('2026-08-01', now)).toBe('今天'))
  it('非法日期原样返回', () => expect(formatRelativeDate('not-a-date', now)).toBe('not-a-date'))
})
```

同时把文件顶部 import 改为包含 `formatRelativeDate`。

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/dateUtils.test.ts`
Expected: FAIL — `formatRelativeDate` is not exported

- [ ] **Step 3: 最小实现**

在 `lib/dateUtils.ts` 末尾追加:

```ts
export function formatRelativeDate(date: string, now: Date = new Date()): string {
  const parsed = parseDateOnly(date)
  if (!parsed) return date
  const days = daysBetween(parsed, now)
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 30) return `${days} 天前`
  return date
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/dateUtils.test.ts`
Expected: PASS(全部,含原有用例)

- [ ] **Step 5: Commit**

```bash
git add lib/dateUtils.ts lib/dateUtils.test.ts
git commit -m "feat: add formatRelativeDate for recency display"
```

---

### Task 2: `lib/friendSearch.ts` 匹配与排序

**Files:**
- Create: `lib/friendSearch.ts`
- Test: `lib/friendSearch.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `lib/friendSearch.test.ts`(工厂函数沿用 `lib/profileCompletion.test.ts` 的 `baseFriend` 模式):

```ts
import { describe, it, expect } from 'vitest'
import { searchFriends, lastInteractionDate } from './friendSearch'
import type { Friend, Memory } from './types'

function baseFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'f1', name: 'Test', important: false,
    likes: [], dislikes: [], hobbies: [],
    portraits: [], memories: [], relationships: [],
    starConfig: { kind:'nebula', coreColor:'#94a3b8', glowColor:'#cbd5e1', size:1, twinkleSpeed:2, position:[0,0,0] },
    createdAt: '2026-01-01', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
function mem(date: string, tags: string[] = []): Memory {
  return { id: `m-${date}`, date, title: 't', content: '', tags, media: [] }
}

describe('lastInteractionDate', () => {
  it('取最新回忆日期', () => {
    const f = baseFriend({ memories: [mem('2026-01-05'), mem('2026-03-01'), mem('2026-02-10')] })
    expect(lastInteractionDate(f)).toBe('2026-03-01')
  })
  it('无回忆时用 updatedAt 的日期部分', () => {
    expect(lastInteractionDate(baseFriend({ updatedAt: '2026-05-20T08:00:00.000Z' }))).toBe('2026-05-20')
  })
})

describe('searchFriends 空查询', () => {
  it('important 置顶,组内按最近互动倒序', () => {
    const a = baseFriend({ id:'a', name:'阿明', memories: [mem('2026-07-01')] })
    const b = baseFriend({ id:'b', name:'小红', important: true, memories: [mem('2026-01-01')] })
    const c = baseFriend({ id:'c', name:'老王', memories: [mem('2026-07-20')] })
    const ids = searchFriends([a, b, c], '').map(r => r.friend.id)
    expect(ids).toEqual(['b', 'c', 'a'])
  })
  it('空白查询等同空查询', () => {
    expect(searchFriends([baseFriend()], '   ')).toHaveLength(1)
  })
})

describe('searchFriends 匹配', () => {
  it('名字前缀优先于名字包含', () => {
    const prefix = baseFriend({ id:'p', name:'明明' })
    const contains = baseFriend({ id:'c', name:'小明', memories: [mem('2026-07-20')] })
    const ids = searchFriends([contains, prefix], '明').map(r => r.friend.id)
    expect(ids).toEqual(['p', 'c'])
  })
  it('昵称匹配并带命中信息', () => {
    const f = baseFriend({ name:'王芳', nickname:'芳芳' })
    const [r] = searchFriends([f], '芳芳')
    expect(r.matchField).toBe('nickname')
    expect(r.matchText).toBe('芳芳')
  })
  it('喜好/雷区/爱好匹配并带命中信息', () => {
    const f = baseFriend({ name:'王芳', likes:['火锅'] })
    const [r] = searchFriends([f], '火锅')
    expect(r.matchField).toBe('like')
    expect(r.matchText).toBe('火锅')
  })
  it('回忆标签匹配', () => {
    const f = baseFriend({ name:'王芳', memories:[mem('2026-01-01', ['爬山'])] })
    const [r] = searchFriends([f], '爬山')
    expect(r.matchField).toBe('tag')
    expect(r.matchText).toBe('爬山')
  })
  it('英文匹配大小写不敏感', () => {
    const f = baseFriend({ name:'Alice' })
    expect(searchFriends([f], 'ali')).toHaveLength(1)
  })
  it('同级命中按最近互动倒序', () => {
    const old = baseFriend({ id:'old', name:'小明', memories:[mem('2026-01-01')] })
    const fresh = baseFriend({ id:'fresh', name:'小明月', memories:[mem('2026-07-20')] })
    const ids = searchFriends([old, fresh], '小明').map(r => r.friend.id)
    expect(ids).toEqual(['fresh', 'old'])
  })
  it('无匹配返回空数组', () => {
    expect(searchFriends([baseFriend({ name:'王芳' })], '不存在')).toEqual([])
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/friendSearch.test.ts`
Expected: FAIL — 找不到模块 `./friendSearch`

- [ ] **Step 3: 实现**

创建 `lib/friendSearch.ts`:

```ts
import type { Friend } from './types'
import { parseDateOnly } from './dateUtils'

export type MatchField = 'name' | 'nickname' | 'like' | 'dislike' | 'hobby' | 'tag'

export interface SearchResult {
  friend: Friend
  matchField?: MatchField
  matchText?: string
}

// 最近互动日期(YYYY-MM-DD):最新 memory.date,无回忆则取 updatedAt 的日期部分
export function lastInteractionDate(friend: Friend): string {
  const dates = friend.memories.map(m => m.date).filter(d => parseDateOnly(d) !== null)
  if (dates.length === 0) return friend.updatedAt.slice(0, 10)
  return dates.reduce((a, b) => (b > a ? b : a))
}

export function searchFriends(friends: Friend[], query: string): SearchResult[] {
  const q = query.trim().toLowerCase()
  const byRecency = (a: Friend, b: Friend) =>
    lastInteractionDate(b).localeCompare(lastInteractionDate(a))

  if (!q) {
    return [...friends]
      .sort((a, b) => Number(b.important) - Number(a.important) || byRecency(a, b))
      .map(friend => ({ friend }))
  }

  return friends
    .map(friend => matchFriend(friend, q))
    .filter((m): m is { rank: number; result: SearchResult } => m !== null)
    .sort((a, b) => a.rank - b.rank || byRecency(a.result.friend, b.result.friend))
    .map(m => m.result)
}

// 优先级:名字前缀(0) > 名字包含(1) > 昵称(2) > 喜好/雷区/爱好(3) > 回忆标签(4)
function matchFriend(friend: Friend, q: string): { rank: number; result: SearchResult } | null {
  const name = friend.name.toLowerCase()
  if (name.startsWith(q)) return { rank: 0, result: { friend, matchField: 'name', matchText: friend.name } }
  if (name.includes(q)) return { rank: 1, result: { friend, matchField: 'name', matchText: friend.name } }

  const nickname = friend.nickname
  if (nickname && nickname.toLowerCase().includes(q))
    return { rank: 2, result: { friend, matchField: 'nickname', matchText: nickname } }

  const listFields: [MatchField, string[]][] = [
    ['like', friend.likes], ['dislike', friend.dislikes], ['hobby', friend.hobbies],
  ]
  for (const [field, values] of listFields) {
    const hit = values.find(v => v.toLowerCase().includes(q))
    if (hit) return { rank: 3, result: { friend, matchField: field, matchText: hit } }
  }

  const tags = [...new Set(friend.memories.flatMap(m => m.tags))]
  const tagHit = tags.find(t => t.toLowerCase().includes(q))
  if (tagHit) return { rank: 4, result: { friend, matchField: 'tag', matchText: tagHit } }

  return null
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/friendSearch.test.ts`
Expected: PASS(11 个用例)

- [ ] **Step 5: Commit**

```bash
git add lib/friendSearch.ts lib/friendSearch.test.ts
git commit -m "feat: add friend search matching and ranking"
```

---

### Task 3: `SearchOverlay` 浮层组件

**Files:**
- Create: `components/SearchOverlay.tsx`
- Test: `components/SearchOverlay.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `components/SearchOverlay.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import SearchOverlay from './SearchOverlay'
import { useIsMobile } from '@/lib/useIsMobile'
import type { Friend } from '@/lib/types'

vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: vi.fn() }))
beforeEach(() => vi.mocked(useIsMobile).mockReturnValue(false))

function baseFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'f1', name: 'Test', important: false,
    likes: [], dislikes: [], hobbies: [],
    portraits: [], memories: [], relationships: [],
    starConfig: { kind:'nebula', coreColor:'#94a3b8', glowColor:'#cbd5e1', size:1, twinkleSpeed:2, position:[0,0,0] },
    createdAt: '2026-01-01', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const friends = [
  baseFriend({ id:'a', name:'阿明', likes:['火锅'] }),
  baseFriend({ id:'b', name:'小红', nickname:'红红' }),
]

function setup(props: Partial<ComponentProps<typeof SearchOverlay>> = {}) {
  const onOpenChange = vi.fn()
  const onPick = vi.fn()
  render(<SearchOverlay friends={friends} open onOpenChange={onOpenChange} onPick={onPick} {...props} />)
  return { onOpenChange, onPick }
}

describe('SearchOverlay', () => {
  it('open=false 时不渲染', () => {
    setup({ open: false })
    expect(screen.queryByPlaceholderText(/寻找/)).not.toBeInTheDocument()
  })

  it('空查询列出全部好友', () => {
    setup()
    expect(screen.getByText('阿明')).toBeInTheDocument()
    expect(screen.getByText('小红')).toBeInTheDocument()
  })

  it('输入过滤并显示命中原因', () => {
    setup()
    fireEvent.change(screen.getByPlaceholderText(/寻找/), { target: { value: '火锅' } })
    expect(screen.getByText('阿明')).toBeInTheDocument()
    expect(screen.queryByText('小红')).not.toBeInTheDocument()
    expect(screen.getByText(/喜欢:火锅/)).toBeInTheDocument()
  })

  it('点击行触发 onPick 并关闭', () => {
    const { onPick, onOpenChange } = setup()
    fireEvent.click(screen.getByText('阿明'))
    expect(onPick).toHaveBeenCalledWith('a')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('键盘 ↓ + Enter 选中第二项', () => {
    const { onPick } = setup()
    const input = screen.getByPlaceholderText(/寻找/)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith('b')
  })

  it('Esc 关闭', () => {
    const { onOpenChange } = setup()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('关闭状态下 Ctrl+K 打开', () => {
    const { onOpenChange } = setup({ open: false })
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('焦点在 input 内时 Ctrl+K 不劫持', () => {
    render(<input data-testid="outside" />)
    const { onOpenChange } = setup({ open: false })
    fireEvent.keyDown(screen.getByTestId('outside'), { key: 'k', ctrlKey: true })
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('无好友显示空宇宙提示', () => {
    setup({ friends: [] })
    expect(screen.getByText(/宇宙还空着/)).toBeInTheDocument()
    expect(screen.getByText(/新纪录/)).toBeInTheDocument()
  })

  it('无匹配显示没有找到', () => {
    setup()
    fireEvent.change(screen.getByPlaceholderText(/寻找/), { target: { value: 'zzz' } })
    expect(screen.getByText(/没有找到/)).toBeInTheDocument()
    expect(screen.getByText(/新纪录/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run components/SearchOverlay.test.tsx`
Expected: FAIL — 找不到模块 `./SearchOverlay`

- [ ] **Step 3: 实现组件**

创建 `components/SearchOverlay.tsx`:

```tsx
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
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run components/SearchOverlay.test.tsx`
Expected: PASS(10 个用例)

- [ ] **Step 5: Commit**

```bash
git add components/SearchOverlay.tsx components/SearchOverlay.test.tsx
git commit -m "feat: add SearchOverlay command palette component"
```

---

### Task 4: 首页接入(飞星动线)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 接入组件**

对 `app/page.tsx` 做四处修改:

1. 顶部 import 增加:

```tsx
import SearchOverlay from '@/components/SearchOverlay'
```

2. `HomePage` 内新增状态(放在 `focusedFriendId` 之后):

```tsx
const [searchOpen, setSearchOpen] = useState(false)
```

3. 导航栏右侧改成按钮组——把现有的 `<Link href="/friend/new" ...>✦ 新纪录</Link>` 包进一个 flex 容器,并在其前面加「⌕ 寻星」按钮:

```tsx
<span style={{ display:'flex', gap:10 }}>
  <button type="button" onClick={() => setSearchOpen(true)} style={{
    color: gold.base, fontSize: fs.meta, letterSpacing:2,
    border:`1px solid ${border.gold}`, borderRadius: radius.pill,
    padding:'10px 18px', background:'none', cursor:'pointer',
    fontFamily:'inherit', pointerEvents:'auto',
  }}>⌕ 寻星</button>
  <Link href="/friend/new" style={{
    color: gold.base, fontSize: fs.meta, letterSpacing:2,
    border:`1px solid ${border.gold}`, borderRadius: radius.pill,
    padding:'10px 18px', textDecoration:'none', pointerEvents:'auto',
  }}>✦ 新纪录</Link>
</span>
```

4. 在 `entered && (...)` 分支内(`FirstRunHint` 一行之后)挂载浮层,选中走 `InsightPanel` 同款飞星动线:

```tsx
<SearchOverlay
  friends={friends}
  open={searchOpen}
  onOpenChange={setSearchOpen}
  onPick={id => { setSelectedFriendId(id); setFocusedFriendId(id) }}
/>
```

- [ ] **Step 2: 手动验证**

Run: `npm run dev`,浏览器打开 `http://localhost:3000`,进入星图后:
- 点「⌕ 寻星」→ 浮层出现,列出全部好友
- 按 `Ctrl+K` → 同样打开;`Esc` 关闭
- 输入名字选中一位 → 相机飞向那颗星、卡片停靠,浮层关闭

- [ ] **Step 3: 回归测试**

Run: `npx vitest run`
Expected: PASS(全部)

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire SearchOverlay into star map with fly-to"
```

---

### Task 5: 好友详情页接入(路由跳转)

**Files:**
- Modify: `app/friend/[friendId]/page.tsx`

- [ ] **Step 1: 接入组件**

对 `app/friend/[friendId]/page.tsx` 做四处修改:

1. 顶部 import 增加:

```tsx
import SearchOverlay from '@/components/SearchOverlay'
```

2. 新增状态(放在 `friend` 状态之后):

```tsx
const [allFriends, setAllFriends] = useState<Friend[]>([])
const [searchOpen, setSearchOpen] = useState(false)
```

在现有 `useEffect` 中顺带保存全量列表(`getFriends()` 只调一次):

```tsx
useEffect(() => {
  const all = getFriends()
  const found = all.find(f => f.id === friendId) ?? null
  // One-time client-only localStorage read keyed on friendId; not a subscription to an
  // external system, and there's no render-time alternative since localStorage doesn't
  // exist during SSR.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setFriend(found)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setAllFriends(all)
}, [friendId])
```

3. 主渲染分支(`friend` 非空的 return)中,把「← 返回星图」一行改为两端对齐的 flex 行,右侧加搜索按钮:

```tsx
<div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:32 }}>
  <Link href="/" style={{ color: gold.muted, fontSize: fs.meta, letterSpacing:2,
    textDecoration:'none' }}>← 返回星图</Link>
  <button type="button" onClick={() => setSearchOpen(true)} style={{
    color: gold.muted, fontSize: fs.meta, letterSpacing:2,
    background:'none', border:'none', cursor:'pointer', fontFamily:'inherit',
    padding:0,
  }}>⌕ 寻星</button>
</div>
```

(原 Link 上的 `display:'block', marginBottom:32` 移到外层 div,Link 本身去掉这两项。)

4. 同一分支 `</main>` 闭合前挂载浮层,选中即跳转:

```tsx
<SearchOverlay
  friends={allFriends}
  open={searchOpen}
  onOpenChange={setSearchOpen}
  onPick={id => router.push(`/friend/${id}`)}
/>
```

- [ ] **Step 2: 手动验证**

Run: `npm run dev`,进入任一好友详情页:
- 点「⌕ 寻星」或 `Ctrl+K` → 浮层打开
- 选另一位好友 → 跳转到对方详情页,数据正确刷新
- 详情页表单输入框聚焦时按 `Ctrl+K` → 不打开(不劫持输入)

- [ ] **Step 3: 回归测试 + 构建**

Run: `npx vitest run`
Expected: PASS(全部)

Run: `npm run build`
Expected: 构建成功,无类型错误

- [ ] **Step 4: Commit**

```bash
git add app/friend/[friendId]/page.tsx
git commit -m "feat: add friend search to friend detail page"
```

---

### Task 6: 端到端验证收尾

- [ ] **Step 1: 全量测试与构建**

Run: `npx vitest run && npm run lint && npm run build`
Expected: 全部通过

- [ ] **Step 2: 真实界面验证**

使用项目的 `verify` 技能(headless Edge + mock 上游)走一遍:进入星图 → `Ctrl+K` → 搜索 → 飞星 → 卡片停靠;再进好友页 → 搜索 → 跳转。留存截图确认视觉与 token 一致。

- [ ] **Step 3: 如有问题修复后再跑 Step 1,全绿后结束**
