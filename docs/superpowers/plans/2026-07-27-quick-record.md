# 快速记录(第二期)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 记录一条互动只需打一句话——AI 自动提取标题/标签/情绪/发起人,日期时间自动取当下;好友页表单瘦身 + 全局 `Ctrl+J`「记一笔」浮层。

**Architecture:** 纯函数与 fetch 封装集中在新模块 `lib/quickMemory.ts`;新 API 路由 `api/ai/extract-memory` 复用现有 AI 层(`generateWithAI`/`safeParseAIJson`/`isAuthorized`);`MemoryTimeline` 新记录路径改为 textarea+AI,编辑路径保留完整表单;新组件 `QuickNoteOverlay` 复用第一期 `friendSearch` 选人,受控模式与快捷键守卫完全沿用 `SearchOverlay` 的既定模式(捕获阶段、IME、preventDefault)。

**Tech Stack:** Next.js 16 App Router、React 19、Vitest + Testing Library、OpenAI 兼容上游(`lib/ai/provider`)。

**注意:** AGENTS.md 要求写代码前查 `node_modules/next/dist/docs/`。本计划只用库中已在用的 API(`'use client'`、`NextRequest/NextResponse` 路由、`next/link`);遇到行为差异先查 `node_modules/next/dist/docs/01-app/`。

Spec: `docs/superpowers/specs/2026-07-27-quick-record-design.md`

---

### Task 1: `Memory.time` 字段 + `lib/quickMemory.ts` 纯函数

**Files:**
- Modify: `lib/types.ts`(Memory 接口)
- Create: `lib/quickMemory.ts`
- Test: `lib/quickMemory.test.ts`

- [ ] **Step 1: types.ts 加字段**

在 `lib/types.ts` 的 `Memory` 接口中,`date` 行之后加一行:

```ts
  time?: string        // HH:mm,记录时刻;新记录自动生成,旧数据无此字段
```

- [ ] **Step 2: 写失败测试**

创建 `lib/quickMemory.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fallbackTitle, buildQuickMemory, sortMemoriesDesc } from './quickMemory'
import type { Memory } from './types'

function mem(date: string, time?: string): Memory {
  return { id: `m-${date}-${time ?? ''}`, date, time, title: 't', content: '', tags: [], media: [] }
}

describe('fallbackTitle', () => {
  it('取首个句读前的内容', () => {
    expect(fallbackTitle('一起吃了火锅。她说下次去爬山')).toBe('一起吃了火锅')
  })
  it('支持问号感叹号换行截断', () => {
    expect(fallbackTitle('她今天怎么了?好奇怪')).toBe('她今天怎么了')
    expect(fallbackTitle('太开心了!下次再约')).toBe('太开心了')
    expect(fallbackTitle('第一行\n第二行')).toBe('第一行')
  })
  it('超长截 12 字', () => {
    expect(fallbackTitle('今天下午我们在公园里散步聊了很多以前的事情')).toBe('今天下午我们在公园里散步')
  })
  it('全空白返回随手一记', () => {
    expect(fallbackTitle('   ')).toBe('随手一记')
  })
})

describe('buildQuickMemory', () => {
  const now = new Date(2026, 6, 27, 9, 5) // 2026-07-27 09:05
  it('date/time 取 now,content 恒为原文', () => {
    const m = buildQuickMemory('随便记一句', null, now)
    expect(m.date).toBe('2026-07-27')
    expect(m.time).toBe('09:05')
    expect(m.content).toBe('随便记一句')
    expect(m.media).toEqual([])
  })
  it('无提取结果时降级:标题取首句,无标签无情绪', () => {
    const m = buildQuickMemory('一起吃了火锅。很开心', null, now)
    expect(m.title).toBe('一起吃了火锅')
    expect(m.tags).toEqual([])
    expect(m.valence).toBeUndefined()
    expect(m.initiator).toBeUndefined()
  })
  it('有提取结果时使用提取字段', () => {
    const m = buildQuickMemory('她约我爬山,聊得很开心', {
      title: '一起爬山', tags: ['爬山'], valence: 'positive', initiator: 'friend',
    }, now)
    expect(m.title).toBe('一起爬山')
    expect(m.tags).toEqual(['爬山'])
    expect(m.valence).toBe('positive')
    expect(m.initiator).toBe('friend')
  })
})

describe('sortMemoriesDesc', () => {
  it('按日期降序,同日按时间降序,无 time 视为 00:00', () => {
    const list = [mem('2026-07-01'), mem('2026-07-27', '09:00'), mem('2026-07-27', '18:30'), mem('2026-07-27')]
    const sorted = sortMemoriesDesc(list)
    expect(sorted.map(m => `${m.date} ${m.time ?? '-'}`)).toEqual([
      '2026-07-27 18:30', '2026-07-27 09:00', '2026-07-27 -', '2026-07-01 -',
    ])
  })
  it('不修改原数组', () => {
    const list = [mem('2026-07-01'), mem('2026-07-27')]
    sortMemoriesDesc(list)
    expect(list[0].date).toBe('2026-07-01')
  })
})
```

- [ ] **Step 3: 运行确认失败**

Run: `npx vitest run lib/quickMemory.test.ts`
Expected: FAIL — 找不到模块 `./quickMemory`

- [ ] **Step 4: 实现**

创建 `lib/quickMemory.ts`:

```ts
import type { Memory, MemoryValence, MemoryInitiator } from './types'

export interface ExtractResult {
  title: string
  tags: string[]
  valence?: MemoryValence
  initiator?: MemoryInitiator
}

// 无 AI 时的降级标题:首个句读前的内容截 12 字
export function fallbackTitle(text: string): string {
  const first = text.trim().split(/[。!?！？\n]/)[0] ?? ''
  return first.trim().slice(0, 12) || '随手一记'
}

export function buildQuickMemory(text: string, extract: ExtractResult | null, now: Date): Memory {
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    id: crypto.randomUUID(),
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    title: extract?.title || fallbackTitle(text),
    content: text,
    tags: extract?.tags ?? [],
    media: [],
    valence: extract?.valence,
    initiator: extract?.initiator,
  }
}

export function sortMemoriesDesc(memories: Memory[]): Memory[] {
  return [...memories].sort((a, b) =>
    b.date.localeCompare(a.date) || (b.time ?? '00:00').localeCompare(a.time ?? '00:00'))
}
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run lib/quickMemory.test.ts`
Expected: PASS(9 个用例)

再跑 `npx vitest run` 全套确认无回归(`time` 为可选字段,现有代码不受影响)。

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/quickMemory.ts lib/quickMemory.test.ts
git commit -m "feat: add Memory.time and quick-memory pure helpers"
```

---

### Task 2: 提取 Prompt + `api/ai/extract-memory` 路由

**Files:**
- Modify: `lib/ai/prompts.ts`(末尾追加)、`lib/ai/prompts.test.ts`(追加用例)、`lib/ai/tokenEstimate.ts`(OUTPUT_LIMITS)
- Create: `app/api/ai/extract-memory/route.ts`
- Test: `app/api/ai/extract-memory/route.test.ts`

- [ ] **Step 1: 写失败测试**

在 `lib/ai/prompts.test.ts` 末尾追加(import 行同步加入 `buildExtractMemoryPrompt`):

```ts
describe('buildExtractMemoryPrompt', () => {
  it('包含原文、好友名与保守推断规则', () => {
    const prompt = buildExtractMemoryPrompt({ text: '一起吃了火锅', friendName: '阿明' })
    expect(prompt).toContain('一起吃了火锅')
    expect(prompt).toContain('阿明')
    expect(prompt).toContain('宁可省略')
    expect(prompt).toContain('title')
  })
})
```

创建 `app/api/ai/extract-memory/route.test.ts`(模式仿 `app/api/ai/ask-atlas/route.test.ts`):

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/verifyRequest', () => ({ isAuthorized: vi.fn() }))
vi.mock('@/lib/ai/provider', () => ({ MODEL: 'test-model', generateWithAI: vi.fn() }))

import { POST } from './route'
import { isAuthorized } from '@/lib/auth/verifyRequest'
import { generateWithAI } from '@/lib/ai/provider'

function post(body: unknown) {
  return new NextRequest(new URL('/api/ai/extract-memory', 'https://youji.test'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => { vi.mocked(isAuthorized).mockReset(); vi.mocked(generateWithAI).mockReset() })

describe('POST /api/ai/extract-memory', () => {
  it('未授权返回 401 且不调用 AI', async () => {
    vi.mocked(isAuthorized).mockResolvedValue(false)
    const res = await POST(post({ text: 'x', friendName: 'y' }))
    expect(res.status).toBe(401)
    expect(generateWithAI).not.toHaveBeenCalled()
  })

  it('缺参数返回 400', async () => {
    vi.mocked(isAuthorized).mockResolvedValue(true)
    const res = await POST(post({ text: '  ', friendName: 'y' }))
    expect(res.status).toBe(400)
  })

  it('成功提取并过滤非法枚举值', async () => {
    vi.mocked(isAuthorized).mockResolvedValue(true)
    vi.mocked(generateWithAI).mockResolvedValue(JSON.stringify({
      title: '一起爬山', tags: ['爬山', '', '公园', '多余1', '多余2'], valence: 'positive', initiator: 'alien',
    }))
    const res = await POST(post({ text: '她约我爬山', friendName: '阿明' }))
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.title).toBe('一起爬山')
    expect(data.tags).toEqual(['爬山', '公园', '多余1'])
    expect(data.valence).toBe('positive')
    expect(data.initiator).toBeUndefined()
  })

  it('AI 抛错返回 ok:false 且状态 200', async () => {
    vi.mocked(isAuthorized).mockResolvedValue(true)
    vi.mocked(generateWithAI).mockRejectedValue(new Error('down'))
    const res = await POST(post({ text: 'x', friendName: 'y' }))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(false)
  })

  it('AI 返回缺 title 的 JSON 时 ok:false', async () => {
    vi.mocked(isAuthorized).mockResolvedValue(true)
    vi.mocked(generateWithAI).mockResolvedValue('{"tags":["x"]}')
    expect((await (await POST(post({ text: 'x', friendName: 'y' }))).json()).ok).toBe(false)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run app/api/ai/extract-memory/route.test.ts lib/ai/prompts.test.ts`
Expected: FAIL — 找不到 `./route` 模块 / `buildExtractMemoryPrompt` 未导出

- [ ] **Step 3: 实现**

`lib/ai/tokenEstimate.ts` 的 `OUTPUT_LIMITS` 增加一项:

```ts
  extract: 200,
```

`lib/ai/prompts.ts` 末尾追加:

```ts
export function buildExtractMemoryPrompt(input: { text: string; friendName: string }): string {
  return `你是好友记录助手。用户随手记了一条与好友「${input.friendName}」的互动,请提取结构化信息。

记录原文:
${input.text}

只输出 JSON,不要任何其他文字,格式:
{"title":"...","tags":["..."],"valence":"...","initiator":"..."}

规则:
- title:12 字以内的中文短语,概括这次互动的事件本身,不含日期与好友名字。
- tags:0-3 个中文短词(如 火锅、爬山、工作),没有合适的就给空数组。
- valence:这次互动的情绪效价,positive/neutral/negative;只有原文能明确判断时才输出该字段。
- initiator:发起方,me(用户主动)/friend(好友主动)/both(共同或自然发生);只有原文明确时才输出。
- valence 与 initiator 宁可省略,不要猜。`
}
```

创建 `app/api/ai/extract-memory/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { MODEL, generateWithAI } from '@/lib/ai/provider'
import { buildExtractMemoryPrompt } from '@/lib/ai/prompts'
import { safeParseAIJson } from '@/lib/ai/json'
import { OUTPUT_LIMITS } from '@/lib/ai/tokenEstimate'
import { isAuthorized } from '@/lib/auth/verifyRequest'

interface ExtractAIOutput { title?: string; tags?: unknown; valence?: string; initiator?: string }

const VALENCES = new Set(['positive', 'neutral', 'negative'])
const INITIATORS = new Set(['me', 'friend', 'both'])

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ ok: false, error: '未登录，请先登录。' }, { status: 401 })
  }

  let text: unknown, friendName: unknown
  try {
    const body = await req.json()
    text = body.text
    friendName = body.friendName
  } catch {
    return NextResponse.json({ ok: false, error: '请求格式不正确。' }, { status: 400 })
  }
  if (typeof text !== 'string' || !text.trim() || typeof friendName !== 'string') {
    return NextResponse.json({ ok: false, error: '请求参数不完整。' }, { status: 400 })
  }

  // 提取失败一律 ok:false + 200:客户端统一走降级,不区分失败原因
  let raw: string
  try {
    raw = await generateWithAI(buildExtractMemoryPrompt({ text, friendName }), {
      model: MODEL, maxOutputTokens: OUTPUT_LIMITS.extract,
    })
  } catch {
    return NextResponse.json({ ok: false })
  }

  const parsed = safeParseAIJson<ExtractAIOutput>(raw)
  const d = parsed.data
  if (!parsed.ok || !d || typeof d.title !== 'string' || !d.title.trim()) {
    return NextResponse.json({ ok: false })
  }

  return NextResponse.json({
    ok: true,
    title: d.title.trim().slice(0, 20),
    tags: Array.isArray(d.tags)
      ? d.tags.filter((t): t is string => typeof t === 'string' && !!t.trim()).slice(0, 3)
      : [],
    valence: d.valence && VALENCES.has(d.valence) ? d.valence : undefined,
    initiator: d.initiator && INITIATORS.has(d.initiator) ? d.initiator : undefined,
  })
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run app/api/ai/extract-memory/route.test.ts lib/ai/prompts.test.ts lib/ai/tokenEstimate.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/ai/prompts.ts lib/ai/prompts.test.ts lib/ai/tokenEstimate.ts app/api/ai/extract-memory/
git commit -m "feat: add extract-memory AI route"
```

---

### Task 3: `extractMemory` 客户端封装

**Files:**
- Modify: `lib/quickMemory.ts`(追加)、`lib/quickMemory.test.ts`(追加)

- [ ] **Step 1: 写失败测试**

在 `lib/quickMemory.test.ts` 追加(顶部 import 增加 `extractMemory` 与 `vi`, `afterEach`):

```ts
describe('extractMemory', () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubFetch(response: unknown) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(response) }))
  }

  it('成功时返回清洗后的结果', async () => {
    stubFetch({ ok: true, title: '一起爬山', tags: ['爬山'], valence: 'positive' })
    const r = await extractMemory('她约我爬山', '阿明')
    expect(r).toEqual({ title: '一起爬山', tags: ['爬山'], valence: 'positive', initiator: undefined })
  })

  it('ok:false 时返回 null', async () => {
    stubFetch({ ok: false })
    expect(await extractMemory('x', 'y')).toBeNull()
  })

  it('响应缺字段时返回 null', async () => {
    stubFetch({ ok: true, tags: [] })
    expect(await extractMemory('x', 'y')).toBeNull()
  })

  it('fetch 抛错时返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await extractMemory('x', 'y')).toBeNull()
  })

  it('携带 text 与 friendName 调用提取接口', async () => {
    stubFetch({ ok: true, title: 't', tags: [] })
    await extractMemory('内容', '阿明')
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/ai/extract-memory')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ text: '内容', friendName: '阿明' })
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/quickMemory.test.ts`
Expected: FAIL — `extractMemory` 未导出

- [ ] **Step 3: 实现**

在 `lib/quickMemory.ts` 追加:

```ts
// 调 AI 提取路由;任何失败(网络/超时/ok:false/字段缺失)返回 null,由调用方走降级
export async function extractMemory(text: string, friendName: string): Promise<ExtractResult | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch('/api/ai/extract-memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, friendName }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    const data = await res.json()
    if (!data.ok || typeof data.title !== 'string' || !Array.isArray(data.tags)) return null
    return { title: data.title, tags: data.tags, valence: data.valence, initiator: data.initiator }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/quickMemory.test.ts`
Expected: PASS(14 个用例)

- [ ] **Step 5: Commit**

```bash
git add lib/quickMemory.ts lib/quickMemory.test.ts
git commit -m "feat: add extractMemory client wrapper with silent fallback"
```

---

### Task 4: MemoryTimeline 瘦身(textarea 快记 + 编辑表单加 time)

**Files:**
- Modify: `components/MemoryTimeline.tsx`
- Modify: `components/MemoryTimeline.test.tsx`(先读现有用例,保留仍适用的展示/编辑/删除用例,替换新增流程用例)
- Modify: `app/friend/[friendId]/page.tsx`(传 `friendName` prop,一行)

- [ ] **Step 1: 写失败测试**

在 `components/MemoryTimeline.test.tsx` 中:mock `@/lib/quickMemory`(保留真实 `sortMemoriesDesc`/`buildQuickMemory`,仅 mock `extractMemory`):

```tsx
vi.mock('@/lib/quickMemory', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/quickMemory')>()),
  extractMemory: vi.fn(),
}))
```

新增/替换以下用例(组件渲染需传新 prop `friendName="阿明"`;原有用例的 render 调用同步补上该 prop):

```tsx
it('快速记录:只有 textarea,保存后按提取结果落库', async () => {
  vi.mocked(extractMemory).mockResolvedValue({ title: '一起爬山', tags: ['爬山'], valence: 'positive', initiator: 'friend' })
  const onChange = vi.fn()
  render(<MemoryTimeline friendId="f1" friendName="阿明" memories={[]} onChange={onChange} />)
  fireEvent.click(screen.getByText('+ 记录一颗星尘'))
  expect(screen.queryByPlaceholderText('标题')).not.toBeInTheDocument()
  expect(screen.queryByText(/这次互动感觉/)).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '她约我爬山,聊得很开心' } })
  fireEvent.click(screen.getByText('保存'))
  await waitFor(() => expect(onChange).toHaveBeenCalled())
  const saved = onChange.mock.calls[0][0][0]
  expect(saved.title).toBe('一起爬山')
  expect(saved.tags).toEqual(['爬山'])
  expect(saved.time).toMatch(/^\d{2}:\d{2}$/)
  expect(saved.content).toBe('她约我爬山,聊得很开心')
})

it('AI 失败时降级保存(标题取首句)', async () => {
  vi.mocked(extractMemory).mockResolvedValue(null)
  const onChange = vi.fn()
  render(<MemoryTimeline friendId="f1" friendName="阿明" memories={[]} onChange={onChange} />)
  fireEvent.click(screen.getByText('+ 记录一颗星尘'))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '一起吃了火锅。很开心' } })
  fireEvent.click(screen.getByText('保存'))
  await waitFor(() => expect(onChange).toHaveBeenCalled())
  expect(onChange.mock.calls[0][0][0].title).toBe('一起吃了火锅')
})

it('内容为空时保存按钮禁用', () => {
  render(<MemoryTimeline friendId="f1" friendName="阿明" memories={[]} onChange={vi.fn()} />)
  fireEvent.click(screen.getByText('+ 记录一颗星尘'))
  expect(screen.getByText('保存')).toBeDisabled()
})

it('时间线显示 time,旧数据无 time 正常渲染', () => {
  const memories = [
    { id: 'm1', date: '2026-07-27', time: '09:05', title: '新的', content: '', tags: [], media: [] },
    { id: 'm2', date: '2026-07-01', title: '旧的', content: '', tags: [], media: [] },
  ]
  render(<MemoryTimeline friendId="f1" friendName="阿明" memories={memories} onChange={vi.fn()} />)
  expect(screen.getByText(/09:05/)).toBeInTheDocument()
  expect(screen.getByText('旧的')).toBeInTheDocument()
})

it('编辑表单包含 time 输入且保存保留', async () => {
  const memories = [{ id: 'm1', date: '2026-07-27', time: '09:05', title: 't', content: '', tags: [], media: [] }]
  const onChange = vi.fn()
  render(<MemoryTimeline friendId="f1" friendName="阿明" memories={memories} onChange={onChange} />)
  fireEvent.click(screen.getByText('编辑'))
  const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement
  expect(timeInput.value).toBe('09:05')
  fireEvent.change(timeInput, { target: { value: '10:30' } })
  fireEvent.click(screen.getAllByText('保存')[0])
  expect(onChange.mock.calls[0][0][0].time).toBe('10:30')
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run components/MemoryTimeline.test.tsx`
Expected: FAIL

- [ ] **Step 3: 实现**

对 `components/MemoryTimeline.tsx` 做如下修改:

1. Props 与 import:

```tsx
import { extractMemory, buildQuickMemory, sortMemoriesDesc } from '@/lib/quickMemory'

interface Props { friendId: string; friendName: string; memories: Memory[]; onChange: (m: Memory[]) => void }
```

2. `Draft` 类型加 `time`(编辑用):`type Draft = Omit<Partial<Memory>, 'tags'> & { tags?: string }` 已含 time(Partial<Memory>),无需改;`startEdit` 增加 `time: m.time`,`saveEdit` 的更新对象增加 `time: editDraft.time`。

3. 新记录状态与逻辑(替换原 `draft`/`saveMemory`):

```tsx
const QUICK_HINTS = [
  '发生了什么?随手一记,AI 会整理好标题、标签和心情',
  'TA 今天说了什么让你在意的话?',
  '记下 TA 的原话和具体反应,比『他人很好』更有用',
]
const [quickText, setQuickText] = useState('')
const [saving, setSaving] = useState(false)
const [hintIndex, setHintIndex] = useState(0)

async function saveQuick() {
  const text = quickText.trim()
  if (!text || saving) return
  setSaving(true)
  const extract = await extractMemory(text, friendName)
  onChange(sortMemoriesDesc([...memories, buildQuickMemory(text, extract, new Date())]))
  setQuickText(''); setSaving(false); setAdding(false)
}
```

「+ 记录一颗星尘」按钮 onClick 改为 `() => { setAdding(true); setHintIndex(i => (i + 1) % QUICK_HINTS.length) }`。

4. `adding` 分支整体替换为:

```tsx
{adding && (
  <div style={{ background: surface.raise, border:`1px solid ${border.goldFaint}`,
    borderRadius: radius.md, padding:16, marginBottom:16, display:'flex', flexDirection:'column', gap:10 }}>
    <textarea placeholder={QUICK_HINTS[hintIndex]} rows={3} value={quickText}
      onChange={e=>setQuickText(e.target.value)} style={{...inp,resize:'vertical'}}/>
    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
      <button type="button" onClick={saveQuick} disabled={!quickText.trim() || saving}
        style={{...inp,width:'auto',cursor: saving?'wait':'pointer',color: gold.base,
          opacity: !quickText.trim()||saving ? 0.6 : 1}}>
        {saving ? 'AI 整理中…' : '保存'}
      </button>
      <span style={{ color: purple.muted, fontSize: fs.meta }}>日期时间自动记录,标题标签交给 AI</span>
    </div>
  </div>
)}
```

5. 排序统一走 `sortMemoriesDesc`:`saveEdit` 里的 `.sort((a,b)=>b.date.localeCompare(a.date))` 改为 `sortMemoriesDesc(updated)`。

6. 展示行日期改为:`{m.date}{m.time ? ` ${m.time}` : ''}`(情绪 emoji 展示保留——去掉的是选择,不是展示)。

7. 编辑表单在日期输入后加:`<input type="time" value={editDraft.time??''} onChange={e=>setEditDraft({...editDraft,time:e.target.value})} style={inp}/>`。

8. `app/friend/[friendId]/page.tsx` 中 `<MemoryTimeline` 处补 `friendName={friend.name}`。

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run components/MemoryTimeline.test.tsx` 然后 `npx vitest run`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add components/MemoryTimeline.tsx components/MemoryTimeline.test.tsx "app/friend/[friendId]/page.tsx"
git commit -m "feat: one-line quick memory with AI extraction in timeline"
```

---

### Task 5: `QuickNoteOverlay` 组件

**Files:**
- Create: `components/QuickNoteOverlay.tsx`
- Test: `components/QuickNoteOverlay.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `components/QuickNoteOverlay.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import QuickNoteOverlay from './QuickNoteOverlay'
import { useIsMobile } from '@/lib/useIsMobile'
import { extractMemory } from '@/lib/quickMemory'
import { getFriends } from '@/lib/store'
import type { Friend } from '@/lib/types'

vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ pushFriend: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/quickMemory', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/quickMemory')>()),
  extractMemory: vi.fn(),
}))

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
const friends = [baseFriend({ id:'a', name:'阿明' }), baseFriend({ id:'b', name:'小红' })]

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('yj_friends', JSON.stringify(friends))
  vi.mocked(useIsMobile).mockReturnValue(false)
  vi.mocked(extractMemory).mockResolvedValue(null)
})

function setup(props: Partial<ComponentProps<typeof QuickNoteOverlay>> = {}) {
  const onOpenChange = vi.fn()
  const onSaved = vi.fn()
  render(<QuickNoteOverlay friends={friends} open onOpenChange={onOpenChange} onSaved={onSaved} {...props} />)
  return { onOpenChange, onSaved }
}

describe('QuickNoteOverlay', () => {
  it('open=false 不渲染', () => {
    setup({ open: false })
    expect(screen.queryByText(/记一笔/)).not.toBeInTheDocument()
  })

  it('第一步选人:点好友进入记录步', () => {
    setup()
    fireEvent.click(screen.getByText('阿明'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByText(/阿明/)).toBeInTheDocument()
  })

  it('defaultFriendId 直达记录步,可换人返回', () => {
    setup({ defaultFriendId: 'b' })
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    fireEvent.click(screen.getByText('换人'))
    expect(screen.getByText('阿明')).toBeInTheDocument()
  })

  it('保存走降级并回调 onSaved,localStorage 落库', async () => {
    const { onSaved } = setup({ defaultFriendId: 'a' })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '一起吃了火锅。很开心' } })
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('a'))
    const stored = getFriends().find(f => f.id === 'a')!
    expect(stored.memories).toHaveLength(1)
    expect(stored.memories[0].title).toBe('一起吃了火锅')
    expect(screen.getByText(/已记入/)).toBeInTheDocument()
  })

  it('空内容保存按钮禁用', () => {
    setup({ defaultFriendId: 'a' })
    expect(screen.getByText('保存')).toBeDisabled()
  })

  it('Esc 关闭并 preventDefault', () => {
    const { onOpenChange } = setup()
    const notPrevented = fireEvent.keyDown(window, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(notPrevented).toBe(false)
  })

  it('关闭状态 Ctrl+J 打开;输入框聚焦时不劫持', () => {
    const { onOpenChange } = setup({ open: false })
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true })
    expect(onOpenChange).toHaveBeenCalledWith(true)
    onOpenChange.mockClear()
    render(<input data-testid="outside" />)
    fireEvent.keyDown(screen.getByTestId('outside'), { key: 'j', ctrlKey: true })
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('IME 组词中的按键不处理', () => {
    const { onOpenChange } = setup({ open: false })
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true, isComposing: true })
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('无好友显示空宇宙提示', () => {
    setup({ friends: [] })
    expect(screen.getByText(/宇宙还空着/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run components/QuickNoteOverlay.test.tsx`
Expected: FAIL — 找不到模块 `./QuickNoteOverlay`

- [ ] **Step 3: 实现**

创建 `components/QuickNoteOverlay.tsx`:

```tsx
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
  const isMobile = useIsMobile()

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
    setSaving(false)
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
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run components/QuickNoteOverlay.test.tsx`
Expected: PASS(9 个用例)

- [ ] **Step 5: Commit**

```bash
git add components/QuickNoteOverlay.tsx components/QuickNoteOverlay.test.tsx
git commit -m "feat: add QuickNoteOverlay global quick-record palette"
```

---

### Task 6: 页面接入(首页 + 好友详情页)

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/friend/[friendId]/page.tsx`

- [ ] **Step 1: 首页接入**

`app/page.tsx`:

1. import 增加:`import QuickNoteOverlay from '@/components/QuickNoteOverlay'`
2. 状态增加(searchOpen 之后):`const [noteOpen, setNoteOpen] = useState(false)`
3. 导航按钮组(`⌕ 寻星` 按钮之前)插入同款胶囊按钮:

```tsx
  <button type="button" onClick={() => setNoteOpen(true)} style={{
    color: gold.base, fontSize: fs.meta, letterSpacing:2,
    border:`1px solid ${border.gold}`, borderRadius: radius.pill,
    padding:'10px 18px', background:'none', cursor:'pointer',
    fontFamily:'inherit', pointerEvents:'auto',
  }}>✎ 记一笔</button>
```

4. `entered` 分支内 `SearchOverlay` 之后挂载:

```tsx
<QuickNoteOverlay
  friends={friends}
  open={noteOpen}
  onOpenChange={setNoteOpen}
  onSaved={() => setFriends(getFriends())}
/>
```

(`getFriends` 已在该文件 import。)

- [ ] **Step 2: 好友详情页接入**

`app/friend/[friendId]/page.tsx`:

1. import 增加:`import QuickNoteOverlay from '@/components/QuickNoteOverlay'`
2. 状态增加:`const [noteOpen, setNoteOpen] = useState(false)`
3. 头部行「⌕ 寻星」按钮左侧加同款无边框按钮(包在同一个右侧 flex 组里——把现有寻星按钮包进 `<span style={{ display:'flex', gap:16 }}>`):

```tsx
<span style={{ display:'flex', gap:16 }}>
  <button type="button" onClick={() => setNoteOpen(true)} style={{
    color: gold.muted, fontSize: fs.meta, letterSpacing:2,
    background:'none', border:'none', cursor:'pointer', fontFamily:'inherit',
    padding:0,
  }}>✎ 记一笔</button>
  <button type="button" onClick={() => setSearchOpen(true)} style={{
    color: gold.muted, fontSize: fs.meta, letterSpacing:2,
    background:'none', border:'none', cursor:'pointer', fontFamily:'inherit',
    padding:0,
  }}>⌕ 寻星</button>
</span>
```

4. 主分支 `SearchOverlay` 之后挂载(保存后重读两份状态,当前好友被更新时刷新表单外的时间线):

```tsx
<QuickNoteOverlay
  friends={allFriends}
  open={noteOpen}
  onOpenChange={setNoteOpen}
  defaultFriendId={friend.id}
  onSaved={() => {
    const all = getFriends()
    setAllFriends(all)
    setFriend(all.find(f => f.id === friendId) ?? null)
  }}
/>
```

- [ ] **Step 3: 回归 + 构建**

Run: `npx vitest run` → 全部 PASS;`npm run lint` → 只剩存量问题(OrreryEntry/StarMap/MediaItem);`npm run build` → 成功。

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx "app/friend/[friendId]/page.tsx"
git commit -m "feat: wire QuickNoteOverlay into home and friend pages"
```

---

### Task 7: 端到端验证收尾

- [ ] **Step 1: 全量门禁**

Run: `npx vitest run && npm run lint && npm run build`
Expected: 测试全过;lint 只剩存量问题;构建成功。

- [ ] **Step 2: 真实界面验证(verify 技能)**

按 `.claude/skills/verify/SKILL.md`:构建后 `OPENAI_API_KEY=mock-key OPENAI_BASE_URL=http://127.0.0.1:3199/v1 npx next start -p 3100`,mock AI 返回固定提取 JSON(`{"title":"一起爬山","tags":["爬山"],"valence":"positive","initiator":"friend"}` 包在 chat-completion envelope 里)。驱动:

1. 首页 `Ctrl+J` → 选人 → 打一句话 → 保存 → 「已记入」提示;进好友页确认时间线出现该记录,标题为 AI 提取值,date/time 为当下。
2. 不起 mock AI(或停掉)再记一条 → 降级标题为首句截断,保存不被阻塞。
3. 好友页「✎ 记一笔」→ 直达第二步(当前好友预选)。
4. 好友页时间线「+ 记录一颗星尘」→ 只有 textarea;保存走同样流程。
5. 留存截图。

- [ ] **Step 3: 有问题修复后重跑 Step 1,全绿结束**
