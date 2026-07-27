# UI/UX 三大件整改 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地评审"三大件"：设计 token 整顿、入场页兼职加载 + 空状态 + 首次提示、星星 stagger 入场 + 相机飞向选中星。

**Architecture:** 新增 `lib/ui/tokens.ts` 作为视觉 token 唯一事实源，全站内联样式改引 token；首页数据所有权从 StarMap 上移到 HomePage（StarMap 变 prop 驱动）；相机动效收敛到 `components/StarMap/cameraFly.ts`。

**Tech Stack:** Next.js 16 + React 19 + three.js 0.134 + gsap 3 + vitest/@testing-library。

**约定：** 测试命令 `npm test`（vitest run）；构建 `npm run build`。仓库惯例直接在 master 小步提交。

---

## 批次一：设计 token

### Task 1: 创建 `lib/ui/tokens.ts` + globals.css 同步

**Files:**
- Create: `lib/ui/tokens.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: 写 token 模块**（纯常量，不写测试——测试常量等于复读）

```ts
// lib/ui/tokens.ts
// 全站视觉 token 唯一事实源。app/globals.css 的 @theme / :root 需与此同步。
//
// 排版规则：
// - 中文正文最小 fs.sub(13)，中文辅助信息最小 fs.meta(12)
// - fs.eyebrow(10) 仅限纯拉丁 eyebrow（如 "FRIEND ATLAS"）
// - 中文正文不加 letterSpacing；字距只用于标题/按钮/eyebrow

export const fs = {
  hero: 36,      // 图鉴页主标题（Ma Shan Zheng），全站仅一处
  display: 28,   // 页面大标题（Ma Shan Zheng）
  title: 16,     // 卡片标题/人名
  body: 14,      // 正文
  sub: 13,       // 次级正文（卡片内容、按钮文字）
  meta: 12,      // 辅助信息（日期、标签、完整度）
  eyebrow: 10,   // 仅拉丁 eyebrow
} as const

export const text = {
  primary: '#ece7db', // 主文（暖白）
  dim: '#b3ab9b',     // 次文，对黑底对比度 ≈9:1
  faint: '#847d6f',   // 弱文 ≈4.7:1，只用于 fs.meta 及以上字号
} as const

export const gold = { base: '#e2b96f', muted: '#a98f5e' } as const
export const purple = { base: '#a99dd1', muted: '#847aa8' } as const
export const danger = {
  text: '#f8a5a5',
  border: 'rgba(239,68,68,0.3)',
  borderFaint: 'rgba(239,68,68,0.15)',
  bg: 'rgba(239,68,68,0.04)',
} as const

export const border = {
  gold: 'rgba(226,185,111,0.3)',
  goldFaint: 'rgba(226,185,111,0.15)',
  goldStrong: 'rgba(226,185,111,0.4)',
  purple: 'rgba(155,142,196,0.3)',
} as const

export const surface = {
  card: 'rgba(4,7,20,0.94)',    // 浮层卡片底
  section: 'rgba(226,185,111,0.04)', // 页面区块底
  input: 'rgba(255,255,255,0.04)',
  chip: 'rgba(226,185,111,0.12)',
  raise: 'rgba(255,255,255,0.03)',   // 列表项/洞察按钮底
} as const

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const

export const font = {
  serif: "'Noto Serif SC', serif",
  hand: "'Ma Shan Zheng', cursive",
} as const
```

- [ ] **Step 2: 更新 `app/globals.css`**——`@theme`/`:root` 值与 tokens.ts 对齐，注释改指向 tokens.ts；`body` 的 `color` 改 `#ece7db`；`:root` 增加 `color-scheme: dark;`（修暗色下日期选择器/滚动条/自动填充）。

```css
:root {
  color-scheme: dark;
  --bg:         #020408;
  --gold:       #e2b96f;
  --gold-dim:   rgba(226,185,111,0.3);
  --purple:     #a99dd1;
  --purple-dim: rgba(155,142,196,0.5);
  --card-bg:    rgba(4,7,20,0.94);
  --card-border:rgba(226,185,111,0.3);
}
```

- [ ] **Step 3: `npm test` 全绿、`npx tsc --noEmit` 通过**
- [ ] **Step 4: Commit** `feat: add ui design tokens and color-scheme dark`

### Task 2–4 共用：token 替换映射表

替换时按**语义**套用，不是机械查换。视觉意图不变，数值收敛：

| 现值 | 替换为 |
|---|---|
| `fontSize:10`（中文） | `fs.meta` |
| `fontSize:10`（拉丁 eyebrow，如 "FRIEND ATLAS"） | `fs.eyebrow`（保留 letterSpacing） |
| `fontSize:11`（辅助信息） | `fs.meta` |
| `fontSize:11/12`（成句正文） | `fs.sub` |
| `fontSize:13`（正文/按钮） | `fs.body`（按钮可 `fs.sub`） |
| `fontSize:16`（人名/标题） | `fs.title` |
| `fontSize:26/28`（页面标题） | `fs.display` |
| `fontSize:36`（图鉴主标题） | `fs.hero` |
| `color:'#e2e8f0'` | `text.primary` |
| `color:'#cbd5e1'` | `text.dim` |
| `rgba(155,142,196,0.5~0.8)` 文字 | `purple.muted`（弱）或 `purple.base`（需强调） |
| `rgba(226,185,111,0.4~0.7)` 文字 | `gold.muted`（按钮/链接文字用 `gold.base`） |
| `color:'#e2b96f'` | `gold.base` |
| `rgba(252,165,165,*)` / `#f87171` 文字 | `danger.text` |
| `border rgba(226,185,111,0.15~0.25)` | `border.goldFaint` |
| `border rgba(226,185,111,0.3~0.35)` | `border.gold` |
| `border rgba(226,185,111,0.4)` | `border.goldStrong` |
| `background rgba(4,7,20,0.9/0.94)` | `surface.card` |
| `background rgba(226,185,111,0.04)` | `surface.section` |
| `background rgba(255,255,255,0.04)` | `surface.input` |
| `background rgba(226,185,111,0.1~0.15)` | `surface.chip` |
| `borderRadius: 6/8` | `radius.sm` |
| `borderRadius: 10`（输入框/小按钮） | `radius.sm` |
| `borderRadius: 10/12/14`（卡片/区块） | `radius.md`（浮层卡）或 `radius.lg`（页面区块/sheet） |
| `borderRadius: 16`（sheet） | `radius.lg` |
| `borderRadius: 20/22`（胶囊） | `radius.pill` |
| 中文正文（≤ `fs.body`）上的 `letterSpacing` | 删除 |
| `'Noto Serif SC, serif'` / `'Ma Shan Zheng, cursive'` | `font.serif` / `font.hand` |

### Task 2: 替换星图层组件

**Files:**
- Modify: `components/FriendCard.tsx`、`components/InsightPanel.tsx`、`components/StarMap/OrreryEntry.tsx`、`app/page.tsx`（顶部 nav）

- [ ] **Step 1:** 按映射表替换四个文件的全部内联样式值，`import { fs, text, gold, purple, border, surface, radius, font } from '@/lib/ui/tokens'`（按需引入）。重点：FriendCard 内容 11px → `fs.sub`，meta 10px → `fs.meta`；InsightPanel 洞察文字 11 → `fs.sub`。
- [ ] **Step 2:** `npm test`——FriendCard/InsightPanel 现有测试断言定位与文案，不断言字号，应保持全绿。
- [ ] **Step 3: Commit** `refactor: apply design tokens to star map layer components`

### Task 3: 替换表单与时间线组件

**Files:**
- Modify: `components/FriendForm.tsx`、`components/MemoryTimeline.tsx`、`components/RelationshipEditor.tsx`、`components/MediaUpload.tsx`

- [ ] **Step 1:** 按映射表替换。重点：MemoryTimeline 回忆内容 11 → `fs.sub`、日期 10 → `fs.meta`；FriendForm 标签 11 → `fs.meta` 且保留 letterSpacing（是标签不是正文）。
- [ ] **Step 2:** `npm test`
- [ ] **Step 3: Commit** `refactor: apply design tokens to form and timeline components`

### Task 4: 替换页面与面板

**Files:**
- Modify: `app/atlas/[friendId]/page.tsx`、`app/login/page.tsx`、`app/settings/page.tsx`、`app/friend/[friendId]/page.tsx`、`app/friend/new/page.tsx`、`components/AtlasChatBox.tsx`、`components/AccountPanel.tsx`、`components/BackupPanel.tsx`

- [ ] **Step 1:** 按映射表替换。重点：
  - atlas 页正文 13 → `fs.body`；区块 eyebrow「✦ 人物总结」等为中文 → `fs.meta`（保留 letterSpacing，作标题用）；"FRIEND ATLAS" 保持 `fs.eyebrow`。
  - atlas 页 token/成本两行（L122-127）：`fs.meta` + `text.faint`（本批不改布局，收纳到按钮下方属"全部修"范围）。
  - login/settings 标签 10-11 → `fs.meta`。
- [ ] **Step 2:** `npm test` + `npm run build`（批次一收尾，确认无类型/构建回归）
- [ ] **Step 3: Commit** `refactor: apply design tokens to pages and panels`

---

## 批次二：入场兼职加载 + 空状态 + 首次提示

### Task 5: StarMap prop 化（数据所有权上移准备）

**Files:**
- Modify: `components/StarMap/StarMap.tsx`

- [ ] **Step 1:** Props 增加 `friends: Friend[]`、`cinematic?: boolean`；删除内部 `pullAll` 与 `friendsLoaded`。挂载 effect 只建场景与交互，star/line 构建移入独立 effect：

```tsx
// 新增 refs
const sceneRef = useRef<ReturnType<typeof initScene> | null>(null)

// 挂载 effect 里：sceneRef.current = { renderer, scene, camera, pivot }
// pickFriend 改用 friendsRef.current 而非 getFriends()

// star/line 构建（替代原 pullAll().then(...) 块）：
useEffect(() => {
  const scene = sceneRef.current
  if (!scene || friends.length === 0) return
  const { pivot } = scene
  friendsRef.current = friends
  starsRef.current.forEach(s => pivot.remove(s.root))
  linesRef.current.forEach(l => pivot.remove(l.line))

  const stars = friends.map(f => buildStar(f))
  starsRef.current = stars
  stars.forEach(s => pivot.add(s.root))

  const lines = buildConstellationLines(friends)
  linesRef.current = lines
  lines.forEach(l => pivot.add(l.line))
}, [friends])
```

（stagger/淡入在 Task 9 加；本 task 保持现有动画行为。）
- [ ] **Step 2:** `app/page.tsx` 临时传 `friends={friends}`（HomePage 已有该 state），确认页面手动可用：`npm run dev` 打开首页，星图正常渲染、点选正常。
- [ ] **Step 3:** `npm test` + Commit `refactor: make StarMap prop-driven, lift data ownership to HomePage`

### Task 6: HomePage 立即拉数 + OrreryEntry 兼职加载

**Files:**
- Modify: `app/page.tsx`、`components/StarMap/OrreryEntry.tsx`
- Test: `components/StarMap/OrreryEntry.test.tsx`（新建）

- [ ] **Step 1: 写失败测试**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import OrreryEntry from './OrreryEntry'

vi.mock('gsap', () => ({ gsap: {
  fromTo: vi.fn(),
  to: vi.fn((_t: unknown, vars: { onComplete?: () => void }) => { vars.onComplete?.() }),
} }))

afterEach(() => vi.useRealTimers())

describe('OrreryEntry', () => {
  it('未就绪时显示加载文案', () => {
    render(<OrreryEntry ready={false} onEnter={() => {}} />)
    expect(screen.getByText('正在校准星轨…')).toBeInTheDocument()
  })

  it('就绪后显示进入提示，并在最短展示时长后自动进入', () => {
    vi.useFakeTimers()
    const onEnter = vi.fn()
    render(<OrreryEntry ready onEnter={onEnter} />)
    expect(screen.getByText('点击进入')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(2100) })
    expect(onEnter).toHaveBeenCalled()
  })

  it('品牌名为 友记', () => {
    render(<OrreryEntry ready={false} onEnter={() => {}} />)
    expect(screen.getByText('友记')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2:** 运行 `npm test -- OrreryEntry`，确认因缺 `ready` prop/文案而失败。
- [ ] **Step 3: 实现 OrreryEntry**（保留圆环动画与样式，新逻辑如下；文字用 token）：

```tsx
interface Props { ready: boolean; onEnter: () => void }
const MIN_SPLASH_MS = 1600
const AUTO_ENTER_EXTRA_MS = 400

// 组件内：
const leavingRef = useRef(false)
const mountedAtRef = useRef(Date.now())

function leave() {
  if (leavingRef.current) return
  leavingRef.current = true
  gsap.to(ref.current!, { opacity:0, scale:1.4, duration:.8, ease:'power2.in', onComplete: onEnter })
}

useEffect(() => {
  if (!ready) return
  const elapsed = Date.now() - mountedAtRef.current
  const wait = Math.max(0, MIN_SPLASH_MS - elapsed) + AUTO_ENTER_EXTRA_MS
  const t = setTimeout(leave, wait)
  return () => clearTimeout(t)
}, [ready])

// onClick={leave}（点击随时跳过，数据未到也放行）
// 主标题「朋友笔记」→「友记」；副标题：{ready ? '点击进入' : '正在校准星轨…'}
```

- [ ] **Step 4: HomePage**——挂载即拉数（不等 entered），传 `ready` 给 OrreryEntry、`friends`/`cinematic` 给 StarMap：

```tsx
const [entered, setEntered] = useState(hasEnteredThisPageLoad)
const [cinematic] = useState(!hasEnteredThisPageLoad) // 本次页面加载首次进入才播推镜
const [friends, setFriends] = useState<Friend[]>([])
const [dataReady, setDataReady] = useState(false)

useEffect(() => {
  pullAll()
    .catch(console.error)
    .finally(() => { setFriends(getFriends()); setDataReady(true) })
}, [])

// {!entered && <OrreryEntry ready={dataReady} onEnter={...} />}
// {entered && <StarMap friends={friends} cinematic={cinematic} ... />}
```

- [ ] **Step 5:** `npm test` 全绿；`npm run dev` 手动验证：加载中文案 → 自动进入；快速点击可跳过。
- [ ] **Step 6: Commit** `feat: entry splash doubles as loading screen with auto-enter`

### Task 7: 空状态 EmptyUniverse

**Files:**
- Create: `components/EmptyUniverse.tsx`
- Modify: `app/page.tsx`、`app/globals.css`（呼吸 keyframes）
- Test: `components/EmptyUniverse.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmptyUniverse from './EmptyUniverse'

describe('EmptyUniverse', () => {
  it('渲染引导文案与新建链接', () => {
    render(<EmptyUniverse />)
    expect(screen.getByText(/你的宇宙还空着/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /点亮第一位朋友/ })).toHaveAttribute('href', '/friend/new')
  })
})
```

- [ ] **Step 2:** 运行确认失败（模块不存在）。
- [ ] **Step 3: 实现**

```tsx
'use client'
import Link from 'next/link'
import { fs, text, gold, border, radius, font } from '@/lib/ui/tokens'

export default function EmptyUniverse() {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:15, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:24, pointerEvents:'none' }}>
      <div style={{ width:28, height:28, borderRadius:'50%',
        background:'radial-gradient(circle, #fff 0%, #e2b96f 40%, transparent 70%)',
        boxShadow:'0 0 24px #e2b96f, 0 0 72px rgba(226,185,111,0.4)',
        animation:'youji-breathe 4.5s ease-in-out infinite' }} />
      <div style={{ color: text.primary, fontSize: fs.title, fontFamily: font.serif }}>
        你的宇宙还空着
      </div>
      <Link href="/friend/new" style={{ pointerEvents:'auto', color: gold.base,
        fontSize: fs.sub, letterSpacing:2, textDecoration:'none',
        border:`1px solid ${border.gold}`, borderRadius: radius.pill, padding:'12px 28px' }}>
        ✦ 点亮第一位朋友
      </Link>
    </div>
  )
}
```

globals.css 追加：

```css
@keyframes youji-breathe {
  0%, 100% { transform: scale(1);    opacity: .75; }
  50%      { transform: scale(1.25); opacity: 1;   }
}
```

- [ ] **Step 4:** `app/page.tsx` 在 `entered && dataReady && friends.length === 0` 时渲染 `<EmptyUniverse />`。
- [ ] **Step 5:** `npm test` + Commit `feat: add first-run empty state to star map`

### Task 8: FirstRunHint 首次操作提示

**Files:**
- Create: `components/FirstRunHint.tsx`
- Modify: `app/page.tsx`
- Test: `components/FirstRunHint.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import FirstRunHint from './FirstRunHint'
import { useIsMobile } from '@/lib/useIsMobile'

vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: vi.fn() }))
beforeEach(() => { localStorage.clear(); vi.mocked(useIsMobile).mockReturnValue(false) })
afterEach(() => vi.useRealTimers())

describe('FirstRunHint', () => {
  it('首次显示提示并写入标记', () => {
    render(<FirstRunHint />)
    expect(screen.getByText(/拖动旋转/)).toBeInTheDocument()
    expect(localStorage.getItem('youji-hint-seen')).toBe('1')
  })

  it('已看过则不再显示', () => {
    localStorage.setItem('youji-hint-seen', '1')
    render(<FirstRunHint />)
    expect(screen.queryByText(/拖动旋转/)).not.toBeInTheDocument()
  })

  it('5 秒后消失', () => {
    vi.useFakeTimers()
    render(<FirstRunHint />)
    act(() => { vi.advanceTimersByTime(5200) })
    expect(screen.queryByText(/拖动旋转/)).not.toBeInTheDocument()
  })

  it('移动端提示双指缩放', () => {
    vi.mocked(useIsMobile).mockReturnValue(true)
    render(<FirstRunHint />)
    expect(screen.getByText(/双指缩放/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2:** 运行确认失败。
- [ ] **Step 3: 实现**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { fs, text, surface, border, radius, font } from '@/lib/ui/tokens'

const KEY = 'youji-hint-seen'
const SHOW_MS = 5000

export default function FirstRunHint() {
  const isMobile = useIsMobile()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(KEY)) return
    localStorage.setItem(KEY, '1')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true)
    const t = setTimeout(() => setVisible(false), SHOW_MS)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null
  return (
    <div style={{ position:'fixed', left:'50%', transform:'translateX(-50%)',
      bottom:'calc(72px + env(safe-area-inset-bottom))', zIndex:25,
      background: surface.card, border:`1px solid ${border.goldFaint}`,
      borderRadius: radius.pill, padding:'10px 22px', backdropFilter:'blur(12px)',
      color: text.dim, fontSize: fs.meta, fontFamily: font.serif, letterSpacing:1,
      pointerEvents:'none' }}>
      {isMobile ? '拖动旋转 · 双指缩放 · 点一颗星' : '拖动旋转 · 滚轮缩放 · 点击一颗星'}
    </div>
  )
}
```

- [ ] **Step 4:** `app/page.tsx` 在 `entered && dataReady && friends.length > 0` 时渲染 `<FirstRunHint />`。
- [ ] **Step 5:** `npm test` + `npm run build` + Commit `feat: add first-run interaction hint`

---

## 批次三：stagger 入场 + 相机动效

### Task 9: 星星 stagger + 连线淡入

**Files:**
- Modify: `components/StarMap/StarBuilder.ts`、`components/StarMap/StarMap.tsx`

- [ ] **Step 1:** `buildStar` 加参：`export function buildStar(friend: Friend, appearDelay = 0): StarObject`；scale-in 动画加 `delay: appearDelay`。
- [ ] **Step 2:** StarMap friends effect 中（仅 cinematic 首次构建时 stagger，编辑页返回不重播慢动画）：

```tsx
const cinematicPendingRef = useRef(cinematic) // 首次非空构建后置 false

// friends effect 内：
const useStagger = cinematicPendingRef.current
cinematicPendingRef.current = false
const stars = friends.map((f, i) => buildStar(f, useStagger ? Math.min(i * 0.06, 2) : 0))
// ...
lines.forEach((l, i) => {
  const mat = l.line.material as THREE.LineBasicMaterial
  const target = mat.opacity
  mat.opacity = 0
  gsap.to(mat, { opacity: target, ease: 'power1.out',
    duration: useStagger ? 1.2 : 0.4, delay: useStagger ? 1 + i * 0.05 : 0 })
})
```

- [ ] **Step 3:** `npm test`；`npm run dev` 手动验证首次进入星星依次绽放、连线随后浮现，从编辑页返回无慢动画。
- [ ] **Step 4: Commit** `feat: stagger star entrance and fade in constellation lines`

### Task 10: 入场推镜 dolly-in

**Files:**
- Modify: `components/StarMap/StarMap.tsx`

- [ ] **Step 1:** 挂载 effect 中，`cinematic` 时相机从远处推进；用户缩放/拖拽即接管：

```tsx
let dolly: gsap.core.Tween | null = null
if (cinematic) {
  camera.position.z = 26
  dolly = gsap.to(camera.position, { z: 9, duration: 1.8, ease: 'power3.out' })
}
// onWheel / pinch.move 生效分支 / onPointerDown 开头加：dolly?.kill(); dolly = null
```

- [ ] **Step 2:** 手动验证：入场页淡出 → 相机推进与星星绽放同步；滚轮可随时打断。
- [ ] **Step 3: Commit** `feat: cinematic camera dolly-in on first entry`

### Task 11: 相机飞向选中星 + 卡片投影定位 + 视口夹取

**Files:**
- Create: `components/StarMap/cameraFly.ts`、`lib/ui/viewport.ts`
- Modify: `components/StarMap/StarMap.tsx`
- Test: `lib/ui/viewport.test.ts`

- [ ] **Step 1: 写 clamp 失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { clampToViewport } from './viewport'

describe('clampToViewport', () => {
  it('视口内的位置原样返回', () => {
    expect(clampToViewport(100, 100, 260, 300, 1200, 800)).toEqual({ x: 100, y: 100 })
  })
  it('超出右/下边缘时收回到边距内', () => {
    expect(clampToViewport(1100, 700, 260, 300, 1200, 800)).toEqual({ x: 1200 - 260 - 12, y: 800 - 300 - 12 })
  })
  it('负坐标收回到边距', () => {
    expect(clampToViewport(-50, -50, 260, 300, 1200, 800)).toEqual({ x: 12, y: 12 })
  })
})
```

- [ ] **Step 2:** 运行确认失败，然后实现：

```ts
// lib/ui/viewport.ts
export function clampToViewport(
  x: number, y: number, w: number, h: number,
  vw: number, vh: number, margin = 12,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, margin), Math.max(margin, vw - w - margin)),
    y: Math.min(Math.max(y, margin), Math.max(margin, vh - h - margin)),
  }
}
```

- [ ] **Step 3: 实现 cameraFly**

```ts
// components/StarMap/cameraFly.ts
import * as THREE from 'three'
import { gsap } from 'gsap'

/** 补间 pivot 旋转使目标星转到镜头正前方，同时拉近相机。返回取消函数。 */
export function flyToStar(
  pivot: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  localPos: THREE.Vector3,
  onArrive: () => void,
): () => void {
  const dist = localPos.length()
  const from = pivot.quaternion.clone()
  const to = dist < 0.001
    ? from.clone() // 星在原点：无从对准方向，只拉近
    : new THREE.Quaternion().setFromUnitVectors(
        localPos.clone().normalize(), new THREE.Vector3(0, 0, 1))
  const state = { t: 0, z: camera.position.z }
  const targetZ = Math.max(dist + 3.5, 6)
  const tween = gsap.to(state, {
    t: 1, z: targetZ, duration: 1.4, ease: 'power2.inOut',
    onUpdate() {
      pivot.quaternion.slerpQuaternions(from, to, state.t)
      camera.position.z = state.z
    },
    onComplete: onArrive,
  })
  return () => tween.kill()
}

/** 对象世界坐标 → 屏幕像素坐标 */
export function worldToScreen(
  obj: THREE.Object3D, camera: THREE.Camera, vw: number, vh: number,
): { x: number; y: number } {
  const v = new THREE.Vector3()
  obj.getWorldPosition(v)
  v.project(camera)
  return { x: (v.x + 1) / 2 * vw, y: (1 - v.y) / 2 * vh }
}
```

- [ ] **Step 4: StarMap 接线**——`selectedFriendId` effect 改为飞行（替换现在写死屏幕中央的实现）：

```tsx
const CARD_W = 260, CARD_H = 300
const cancelFlyRef = useRef<(() => void) | null>(null)

useEffect(() => {
  if (!selectedFriendId || !sceneRef.current) return
  const friend = friendsRef.current.find(f => f.id === selectedFriendId)
  const star = starsRef.current.find(s => s.friendId === selectedFriendId)
  if (!friend || !star) return
  const { camera, pivot } = sceneRef.current
  cancelFlyRef.current?.()
  highlightLines(linesRef.current, friend.id)
  cancelFlyRef.current = flyToStar(pivot, camera,
    new THREE.Vector3(...friend.starConfig.position), () => {
      pinnedFriendIdRef.current = friend.id
      setPinnedFriend(friend)
      const p = worldToScreen(star.root, camera, window.innerWidth, window.innerHeight)
      setPinnedPos(clampToViewport(p.x + 22, p.y - 12, CARD_W, CARD_H,
        window.innerWidth, window.innerHeight))
    })
}, [selectedFriendId])

// onPointerDown 开头：cancelFlyRef.current?.(); cancelFlyRef.current = null
// hover 与 tap 的卡片定位统一走 clampToViewport(x + 22, y - 12, CARD_W, CARD_H, ...)
// 卸载清理里：cancelFlyRef.current?.()
```

- [ ] **Step 5:** `npm test` + `npm run build`
- [ ] **Step 6:** 手动验收（桌面 + 移动视口）：入场 → 空状态 → 添加朋友 → 今日星象点选飞行 → 卡片贴星出现、边缘不溢出 → 拖拽可打断飞行 → 编辑返回无慢动画重播。
- [ ] **Step 7: Commit** `feat: camera fly-to on friend selection with projected card position`

---

## Self-review 记录

- Spec 覆盖：批次一 Task 1–4、批次二 Task 5–8、批次三 Task 9–11，spec 各节均有对应任务；"不做的事"未混入。
- 类型一致：`buildStar(friend, appearDelay)`、`flyToStar(pivot, camera, localPos, onArrive)`、`clampToViewport(x,y,w,h,vw,vh,margin?)` 各任务引用一致。
- 无占位符。
