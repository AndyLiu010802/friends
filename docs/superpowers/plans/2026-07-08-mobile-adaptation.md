# 手机端适配 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手机浏览器/PWA 上可完成友记全部日常操作：单指拖拽旋转星图、双指捏合缩放、轻点弹底部抽屉卡片、星象胶囊、可滚动表单、可安装到主屏。

**Architecture:** 手势数学抽为纯函数（`lib/gestures.ts`）供 StarMap 接线调用；设备判定统一走 `lib/useIsMobile.ts`；FriendCard/InsightPanel 用 variant/移动形态分支而非复制组件；全局 CSS 修滚动与 iOS 输入缩放；PWA 走 Next 文件约定（`app/manifest.ts`、`app/icon.svg`、`app/apple-icon.png`）。

**Tech Stack:** Pointer Events、Three.js r134、Next.js 16 metadata 文件约定、Vitest（jsdom；纯 Node 逻辑不受影响）。

**通用约定：** 测试命令 `npx vitest run <file>`；全量 `npm test`；每个 Task 一次 commit。设计文档见 `docs/superpowers/specs/2026-07-08-mobile-adaptation-design.md`。

---

### Task 1: 手势纯函数 `lib/gestures.ts`

**Files:**
- Create: `lib/gestures.ts`
- Test: `lib/gestures.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// lib/gestures.test.ts
import { describe, it, expect } from 'vitest'
import { isTap, applyZoom, createPinchTracker } from './gestures'

describe('isTap', () => {
  it('位移小于阈值算轻点', () => {
    expect(isTap({ x: 100, y: 100 }, { x: 102, y: 103 })).toBe(true)
  })
  it('位移达到 5px 不算轻点', () => {
    expect(isTap({ x: 100, y: 100 }, { x: 105, y: 100 })).toBe(false)
  })
})

describe('applyZoom', () => {
  it('正常累加缩放增量', () => {
    expect(applyZoom(9, 1.5)).toBe(10.5)
  })
  it('下限 3.5', () => {
    expect(applyZoom(4, -2)).toBe(3.5)
  })
  it('上限 16', () => {
    expect(applyZoom(15, 5)).toBe(16)
  })
})

describe('createPinchTracker', () => {
  it('单指移动不产生缩放增量、不算捏合', () => {
    const t = createPinchTracker()
    t.down(1, 0, 0)
    expect(t.isPinching).toBe(false)
    expect(t.move(1, 10, 0)).toBe(0)
  })

  it('双指靠近产生正增量（缩小视野=拉远取反由调用方决定）', () => {
    const t = createPinchTracker()
    t.down(1, 0, 0)
    t.down(2, 100, 0)
    expect(t.isPinching).toBe(true)
    // 指 2 从 x=100 移到 x=80：两指间距 100 → 80，返回 lastDist - dist = 20
    expect(t.move(2, 80, 0)).toBe(20)
    // 再移回 90：间距 80 → 90，返回 -10
    expect(t.move(2, 90, 0)).toBe(-10)
  })

  it('第二指按下的那一刻不产生跳变增量', () => {
    const t = createPinchTracker()
    t.down(1, 0, 0)
    t.down(2, 50, 0)
    // down 之后第一次 move 位置不变，增量应为 0
    expect(t.move(2, 50, 0)).toBe(0)
  })

  it('抬起一指后回到单指状态，不再产生增量', () => {
    const t = createPinchTracker()
    t.down(1, 0, 0)
    t.down(2, 100, 0)
    t.up(2)
    expect(t.isPinching).toBe(false)
    expect(t.move(1, 30, 0)).toBe(0)
  })

  it('本轮手势曾出现过双指则 wasPinch 为 true，全部抬起后复位', () => {
    const t = createPinchTracker()
    t.down(1, 0, 0)
    t.down(2, 100, 0)
    t.up(2)
    expect(t.wasPinch).toBe(true) // 用于抑制捏合结束时的误轻点
    t.up(1)
    expect(t.wasPinch).toBe(false)
  })

  it('未知指针的 move 被忽略', () => {
    const t = createPinchTracker()
    expect(t.move(9, 1, 1)).toBe(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run lib/gestures.test.ts`
Expected: FAIL — 找不到模块 `./gestures`。

- [ ] **Step 3: 最小实现**

```ts
// lib/gestures.ts
// 星图触屏手势的纯逻辑，不依赖 DOM/Three.js，便于单元测试。
// 接线方（StarMap）负责把 PointerEvent 坐标喂进来并消费返回值。

const TAP_THRESHOLD_PX = 5
const ZOOM_MIN = 3.5
const ZOOM_MAX = 16

export interface Point { x: number; y: number }

export function isTap(down: Point, up: Point, threshold = TAP_THRESHOLD_PX): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) < threshold
}

// 与滚轮缩放共用同一 clamp 区间（见 StarMap onWheel）。
export function applyZoom(currentZ: number, delta: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, currentZ + delta))
}

export interface PinchTracker {
  down(id: number, x: number, y: number): void
  /** 返回两指间距的变化量（旧 - 新，正值 = 两指靠近）；非捏合状态返回 0 */
  move(id: number, x: number, y: number): number
  up(id: number): void
  readonly isPinching: boolean
  /** 本轮手势（从第一指按下到全部抬起）是否出现过双指，用于抑制捏合尾部的误轻点 */
  readonly wasPinch: boolean
}

export function createPinchTracker(): PinchTracker {
  const pointers = new Map<number, Point>()
  let lastDist: number | null = null
  let pinched = false

  function dist(): number {
    const [a, b] = [...pointers.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  return {
    down(id, x, y) {
      pointers.set(id, { x, y })
      if (pointers.size === 2) {
        lastDist = dist()
        pinched = true
      }
    },
    move(id, x, y) {
      if (!pointers.has(id)) return 0
      pointers.set(id, { x, y })
      if (pointers.size !== 2 || lastDist === null) return 0
      const d = dist()
      const delta = lastDist - d
      lastDist = d
      return delta
    },
    up(id) {
      pointers.delete(id)
      lastDist = pointers.size === 2 ? dist() : null
      if (pointers.size === 0) pinched = false
    },
    get isPinching() { return pointers.size >= 2 },
    get wasPinch() { return pinched },
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run lib/gestures.test.ts`
Expected: 12 passed。

- [ ] **Step 5: Commit**

```bash
git add lib/gestures.ts lib/gestures.test.ts
git commit -m "feat: add pure gesture helpers (tap, zoom clamp, pinch tracker)"
```

---

### Task 2: 设备判定 `lib/useIsMobile.ts`

**Files:**
- Create: `lib/useIsMobile.ts`
- Test: `lib/useIsMobile.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// lib/useIsMobile.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from './useIsMobile'

type Listener = (e: { matches: boolean }) => void

function stubMatchMedia(initial: boolean) {
  const listeners: Listener[] = []
  const mql = {
    matches: initial,
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    removeEventListener: (_: string, fn: Listener) => {
      const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1)
    },
  }
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql))
  return {
    fire(matches: boolean) { mql.matches = matches; listeners.forEach(fn => fn({ matches })) },
    listeners,
  }
}

beforeEach(() => vi.unstubAllGlobals())

describe('useIsMobile', () => {
  it('初始返回 matchMedia 当前值', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('media query 变化时更新', () => {
    const ctl = stubMatchMedia(false)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
    act(() => ctl.fire(true))
    expect(result.current).toBe(true)
  })

  it('卸载时移除监听', () => {
    const ctl = stubMatchMedia(false)
    const { unmount } = renderHook(() => useIsMobile())
    expect(ctl.listeners.length).toBe(1)
    unmount()
    expect(ctl.listeners.length).toBe(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run lib/useIsMobile.test.tsx`
Expected: FAIL — 找不到模块 `./useIsMobile`。

- [ ] **Step 3: 最小实现**

```ts
// lib/useIsMobile.ts
'use client'
import { useEffect, useState } from 'react'

const QUERY = '(max-width: 640px)'

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  )
  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = (e: { matches: boolean }) => setMobile(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return mobile
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run lib/useIsMobile.test.tsx`
Expected: 3 passed。

- [ ] **Step 5: Commit**

```bash
git add lib/useIsMobile.ts lib/useIsMobile.test.tsx
git commit -m "feat: add useIsMobile hook for 640px breakpoint"
```

---

### Task 3: FriendCard 底部抽屉形态

**Files:**
- Modify: `components/FriendCard.tsx`（Props 与外层 div 样式）
- Test: `components/FriendCard.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// components/FriendCard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FriendCard from './FriendCard'
import type { Friend } from '@/lib/types'

const friend: Friend = {
  id: 'f1', name: '小王', important: false,
  likes: [], dislikes: [], hobbies: [],
  portraits: [], memories: [], relationships: [],
  starConfig: { kind: 'nebula', coreColor: '#7c3aed', glowColor: '#ec4899',
    size: 1, twinkleSpeed: 2, position: [0, 0, 0] },
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

describe('FriendCard', () => {
  it('默认 floating：使用传入的定位样式', () => {
    render(<FriendCard friend={friend} style={{ left: 123, top: 45 }} />)
    const card = screen.getByTestId('friend-card')
    expect(card).toHaveStyle({ left: '123px', top: '45px' })
  })

  it('sheet：贴底全宽，忽略指针定位', () => {
    render(<FriendCard friend={friend} variant="sheet" style={{ left: 123, top: 45 }} />)
    const card = screen.getByTestId('friend-card')
    expect(card).toHaveStyle({ left: '0px', right: '0px', bottom: '0px' })
    expect(card).not.toHaveStyle({ top: '45px' })
  })

  it('sheet 也能渲染名字与操作链接', () => {
    render(<FriendCard friend={friend} variant="sheet" />)
    expect(screen.getByText('小王')).toBeInTheDocument()
    expect(screen.getByText('编辑')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run components/FriendCard.test.tsx`
Expected: FAIL — 找不到 `data-testid="friend-card"`（以及 variant 属性不存在导致的类型错误）。

- [ ] **Step 3: 修改 FriendCard**

`components/FriendCard.tsx` 中 Props 加 variant：

```tsx
interface Props {
  friend: Friend
  style?: CSSProperties
  pinned?: boolean
  onClose?: () => void
  variant?: 'floating' | 'sheet'
}
```

函数签名改为：

```tsx
export default function FriendCard({ friend, style, pinned, onClose, variant = 'floating' }: Props) {
```

外层 div（现为 `<div style={{ position:'fixed', zIndex:20, minWidth:220, maxWidth:260, ... }}>`）替换为：

```tsx
  const sheet = variant === 'sheet'
  return (
    <div data-testid="friend-card" style={{
      position:'fixed', zIndex:20,
      background:'rgba(4,7,20,0.94)', border:'1px solid rgba(226,185,111,0.3)',
      backdropFilter:'blur(12px)', pointerEvents:'auto',
      ...(sheet
        ? {
            left:0, right:0, bottom:0,
            borderRadius:'16px 16px 0 0',
            maxHeight:'60vh', overflowY:'auto',
            padding:'20px 24px',
            paddingBottom:'calc(20px + env(safe-area-inset-bottom))',
            animation:'youji-sheet-in .25s ease-out',
          }
        : {
            minWidth:220, maxWidth:260,
            borderRadius:12, padding:'16px 20px',
            ...style,
          }),
    }}>
```

底部操作区（`编辑` / `图鉴` 两个 Link 的容器）在 sheet 下加大触达：把

```tsx
      <div style={{ marginTop:12, display:'flex', gap:8 }}>
```

改为

```tsx
      <div style={{ marginTop:12, display:'flex', gap:8 }}>
```

保持不变，但两个 Link 的 `padding:'4px 10px'` 改为动态：

```tsx
padding: sheet ? '10px 18px' : '4px 10px', fontSize: sheet ? 12 : 10,
```

（两个 Link 都改。）

`app/globals.css` 末尾追加滑入动画 keyframes：

```css
@keyframes youji-sheet-in {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run components/FriendCard.test.tsx`
Expected: 3 passed。

- [ ] **Step 5: 全量回归**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add components/FriendCard.tsx components/FriendCard.test.tsx app/globals.css
git commit -m "feat: add bottom-sheet variant to FriendCard"
```

---

### Task 4: InsightPanel 手机胶囊形态

**Files:**
- Modify: `components/InsightPanel.tsx`
- Test: `components/InsightPanel.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// components/InsightPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InsightPanel from './InsightPanel'
import { useIsMobile } from '@/lib/useIsMobile'

vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: vi.fn() }))
vi.mock('@/lib/insights', () => ({
  generateFriendInsights: vi.fn().mockReturnValue([
    { id: 'i1', friendId: 'f1', text: '小王的生日还有 3 天' },
    { id: 'i2', friendId: 'f2', text: '你已两个月没记录小李' },
  ]),
}))

beforeEach(() => vi.mocked(useIsMobile).mockReturnValue(false))

describe('InsightPanel', () => {
  it('桌面：直接展示洞察列表', () => {
    render(<InsightPanel friends={[]} onSelectFriend={() => {}} />)
    expect(screen.getByText(/小王的生日/)).toBeInTheDocument()
  })

  it('手机：默认只显示带条数的胶囊', () => {
    vi.mocked(useIsMobile).mockReturnValue(true)
    render(<InsightPanel friends={[]} onSelectFriend={() => {}} />)
    expect(screen.getByRole('button', { name: /今日星象 · 2/ })).toBeInTheDocument()
    expect(screen.queryByText(/小王的生日/)).not.toBeInTheDocument()
  })

  it('手机：点胶囊展开列表，点洞察回调并收起', () => {
    vi.mocked(useIsMobile).mockReturnValue(true)
    const onSelect = vi.fn()
    render(<InsightPanel friends={[]} onSelectFriend={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /今日星象 · 2/ }))
    fireEvent.click(screen.getByText(/小王的生日/))
    expect(onSelect).toHaveBeenCalledWith('f1')
    expect(screen.queryByText(/小王的生日/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run components/InsightPanel.test.tsx`
Expected: FAIL — 手机两条用例失败（还没有胶囊形态）。

- [ ] **Step 3: 实现移动形态**

`components/InsightPanel.tsx` 整体替换为：

```tsx
'use client'
import { useState } from 'react'
import { generateFriendInsights } from '@/lib/insights'
import { useIsMobile } from '@/lib/useIsMobile'
import type { Friend } from '@/lib/types'

interface Props {
  friends: Friend[]
  onSelectFriend: (friendId: string) => void
}

export default function InsightPanel({ friends, onSelectFriend }: Props) {
  const insights = generateFriendInsights(friends)
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(false)

  const insightButton = (insight: { id: string; friendId: string; text: string }) => (
    <button
      key={insight.id}
      type="button"
      onClick={() => { onSelectFriend(insight.friendId); setExpanded(false) }}
      style={{
        textAlign:'left', background:'rgba(255,255,255,0.03)',
        border:'1px solid rgba(226,185,111,0.12)', borderRadius:8,
        padding: isMobile ? '12px 12px' : '8px 10px',
        color:'#e2e8f0', fontSize:11, lineHeight:1.6,
        cursor:'pointer', fontFamily:'Noto Serif SC, serif',
      }}
    >
      {insight.text}
    </button>
  )

  if (isMobile) {
    if (insights.length === 0) return null
    if (!expanded) {
      return (
        <button type="button" onClick={() => setExpanded(true)} style={{
          position:'fixed', left:16, bottom:'calc(16px + env(safe-area-inset-bottom))',
          zIndex:25, minHeight:44,
          background:'rgba(4,7,20,0.9)', border:'1px solid rgba(226,185,111,0.3)',
          borderRadius:22, padding:'10px 18px', backdropFilter:'blur(12px)',
          color:'#e2b96f', fontSize:12, letterSpacing:2, cursor:'pointer',
          fontFamily:'Noto Serif SC, serif',
        }}>
          ✦ 今日星象 · {insights.length}
        </button>
      )
    }
    return (
      <div style={{
        position:'fixed', left:0, right:0, bottom:0, zIndex:25,
        background:'rgba(4,7,20,0.94)', border:'1px solid rgba(226,185,111,0.3)',
        borderRadius:'16px 16px 0 0', padding:'16px 18px',
        paddingBottom:'calc(16px + env(safe-area-inset-bottom))',
        backdropFilter:'blur(12px)', maxHeight:'50vh', overflowY:'auto',
        animation:'youji-sheet-in .25s ease-out',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <span style={{ color:'#e2b96f', fontSize:12, letterSpacing:2 }}>今日星象</span>
          <button type="button" onClick={() => setExpanded(false)} style={{
            background:'none', border:'none', color:'rgba(226,185,111,0.5)',
            cursor:'pointer', fontSize:14, padding:'4px 8px',
          }}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {insights.map(insightButton)}
        </div>
      </div>
    )
  }

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
          {insights.map(insightButton)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run components/InsightPanel.test.tsx`
Expected: 3 passed。

- [ ] **Step 5: Commit**

```bash
git add components/InsightPanel.tsx components/InsightPanel.test.tsx
git commit -m "feat: collapse InsightPanel into a capsule on mobile"
```

---

### Task 5: 全局 CSS——滚动修复 + iOS 输入防缩放

**Files:**
- Modify: `app/globals.css:35-40`（body 规则）与文件末尾

- [ ] **Step 1: 修改 body 规则**

把：

```css
body {
  background: var(--bg);
  color: #e2e8f0;
  font-family: 'Noto Serif SC', serif;
  overflow: hidden; /* full-viewport canvas layout — required by StarMap */
}
```

改为：

```css
body {
  background: var(--bg);
  color: #e2e8f0;
  font-family: 'Noto Serif SC', serif;
  /* 星图页的画布是 position:fixed，不产生文档流内容；表单/设置/图鉴页需要正常滚动，
     因此不再全局 overflow:hidden。overscroll-behavior 防止移动端橡皮筋带崩全屏体验。 */
  overscroll-behavior: none;
}
```

- [ ] **Step 2: 文件末尾追加移动端输入规则**

```css
/* iOS Safari 在输入框字号 <16px 时聚焦会强制放大整页；
   inline style 优先级高于普通规则，必须 !important。 */
@media (max-width: 640px) {
  input, textarea, select {
    font-size: 16px !important;
  }
}
```

（注意 Task 3 已在此文件追加过 `@keyframes youji-sheet-in`，保留即可。）

- [ ] **Step 3: 全量回归**

Run: `npm test`
Expected: 全绿（该改动无单测，靠回归 + Task 9 构建验证）。

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "fix: restore page scrolling and prevent iOS input zoom on mobile"
```

---

### Task 6: 渲染降级——starfield 参数化 + scene 像素比

**Files:**
- Modify: `components/StarMap/starfield.ts:3-4`
- Modify: `components/StarMap/scene.ts:8-11`
- Test: `components/StarMap/starfield.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// components/StarMap/starfield.test.ts
import { describe, it, expect } from 'vitest'
import { buildStarfield } from './starfield'

describe('buildStarfield', () => {
  it('默认 1500 颗背景星', () => {
    const points = buildStarfield()
    expect(points.geometry.getAttribute('position').count).toBe(1500)
  })
  it('可传入更小数量（移动端降级）', () => {
    const points = buildStarfield(750)
    expect(points.geometry.getAttribute('position').count).toBe(750)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run components/StarMap/starfield.test.ts`
Expected: FAIL — `buildStarfield(750)` 仍返回 1500（参数被忽略/类型报错）。

- [ ] **Step 3: 参数化 starfield**

`components/StarMap/starfield.ts` 把：

```ts
export function buildStarfield(): THREE.Points {
  const N = 1500
```

改为：

```ts
export function buildStarfield(count = 1500): THREE.Points {
  const N = count
```

- [ ] **Step 4: scene 增加 coarse 降级**

`components/StarMap/scene.ts` 把：

```ts
export function initScene(canvas: HTMLCanvasElement) {
  _renderer = new THREE.WebGLRenderer({ antialias: true, canvas })
  _renderer.setSize(window.innerWidth, window.innerHeight)
  _renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
```

改为：

```ts
export function initScene(canvas: HTMLCanvasElement, opts?: { coarsePointer?: boolean }) {
  _renderer = new THREE.WebGLRenderer({ antialias: true, canvas })
  _renderer.setSize(window.innerWidth, window.innerHeight)
  // 触屏设备（手机/平板）降低渲染像素比：省电、保帧率。
  _renderer.setPixelRatio(Math.min(devicePixelRatio, opts?.coarsePointer ? 1.5 : 2))
```

- [ ] **Step 5: 跑测试确认通过 + 类型检查**

Run: `npx vitest run components/StarMap/starfield.test.ts`
Expected: 2 passed。
Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add components/StarMap/starfield.ts components/StarMap/scene.ts components/StarMap/starfield.test.ts
git commit -m "feat: reduce pixel ratio and starfield density on touch devices"
```

---

### Task 7: StarMap 接线——Pointer Events + 移动卡片

**Files:**
- Modify: `components/StarMap/StarMap.tsx`（事件系统整体替换）

此任务是 DOM/WebGL 接线，无法在 jsdom 单测；由 Task 1 的手势单测、`npx tsc --noEmit`、全量回归与 Task 9 的构建共同兜底。

- [ ] **Step 1: 改造 StarMap.tsx**

`components/StarMap/StarMap.tsx` 整体替换为：

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
import { isTap, applyZoom, createPinchTracker } from '@/lib/gestures'
import { useIsMobile } from '@/lib/useIsMobile'
import type { Friend } from '@/lib/types'
import * as THREE from 'three'

interface Props {
  selectedFriendId?: string | null
  onDeselect?: () => void
}

// 捏合像素距离 → 相机 z 轴距离的换算系数
const PINCH_ZOOM_FACTOR = 0.02

export default function StarMap({ selectedFriendId = null, onDeselect }: Props) {
  const threeRef = useRef<HTMLCanvasElement>(null)
  const trailRef = useRef<HTMLCanvasElement>(null)
  const [hoveredFriend, setHoveredFriend] = useState<Friend | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const [pinnedFriend, setPinnedFriend] = useState<Friend | null>(null)
  const [pinnedPos, setPinnedPos] = useState<{ x: number; y: number } | null>(null)
  const [friendsLoaded, setFriendsLoaded] = useState(false)
  // 鼠标等精确指针才有拖尾与 hover；挂载时判定一次（SSR 关闭，window 必存在）
  const [finePointer] = useState(() => window.matchMedia('(pointer: fine)').matches)
  const isMobile = useIsMobile()
  const starsRef  = useRef<StarObject[]>([])
  const linesRef  = useRef<LineObject[]>([])
  const pinnedFriendIdRef = useRef<string | null>(null)
  const friendsRef = useRef<Friend[]>([])

  useEffect(() => {
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    const { renderer, scene, camera, pivot } = initScene(threeRef.current!, { coarsePointer })
    if (trailRef.current) initTrail(trailRef.current)

    // Background
    scene.add(buildStarfield(coarsePointer ? 750 : 1500))

    // Load friends
    pullAll().then(() => {
      const friends = getFriends()
      friendsRef.current = friends
      setFriendsLoaded(true)
      const stars   = friends.map(f => buildStar(f))
      starsRef.current = stars
      stars.forEach(s => pivot.add(s.root))

      const lines = buildConstellationLines(friends)
      linesRef.current = lines
      lines.forEach(l => pivot.add(l.line))
    }).catch(console.error)

    // Raycaster for hover + tap
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2(-99, -99)
    const pinch = createPinchTracker()
    let isDrag = false, lx = 0, ly = 0
    let pointerDown: { x: number; y: number } | null = null

    const canvas = threeRef.current!

    const setNdc = (clientX: number, clientY: number) => {
      ndc.x =  (clientX / window.innerWidth)  * 2 - 1
      ndc.y = -(clientY / window.innerHeight) * 2 + 1
    }

    const pickFriend = (): Friend | null => {
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObjects(starsRef.current.map(s => s.hitMesh))
      if (!hits.length) return null
      const star = starsRef.current.find(s => s.hitMesh === hits[0].object)!
      return getFriends().find(f => f.id === star.friendId) ?? null
    }

    const onPointerDown = (e: PointerEvent) => {
      pinch.down(e.pointerId, e.clientX, e.clientY)
      if (pinch.isPinching) {
        // 进入捏合：取消拖拽与轻点
        isDrag = false
        pointerDown = null
        return
      }
      pointerDown = { x: e.clientX, y: e.clientY }
      isDrag = true; lx = e.clientX; ly = e.clientY
    }

    const onPointerMove = (e: PointerEvent) => {
      const zoomDelta = pinch.move(e.pointerId, e.clientX, e.clientY)
      if (pinch.isPinching) {
        // 两指靠近（delta>0）= 拉远；张开 = 拉近
        camera.position.z = applyZoom(camera.position.z, zoomDelta * PINCH_ZOOM_FACTOR)
        return
      }
      setNdc(e.clientX, e.clientY)
      if (isDrag) {
        pivot.rotation.y += (e.clientX - lx) * 0.006
        pivot.rotation.x += (e.clientY - ly) * 0.004
        lx = e.clientX; ly = e.clientY; return
      }
      if (e.pointerType !== 'mouse') return // 触屏无 hover
      // Hover
      const friend = pickFriend()
      if (friend) {
        const star = starsRef.current.find(s => s.friendId === friend.id)!
        setHoveredFriend(friend)
        setHoverPos({ x: e.clientX + 22, y: e.clientY - 12 })
        highlightLines(linesRef.current, pinnedFriendIdRef.current ?? friend.id)
        gsap.to(star.root.scale, { x:1.22, y:1.22, z:1.22, duration:.3, ease:'back.out(2)' })
      } else {
        setHoveredFriend(null)
        highlightLines(linesRef.current, pinnedFriendIdRef.current)
        starsRef.current.forEach(s => gsap.to(s.root.scale, { x:1, y:1, z:1, duration:.3 }))
      }
    }

    // Always resets drag state, even if the pointer is released over the FriendCard overlay.
    const onWindowPointerUp = (e: PointerEvent) => {
      pinch.up(e.pointerId)
      if (!pinch.isPinching) isDrag = false
    }

    // Only fires when the pointerup target is the canvas itself — clicks on the FriendCard
    // (higher z-index, pointerEvents:auto) never reach this handler, so its buttons work.
    const onCanvasPointerUp = (e: PointerEvent) => {
      const start = pointerDown
      pointerDown = null
      if (!start) return
      if (pinch.wasPinch) return // 捏合结束的抬指不算轻点
      if (!isTap(start, { x: e.clientX, y: e.clientY })) return

      setNdc(e.clientX, e.clientY) // 触屏没有 move 预热，用抬起坐标现算
      const friend = pickFriend()
      if (friend) {
        pinnedFriendIdRef.current = friend.id
        setPinnedFriend(friend)
        setPinnedPos({ x: e.clientX + 22, y: e.clientY - 12 })
        highlightLines(linesRef.current, friend.id)
      } else {
        pinnedFriendIdRef.current = null
        setPinnedFriend(null)
        setPinnedPos(null)
        highlightLines(linesRef.current, null)
        onDeselect?.()
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        pinnedFriendIdRef.current = null
        setPinnedFriend(null)
        setPinnedPos(null)
        highlightLines(linesRef.current, null)
        onDeselect?.()
      }
    }

    const onWheel = (e: WheelEvent) => {
      camera.position.z = applyZoom(camera.position.z, e.deltaY * .007)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onCanvasPointerUp)
    window.addEventListener('pointerup', onWindowPointerUp)
    window.addEventListener('pointercancel', onWindowPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('keydown', onKeyDown)
    canvas.addEventListener('wheel', onWheel, { passive: true })

    // Render loop
    let raf: number
    const loop = () => { raf = requestAnimationFrame(loop); renderer.render(scene, camera) }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onWindowPointerUp)
      window.removeEventListener('pointercancel', onWindowPointerUp)
      window.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onCanvasPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      disposeScene()
    }
  }, [])

  useEffect(() => {
    if (!selectedFriendId) return
    const friend = friendsRef.current.find(f => f.id === selectedFriendId)
    if (!friend) return
    pinnedFriendIdRef.current = friend.id
    setPinnedFriend(friend)
    setPinnedPos({ x: window.innerWidth / 2 - 130, y: window.innerHeight / 2 - 80 })
    highlightLines(linesRef.current, friend.id)
  }, [selectedFriendId, friendsLoaded])

  return (
    <>
      <canvas ref={threeRef} style={{
        position:'fixed', inset:0, touchAction:'none',
        cursor: finePointer ? 'none' : 'auto',
      }} />
      {finePointer && (
        <canvas ref={trailRef} style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:5 }} />
      )}
      {!isMobile && !pinnedFriend && hoveredFriend && (
        <FriendCard
          friend={hoveredFriend}
          style={{ left: hoverPos.x, top: hoverPos.y }}
        />
      )}
      {pinnedFriend && (isMobile || pinnedPos) && (
        <FriendCard
          friend={pinnedFriend}
          pinned
          variant={isMobile ? 'sheet' : 'floating'}
          onClose={() => {
            pinnedFriendIdRef.current = null
            setPinnedFriend(null)
            setPinnedPos(null)
            highlightLines(linesRef.current, null)
            onDeselect?.()
          }}
          style={!isMobile && pinnedPos ? { left: pinnedPos.x, top: pinnedPos.y } : undefined}
        />
      )}
    </>
  )
}
```

要点（review 时核对）：
- `initTrail` 只在 `finePointer` 时随条件渲染的 canvas 执行（`if (trailRef.current)` 守卫）。
- 触屏轻点用抬起坐标现算 NDC（`setNdc` in `onCanvasPointerUp`），否则 raycast 用的是 (-99,-99)。
- `pointercancel` 也走 `onWindowPointerUp`，防止来电/切后台后指针泄漏在 tracker 里。
- 手机上 pinned 卡片渲染条件放宽为 `isMobile || pinnedPos`（sheet 不需要坐标）。

- [ ] **Step 2: 类型检查 + 全量回归**

Run: `npx tsc --noEmit`
Expected: 无错误。
Run: `npm test`
Expected: 全绿。

- [ ] **Step 3: 顶部导航移动适配**

`app/page.tsx` 的 nav 样式 `padding:'18px 32px'` 改为：

```tsx
padding:'calc(14px + env(safe-area-inset-top)) 16px 14px',
```

「✦ 新纪录」Link 的样式 `padding:'6px 16px'` 改为：

```tsx
padding:'10px 18px',
```

- [ ] **Step 4: 再次回归**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 5: Commit**

```bash
git add components/StarMap/StarMap.tsx app/page.tsx
git commit -m "feat: pointer-event gestures with pinch zoom and mobile sheet wiring"
```

---

### Task 8: PWA——manifest、图标、viewport

**Files:**
- Create: `app/manifest.ts`
- Create: `app/icon.svg`
- Create: `scripts/generate-apple-icon.mjs`（生成 `app/apple-icon.png` 后提交二者）
- Modify: `app/layout.tsx`
- Test: `app/manifest.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// app/manifest.test.ts
import { describe, it, expect } from 'vitest'
import manifest from './manifest'

describe('manifest', () => {
  const m = manifest()
  it('可安装的最小字段齐全', () => {
    expect(m.name).toBe('友记')
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe('/')
    expect(m.theme_color).toBe('#020408')
    expect(m.background_color).toBe('#020408')
  })
  it('提供 SVG 与 PNG 图标', () => {
    const srcs = (m.icons ?? []).map(i => i.src)
    expect(srcs).toContain('/icon.svg')
    expect(srcs).toContain('/apple-icon.png')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run app/manifest.test.ts`
Expected: FAIL — 找不到模块 `./manifest`。

- [ ] **Step 3: 实现 manifest**

```ts
// app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '友记',
    short_name: '友记',
    description: '朋友星图 — 每个朋友都是一颗星',
    start_url: '/',
    display: 'standalone',
    background_color: '#020408',
    theme_color: '#020408',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run app/manifest.test.ts`
Expected: 2 passed。

- [ ] **Step 5: 创建 app/icon.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#020408"/>
  <radialGradient id="g" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#f5e3bd"/>
    <stop offset="55%" stop-color="#e2b96f"/>
    <stop offset="100%" stop-color="#e2b96f" stop-opacity="0"/>
  </radialGradient>
  <circle cx="256" cy="256" r="150" fill="url(#g)" opacity="0.35"/>
  <path d="M256 96 L286 226 L416 256 L286 286 L256 416 L226 286 L96 256 L226 226 Z"
        fill="#e2b96f"/>
  <circle cx="256" cy="256" r="26" fill="#f5e3bd"/>
</svg>
```

- [ ] **Step 6: 生成 apple-icon.png**

```js
// scripts/generate-apple-icon.mjs
// 一次性生成 app/apple-icon.png（180×180）。iOS 不认 manifest 里的 SVG，
// 需要位图 apple-icon。纯 Node 实现（zlib + 手写 PNG chunk），零新依赖。
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const SIZE = 180
const CX = SIZE / 2, CY = SIZE / 2

// 四芒星亮度场：菱形主体 + 中心高光 + 微光晕
function pixel(x, y) {
  const dx = x - CX, dy = y - CY
  const diamond = Math.abs(dx) + Math.abs(dy)          // 四芒星菱形
  const r = Math.hypot(dx, dy)
  const bg = [2, 4, 8]                                  // #020408
  const gold = [226, 185, 111]                          // #e2b96f
  const bright = [245, 227, 189]                        // #f5e3bd
  if (diamond < 52) {
    const t = Math.max(0, 1 - r / 20)                   // 中心高光
    return gold.map((c, i) => Math.round(c + (bright[i] - c) * t))
  }
  const halo = Math.max(0, 1 - r / 80) * 0.25           // 淡金光晕
  return bg.map((c, i) => Math.round(c + gold[i] * halo))
}

// RGBA 原始扫描线（每行前置 filter byte 0）
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE * 4 + 1)
  raw[row] = 0
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b] = pixel(x, y)
    const o = row + 1 + x * 4
    raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255
  }
}

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc & 0xffffff00) | c
    crc = (crc >>> 8) ^ (((0xedb88320 * 0) | 0) ^ c) // placeholder避免误导：见下方标准实现
  }
  return (crc ^ 0xffffffff) >>> 0
}

// 标准 CRC32（覆盖上面占位版本）
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(body))
  return Buffer.concat([len, body, c])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0 // 8bit RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])

writeFileSync(new URL('../app/apple-icon.png', import.meta.url), png)
console.log(`app/apple-icon.png written (${png.length} bytes)`)
```

（注意：文件里只保留表驱动的 `crc` 实现，把上方带 placeholder 注释的 `crc32` 函数整个删掉——执行者落盘时直接不要写入那个函数。）

Run: `node scripts/generate-apple-icon.mjs`
Expected: 输出 `app/apple-icon.png written (...)`。

验证 PNG 签名：

Run: `node -e "const b=require('fs').readFileSync('app/apple-icon.png'); console.log(b[0]===0x89 && b[1]===0x50 ? 'PNG OK' : 'BAD')"`
Expected: `PNG OK`

- [ ] **Step 7: layout 加 viewport**

`app/layout.tsx` 把：

```tsx
import type { Metadata } from 'next'
```

改为：

```tsx
import type { Metadata, Viewport } from 'next'
```

并在 `export const metadata` 之后加：

```tsx
export const viewport: Viewport = {
  themeColor: '#020408',
  viewportFit: 'cover', // 刘海屏下允许内容进入安全区，配合 env(safe-area-inset-*)
}
```

- [ ] **Step 8: 全量回归**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 9: Commit**

```bash
git add app/manifest.ts app/manifest.test.ts app/icon.svg app/apple-icon.png scripts/generate-apple-icon.mjs app/layout.tsx
git commit -m "feat: add PWA manifest, app icons, and viewport safe-area config"
```

---

### Task 9: 收尾——全量回归 + 构建

- [ ] **Step 1: 全量测试**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 2: 生产构建**

Run: `npm run build`
Expected: 构建成功；路由表出现 `○ /manifest.webmanifest`（或 `/manifest`）与 icon 资源。

- [ ] **Step 3: 手动验收清单（用户执行，写入交付说明）**

1. 手机（或 DevTools 设备模拟）打开星图：单指拖拽旋转、双指捏合缩放、轻点星星弹底部抽屉、点空白关闭。
2. 左下角「✦ 今日星象 · N」胶囊可展开/收起，点洞察飞到对应星。
3. `/friend/new` 表单页可正常滚动，聚焦输入框页面不放大。
4. Chrome/Safari「添加到主屏幕」，图标为金色四芒星，打开无地址栏全屏。

- [ ] **Step 4: 提交计划文档**

```bash
git add docs/superpowers/plans/2026-07-08-mobile-adaptation.md
git commit -m "docs: add mobile adaptation implementation plan"
```

---

## 自查记录

- **Spec 覆盖**：手势（Task 1/7）、设备判定（Task 2）、抽屉卡片（Task 3/7）、星象胶囊（Task 4）、滚动与输入修复（Task 5）、性能降级（Task 6/7）、PWA（Task 8）、导航安全区（Task 7 Step 3）。Spec 各节均有对应任务。
- **占位符扫描**：Task 8 Step 6 的脚本中明确指示删除 placeholder 函数、保留表驱动 crc；其余无 TBD。
- **类型一致性**：`createPinchTracker` 的 `down/move/up/isPinching/wasPinch`（Task 1 定义，Task 7 使用）、`applyZoom(currentZ, delta)`、`isTap(down, up)`、`buildStarfield(count)`、`initScene(canvas, opts)`、`FriendCard variant`、`useIsMobile()` 前后一致。
