# 图鉴精准度提升（心理学证据链）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 AI 图鉴的分析从"猜文本"升级为"看结构化证据"——给回忆加情绪效价（valence）和发起方（initiator），给好友加关系目标（relationshipGoal），让图鉴主动告诉用户缺什么信息（missingInfoQuestions），并在服务端校验 AI 引用的 evidence 是否真实存在。

**Architecture:** 所有新字段都是可选的（localStorage 里的旧数据无迁移即兼容）。数据流：`Memory/Friend 新字段 → contextBuilder 传入 AI context → prompts 教模型使用 → route 解析/校验输出 → atlas 页面渲染`。置信度模型（atlasConfidence）从纯数量升级为多维结构（新近度/多样性/情绪覆盖/时间跨度）。

**Tech Stack:** Next.js App Router + TypeScript + Vitest（已有 jsdom + @testing-library/react，见 `components/MediaItem.test.tsx`）。测试命令 `npm test`（vitest run），单文件 `npx vitest run <path>`。

**心理学依据（写给执行者的背景，不需要出现在代码里）：**
- Funder 的 Realistic Accuracy Model：判断准确度取决于证据的相关性和多样性 → 引导记录"行为事件"而非形容词。
- Gottman 正负互动比：关系趋势需要正/负效价数据 → `valence` 字段。
- Reis & Shaver 亲密过程模型（感知回应性）：谁发起、如何回应是关系质量核心信号 → `initiator` 字段。
- 主动学习：让模型指出"哪条缺失信息对分析改变最大" → `missingInfoQuestions`。
- 防巴纳姆效应：AI 引用的证据必须真实存在 → 服务端 evidence 校验。

**不在本计划范围内（未来可做）：** TIPI 式大五他评量表、分栏置信度、embedding 记忆检索、用户自身行为记录（"我为 TA 做了什么"）。

---

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `lib/types.ts` | 修改 | 新类型：`MemoryValence`、`MemoryInitiator`、`RelationshipGoal`；`Memory`/`Friend`/`Atlas` 加可选字段 |
| `lib/atlasConfidence.ts` + `.test.ts` | 重写 | 多维置信度模型（数量/新近度/多样性/情绪覆盖/时间跨度） |
| `components/MemoryTimeline.tsx` + 新 `.test.tsx` | 修改 | valence/initiator 点选 UI + 微引导文案 |
| `components/FriendForm.tsx` | 修改 | relationshipGoal 选择器 |
| `lib/store.ts` + `.test.ts` | 修改 | `normalizeFriend` 保留 relationshipGoal（否则读取时被剥掉） |
| `lib/ai/selectMemoriesForAtlas.ts` + `.test.ts` | 修改 | 扩充关键词表 + 负面记忆保底入选 |
| `lib/ai/contextBuilder.ts` + `.test.ts` | 修改 | 新字段透传进 AI context |
| `lib/ai/prompts.ts` + 新 `.test.ts` | 修改 | prompt 规则 + missingInfoQuestions 输出结构 |
| `lib/ai/validateEvidence.ts` + 新 `.test.ts` | 新建 | evidence 服务端校验 |
| `lib/ai/tokenEstimate.ts` | 修改 | atlas 输出 token 上限 2200 → 2600 |
| `app/api/ai/generate-atlas/route.ts` | 修改 | 解析 missingInfoQuestions + 接入 evidence 校验 |
| `app/api/ai/ask-atlas/route.ts` | 修改 | 接入 evidence 校验 |
| `app/atlas/[friendId]/page.tsx` | 修改 | 渲染"补充这些，图鉴会更准"区块 |

任务依赖：Task 1 是一切的前提；Task 2–6 相互独立；Task 7 依赖 Task 1/6；Task 8 独立；Task 9 依赖 Task 7。

---

### Task 1: 类型扩展（Memory.valence/initiator、Friend.relationshipGoal、Atlas.missingInfoQuestions）

**Files:**
- Modify: `lib/types.ts`

纯类型改动，无运行时行为，用 typecheck + 现有测试验证。所有新字段都是**可选的**——localStorage 里的旧数据没有这些字段，必须能原样读出。

- [ ] **Step 1: 在 `lib/types.ts` 顶部（`MediaType` 定义之后）添加新类型**

```ts
export type MemoryValence = 'positive' | 'neutral' | 'negative'
export type MemoryInitiator = 'me' | 'friend' | 'both'
export type RelationshipGoal = 'maintain' | 'deepen' | 'repair'
```

- [ ] **Step 2: 给 `Memory` 接口添加两个可选字段（在 `media: Media[]` 之后）**

```ts
export interface Memory {
  id: string
  date: string        // YYYY-MM-DD
  title: string
  content: string
  tags: string[]
  media: Media[]
  valence?: MemoryValence     // 这次互动的情绪效价
  initiator?: MemoryInitiator // 谁发起的这次互动
}
```

- [ ] **Step 3: 给 `Friend` 接口添加可选字段（在 `notes?: string` 之后）**

```ts
  notes?: string
  relationshipGoal?: RelationshipGoal // 用户对这段关系的期待
```

- [ ] **Step 4: 给 `Atlas` 接口添加可选字段（在 `relationshipTrend: string` 之后）**

```ts
  relationshipTrend: string
  missingInfoQuestions?: string[] // AI 建议用户补充观察的问题

  evidence: AtlasEvidence[]
```

（`missingInfoQuestions` 必须是可选的：localStorage 里已生成的旧图鉴没有这个字段。）

- [ ] **Step 5: 验证 typecheck 和现有测试全部通过**

Run: `npx tsc --noEmit`
Expected: 无错误

Run: `npm test`
Expected: 全部 PASS（纯可选字段不影响任何现有行为）

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add valence/initiator to Memory, relationshipGoal to Friend, missingInfoQuestions to Atlas"
```

---

### Task 2: 置信度模型重构（数量 → 结构）

**Files:**
- Modify: `lib/atlasConfidence.ts`
- Modify: `lib/atlasConfidence.test.ts`（整文件重写）

现状只数条数（≥8 条即 high）。新模型五个维度：**quantity**（≥8 条 + 资料较全）、**recency**（60 天内有记录）、**diversity**（≥3 种不同标签）、**valenceCoverage**（记录里出现 ≥2 种不同效价）、**timeSpan**（记录跨度 ≥90 天）。high 要求 quantity + recency + 其余三项中至少两项。返回值保持 `{ score, level, reason }` 兼容（`contextBuilder.ts:44` 和 `app/atlas/[friendId]/page.tsx:102` 在用），新增 `dimensions`。

注意：函数签名加 `now: Date = new Date()` 注入参数（模式与 `lib/friendEnergy.ts:14-16` 一致），否则 recency 会让测试随日历漂移。

- [ ] **Step 1: 重写测试文件 `lib/atlasConfidence.test.ts` 为以下内容**

```ts
import { describe, it, expect } from 'vitest'
import { calculateAtlasConfidence } from './atlasConfidence'
import type { Friend, Memory } from './types'

function makeFriend(overrides: Partial<Friend>): Friend {
  return {
    id: 'f1', name: 'Test', important: false, likes: [], dislikes: [], hobbies: [],
    portraits: [], memories: [], relationships: [],
    starConfig: { kind: 'nebula', coreColor: '#000', glowColor: '#000', size: 1, twinkleSpeed: 2, position: [0, 0, 0] },
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  }
}

function makeMemory(overrides: Partial<Memory> & { id: string }): Memory {
  return { date: '2026-01-01', title: 't', content: 'c', tags: [], media: [], ...overrides }
}

const NOW = new Date('2026-07-01')

// 8 条记录：跨度 2026-03-01 → 2026-06-20（>90 天），最新一条在 NOW 的 60 天内，
// 3 种标签，含 positive + negative 两种效价 —— 五个维度全满足。
function richMemories(): Memory[] {
  return [
    makeMemory({ id: 'm0', date: '2026-03-01', tags: ['旅行'], valence: 'positive' }),
    makeMemory({ id: 'm1', date: '2026-03-20', tags: ['吃饭'] }),
    makeMemory({ id: 'm2', date: '2026-04-05', tags: ['工作'], valence: 'negative' }),
    makeMemory({ id: 'm3', date: '2026-04-18' }),
    makeMemory({ id: 'm4', date: '2026-05-02' }),
    makeMemory({ id: 'm5', date: '2026-05-20' }),
    makeMemory({ id: 'm6', date: '2026-06-08' }),
    makeMemory({ id: 'm7', date: '2026-06-20' }),
  ]
}

describe('calculateAtlasConfidence', () => {
  it('returns low for a friend with only a name', () => {
    expect(calculateAtlasConfidence(makeFriend({}), NOW).level).toBe('low')
  })

  it('returns medium for a friend with 3+ memories', () => {
    const memories = Array.from({ length: 3 }, (_, i) => makeMemory({ id: `m${i}` }))
    expect(calculateAtlasConfidence(makeFriend({ memories }), NOW).level).toBe('medium')
  })

  it('returns medium for a friend with rich profile fields but few memories', () => {
    const friend = makeFriend({ notes: '很聊得来', likes: ['咖啡'], hobbies: ['爬山'] })
    expect(calculateAtlasConfidence(friend, NOW).level).toBe('medium')
  })

  it('returns high when quantity, recency, diversity, valence coverage and time span are all present', () => {
    const friend = makeFriend({ memories: richMemories(), notes: '很聊得来', likes: ['咖啡'], hobbies: ['爬山'] })
    const result = calculateAtlasConfidence(friend, NOW)
    expect(result.level).toBe('high')
    expect(result.dimensions).toEqual({
      quantity: true, recency: true, diversity: true, valenceCoverage: true, timeSpan: true,
    })
  })

  it('demotes to medium when there is no record in the last 60 days, and says so', () => {
    // 全部日期前移到 2025 年：跨度和多样性仍在，但最新记录距 NOW 超过 60 天
    const stale = richMemories().map(m => ({ ...m, date: m.date.replace('2026', '2025') }))
    const friend = makeFriend({ memories: stale, notes: '很聊得来', likes: ['咖啡'], hobbies: ['爬山'] })
    const result = calculateAtlasConfidence(friend, NOW)
    expect(result.level).toBe('medium')
    expect(result.reason).toContain('最近 60 天')
  })

  it('demotes to medium when memories are many but structurally thin (same day, no tags, no valence)', () => {
    const memories = Array.from({ length: 8 }, (_, i) => makeMemory({ id: `m${i}`, date: '2026-06-20' }))
    const friend = makeFriend({ memories, notes: '很聊得来', likes: ['咖啡'], hobbies: ['爬山'] })
    expect(calculateAtlasConfidence(friend, NOW).level).toBe('medium')
  })

  it('returns medium (not high) for 8+ structurally rich memories but a thin profile', () => {
    expect(calculateAtlasConfidence(makeFriend({ memories: richMemories() }), NOW).level).toBe('medium')
  })
})
```

- [ ] **Step 2: 运行测试，确认新用例失败**

Run: `npx vitest run lib/atlasConfidence.test.ts`
Expected: FAIL —— `dimensions` 不存在 / high 判定不符

- [ ] **Step 3: 重写 `lib/atlasConfidence.ts` 为以下内容**

```ts
import type { Friend } from './types'

export interface ConfidenceDimensions {
  quantity: boolean        // ≥8 条回忆且喜好/备注/爱好齐全
  recency: boolean         // 最近 60 天内有记录
  diversity: boolean       // ≥3 种不同标签
  valenceCoverage: boolean // 记录里出现 ≥2 种不同情绪效价
  timeSpan: boolean        // 记录时间跨度 ≥90 天
}

const DAY_MS = 24 * 60 * 60 * 1000

const GAP_LABELS: [keyof Omit<ConfidenceDimensions, 'quantity'>, string][] = [
  ['recency', '最近 60 天没有新记录'],
  ['diversity', '记录的话题种类还比较少'],
  ['valenceCoverage', '记录的情绪比较单一，可以补充一些不同心情的互动'],
  ['timeSpan', '记录的时间跨度还比较短'],
]

export function calculateAtlasConfidence(friend: Friend, now: Date = new Date()): {
  score: number
  level: 'low' | 'medium' | 'high'
  reason: string
  dimensions: ConfidenceDimensions
} {
  const hasRichProfile =
    (friend.notes?.length ?? 0) > 0 && friend.likes.length > 0 && friend.hobbies.length > 0
  const hasSomeProfile =
    (friend.notes?.length ?? 0) > 0 || friend.likes.length > 0 || friend.hobbies.length > 0

  const dates = friend.memories
    .map(m => new Date(m.date).getTime())
    .filter(t => !Number.isNaN(t))
  const newest = dates.length ? Math.max(...dates) : undefined
  const oldest = dates.length ? Math.min(...dates) : undefined

  const dimensions: ConfidenceDimensions = {
    quantity: friend.memories.length >= 8 && hasRichProfile,
    recency: newest !== undefined
      && now.getTime() - newest >= 0 && now.getTime() - newest <= 60 * DAY_MS,
    diversity: new Set(friend.memories.flatMap(m => m.tags)).size >= 3,
    valenceCoverage: new Set(friend.memories.map(m => m.valence).filter(Boolean)).size >= 2,
    timeSpan: newest !== undefined && oldest !== undefined && newest - oldest >= 90 * DAY_MS,
  }

  const extras = [dimensions.diversity, dimensions.valenceCoverage, dimensions.timeSpan]
    .filter(Boolean).length

  if (dimensions.quantity && dimensions.recency && extras >= 2) {
    return {
      score: 3, level: 'high', dimensions,
      reason: '回忆数量、时间跨度和情绪覆盖都比较完整，图鉴分析会更贴近真实相处情况。',
    }
  }

  if (friend.memories.length >= 3 || hasSomeProfile) {
    const gaps = GAP_LABELS.filter(([key]) => !dimensions[key]).map(([, label]) => label)
    const reason = dimensions.quantity && gaps.length > 0
      ? `已有较多记录，但${gaps.join('；')}，这部分判断会偏保守。`
      : '已有一些回忆和喜好记录，图鉴可以做出较有参考价值的分析。'
    return { score: 2, level: 'medium', reason, dimensions }
  }

  return { score: 1, level: 'low', dimensions, reason: '资料还比较少，图鉴只能给出初步印象。' }
}
```

- [ ] **Step 4: 运行本文件测试和全量测试**

Run: `npx vitest run lib/atlasConfidence.test.ts`
Expected: PASS（7 个用例）

Run: `npm test`
Expected: 全部 PASS。特别关注 `lib/insights.test.ts` 和 `lib/ai/contextBuilder.test.ts`——它们若引用了 confidence 返回值，只多了 `dimensions` 字段，不应破坏；若有依赖旧 reason 文案的断言，按新文案更新。

- [ ] **Step 5: Commit**

```bash
git add lib/atlasConfidence.ts lib/atlasConfidence.test.ts
git commit -m "feat: multi-dimensional atlas confidence (recency/diversity/valence/timespan)"
```

---

### Task 3: MemoryTimeline 记录 valence + initiator（含微引导文案）

**Files:**
- Modify: `components/MemoryTimeline.tsx`
- Create: `components/MemoryTimeline.test.tsx`

`Draft` 类型是 `Omit<Partial<Memory>, 'tags'> & { tags?: string }`，Task 1 之后 `draft.valence`/`draft.initiator` 自动可用，无需改 Draft 定义。

- [ ] **Step 1: 写失败的组件测试 `components/MemoryTimeline.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MemoryTimeline from './MemoryTimeline'
import type { Memory } from '@/lib/types'

vi.mock('./MediaUpload', () => ({ default: () => null }))
vi.mock('./MediaItem', () => ({ default: () => null }))

describe('MemoryTimeline valence/initiator capture', () => {
  it('saves valence and initiator chosen in the add form', () => {
    const onChange = vi.fn()
    render(<MemoryTimeline friendId="f1" memories={[]} onChange={onChange} />)

    fireEvent.click(screen.getByText('+ 记录一颗星尘'))
    fireEvent.change(screen.getByPlaceholderText('日期'), { target: { value: '2026-07-01' } })
    fireEvent.change(screen.getByPlaceholderText('标题'), { target: { value: '一起吃饭' } })
    fireEvent.click(screen.getByText('😣 别扭/不愉快'))
    fireEvent.click(screen.getByText('TA 发起'))
    fireEvent.click(screen.getByText('保存'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const saved: Memory[] = onChange.mock.calls[0][0]
    expect(saved[0]).toMatchObject({ valence: 'negative', initiator: 'friend' })
  })

  it('clicking a selected valence again clears it', () => {
    const onChange = vi.fn()
    render(<MemoryTimeline friendId="f1" memories={[]} onChange={onChange} />)

    fireEvent.click(screen.getByText('+ 记录一颗星尘'))
    fireEvent.change(screen.getByPlaceholderText('日期'), { target: { value: '2026-07-01' } })
    fireEvent.change(screen.getByPlaceholderText('标题'), { target: { value: 't' } })
    const btn = screen.getByText('😊 开心/顺利')
    fireEvent.click(btn)
    fireEvent.click(btn)
    fireEvent.click(screen.getByText('保存'))

    const saved: Memory[] = onChange.mock.calls[0][0]
    expect(saved[0].valence).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run components/MemoryTimeline.test.tsx`
Expected: FAIL —— 找不到 '😣 别扭/不愉快' 等按钮

- [ ] **Step 3: 修改 `components/MemoryTimeline.tsx`**

3a. 更新 import（第 4 行）：

```tsx
import type { Memory, Media, MemoryValence, MemoryInitiator } from '@/lib/types'
```

3b. 在 `type Draft = ...` 行之后、组件定义之前添加常量：

```tsx
const VALENCE_OPTIONS: { value: MemoryValence; label: string }[] = [
  { value: 'positive', label: '😊 开心/顺利' },
  { value: 'neutral',  label: '😐 平常' },
  { value: 'negative', label: '😣 别扭/不愉快' },
]

const INITIATOR_OPTIONS: { value: MemoryInitiator; label: string }[] = [
  { value: 'me',     label: '我发起' },
  { value: 'friend', label: 'TA 发起' },
  { value: 'both',   label: '一起/自然发生' },
]

const VALENCE_EMOJI: Record<MemoryValence, string> = {
  positive: '😊', neutral: '😐', negative: '😣',
}
```

3c. 在组件内 `inp`/`actionBtn` 样式定义旁添加 pill 样式和选择器渲染函数：

```tsx
  const pill = (active: boolean): React.CSSProperties => ({
    padding:'4px 12px', borderRadius:20, cursor:'pointer', fontSize:11,
    border: active ? '1px solid #e2b96f' : '1px solid rgba(226,185,111,0.2)',
    background: active ? 'rgba(226,185,111,0.12)' : 'transparent',
    color: active ? '#e2b96f' : 'rgba(155,142,196,0.7)',
  })

  function valenceInitiatorPicker(d: Draft, set: (next: Draft) => void) {
    return (
      <>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ color:'rgba(155,142,196,0.6)', fontSize:10 }}>这次互动感觉：</span>
          {VALENCE_OPTIONS.map(o => (
            <button key={o.value} type="button" style={pill(d.valence === o.value)}
              onClick={() => set({ ...d, valence: d.valence === o.value ? undefined : o.value })}>
              {o.label}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ color:'rgba(155,142,196,0.6)', fontSize:10 }}>谁发起的：</span>
          {INITIATOR_OPTIONS.map(o => (
            <button key={o.value} type="button" style={pill(d.initiator === o.value)}
              onClick={() => set({ ...d, initiator: d.initiator === o.value ? undefined : o.value })}>
              {o.label}
            </button>
          ))}
        </div>
      </>
    )
  }
```

3d. `saveMemory` 里的 `mem` 对象加两个字段（`media: []` 之后）：

```tsx
      media:   [],
      valence:   draft.valence,
      initiator: draft.initiator,
```

3e. `startEdit` 把已有值带入编辑草稿：

```tsx
  function startEdit(m: Memory) {
    setEditingId(m.id)
    setEditDraft({ date: m.date, title: m.title, content: m.content, tags: m.tags.join(', '),
      valence: m.valence, initiator: m.initiator })
  }
```

3f. `saveEdit` 的映射对象加：

```tsx
      tags:    (editDraft.tags ?? '').split(',').map(t=>t.trim()).filter(Boolean),
      valence:   editDraft.valence,
      initiator: editDraft.initiator,
```

3g. 新增表单（`adding && ...` 块）：textarea 的 placeholder 从 `"描述"` 改为引导性问题，并在 tags input 之后插入选择器和提示行：

```tsx
          <textarea placeholder="发生了什么？TA 当时说了什么、做了什么？" rows={3} value={draft.content??''} onChange={e=>setDraft({...draft,content:e.target.value})} style={{...inp,resize:'vertical'}}/>
          <input placeholder="标签（逗号分隔）" value={draft.tags??''} onChange={e=>setDraft({...draft,tags:e.target.value})} style={inp}/>
          {valenceInitiatorPicker(draft, setDraft)}
          <div style={{ color:'rgba(155,142,196,0.5)', fontSize:10, lineHeight:1.6 }}>
            小提示：记下 TA 的原话和具体反应，比“他人很好”更能帮图鉴读懂这段关系。
          </div>
          <button type="button" onClick={saveMemory} style={{...inp,width:'auto',cursor:'pointer',color:'#e2b96f'}}>保存</button>
```

3h. 编辑表单（`editingId === m.id` 块）：同样在 tags input 之后、按钮行之前插入：

```tsx
              {valenceInitiatorPicker(editDraft, setEditDraft)}
```

3i. 列表展示：日期行加 valence 表情（替换原 `<div style={{ color:'rgba(226,185,111,0.5)', fontSize:10 }}>{m.date}</div>`）：

```tsx
                <div style={{ color:'rgba(226,185,111,0.5)', fontSize:10 }}>
                  {m.date}{m.valence && <span style={{ marginLeft:6 }}>{VALENCE_EMOJI[m.valence]}</span>}
                </div>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run components/MemoryTimeline.test.tsx`
Expected: PASS（2 个用例）

Run: `npm test`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add components/MemoryTimeline.tsx components/MemoryTimeline.test.tsx
git commit -m "feat: capture memory valence and initiator with guided prompts"
```

---

### Task 4: FriendForm 关系目标选择器 + store 持久化

**Files:**
- Modify: `lib/store.ts:12-33`（`normalizeFriend`）
- Modify: `lib/store.test.ts`
- Modify: `components/FriendForm.tsx`

**关键陷阱：** `normalizeFriend` 逐字段枚举重建 Friend 对象——不加 `relationshipGoal` 的话，字段会在每次 `getFriends()` 读取时被静默剥掉。先写测试暴露这个问题。

- [ ] **Step 1: 在 `lib/store.test.ts` 末尾追加测试（复用该文件已有的 import；若已有 makeFriend 类工具则用它，下面的内联对象是无工具时的写法）**

```ts
describe('relationshipGoal persistence', () => {
  it('preserves relationshipGoal through saveFriend/getFriends round-trip', () => {
    localStorage.clear()
    const friend: Friend = {
      id: 'goal-test', name: '目标测试', important: false,
      likes: [], dislikes: [], hobbies: [], portraits: [], memories: [], relationships: [],
      relationshipGoal: 'deepen',
      starConfig: { kind: 'nebula', coreColor: '#000', glowColor: '#000', size: 1, twinkleSpeed: 2, position: [0, 0, 0] },
      createdAt: '2026-01-01', updatedAt: '2026-01-01',
    }
    saveFriend(friend)
    expect(getFriends().find(f => f.id === 'goal-test')?.relationshipGoal).toBe('deepen')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/store.test.ts`
Expected: FAIL —— `relationshipGoal` 为 `undefined`（被 normalizeFriend 剥掉）

- [ ] **Step 3: `lib/store.ts` 的 `normalizeFriend` 里 `notes: friend.notes,` 之后加一行**

```ts
    notes: friend.notes,
    relationshipGoal: friend.relationshipGoal,
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/store.test.ts`
Expected: PASS

- [ ] **Step 5: 修改 `components/FriendForm.tsx`**

5a. import 加类型（第 3 行）：

```tsx
import type { Friend, Relationship, RelationshipGoal } from '@/lib/types'
```

5b. `MBTI_OPTIONS` 常量之后添加：

```tsx
const GOAL_OPTIONS: { value: RelationshipGoal; label: string }[] = [
  { value: 'maintain', label: '维持现状' },
  { value: 'deepen',   label: '更进一步' },
  { value: 'repair',   label: '修复关系' },
]
```

5c. state 声明区（`rels` 之后）添加：

```tsx
  const [goal, setGoal] = useState<RelationshipGoal | ''>(initial?.relationshipGoal ?? '')
```

5d. `handleSubmit` 里 friend 对象的 `notes` 行之后添加：

```tsx
      notes:    notes || undefined,
      relationshipGoal: goal || undefined,
```

5e. '关系与备注' section 里、备注 field 之前添加（复用已有的 `importanceButtonStyle`）：

```tsx
            {field('我对这段关系的期待（只有你可见，会影响图鉴建议的方向）',
              <div style={{ display:'flex', gap:8 }}>
                {GOAL_OPTIONS.map(o => (
                  <button key={o.value} type="button"
                    onClick={() => setGoal(goal === o.value ? '' : o.value)}
                    style={importanceButtonStyle(goal === o.value)}>{o.label}</button>
                ))}
              </div>
            )}
```

- [ ] **Step 6: 全量验证**

Run: `npm test`
Expected: 全部 PASS

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 7: Commit**

```bash
git add lib/store.ts lib/store.test.ts components/FriendForm.tsx
git commit -m "feat: add relationshipGoal to friend form and persist it in store"
```

---

### Task 5: selectMemoriesForAtlas —— 扩充关键词 + 负面记忆保底入选

**Files:**
- Modify: `lib/ai/selectMemoriesForAtlas.ts`
- Modify: `lib/ai/selectMemoriesForAtlas.test.ts`

动机：用户记的负面事件如果不在最近 15 条里，模型看不到就编不出可信的 `warnings` 和 `relationshipTrend`（正负互动比需要两侧样本）。同时关键词表从 6 个扩到覆盖冲突/修复/重大生活事件。注意从旧表中移除 `'喜欢'`/`'不喜欢'`——它们在中文日常句子里命中率过高，等于没筛。

- [ ] **Step 1: 在 `lib/ai/selectMemoriesForAtlas.test.ts` 的 describe 块末尾追加两个测试**

测试构造要点：目标记忆必须**不被任何现有桶救起**——不在最近 15 条里（用 20 条 5 月的 recent 占位）、不在最早 3 条里（用 5 条 1 月的 early 占位）、内容比 recent 短（长内容名额被占）、无标签（tag 名额被 early 的双标签占）。这样只有新逻辑能让它入选。

```ts
  it('includes a negative-valence memory that no existing bucket would select', () => {
    const recent = Array.from({ length: 20 }, (_, i) =>
      makeMemory({ id: `recent${i}`, date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        content: '这是一条比较长的普通聚餐流水账，用来占住长内容名额的填充记录' })
    )
    const early = Array.from({ length: 5 }, (_, i) =>
      makeMemory({ id: `early${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}`, tags: ['a', 'b'] })
    )
    const conflict = makeMemory({ id: 'conflict', date: '2026-03-01', valence: 'negative' })
    const result = selectMemoriesForAtlas(makeFriend([...recent, ...early, conflict]))
    expect(result.some(m => m.id === 'conflict')).toBe(true)
  })

  it('includes a memory matching a conflict-repair keyword (道歉) that no other bucket would select', () => {
    const recent = Array.from({ length: 20 }, (_, i) =>
      makeMemory({ id: `recent${i}`, date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        content: '这是一条比较长的普通聚餐流水账，用来占住长内容名额的填充记录' })
    )
    const early = Array.from({ length: 5 }, (_, i) =>
      makeMemory({ id: `early${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}`, tags: ['a', 'b'] })
    )
    const apology = makeMemory({ id: 'apology', date: '2026-03-01', content: '后来他主动道歉了' })
    const result = selectMemoriesForAtlas(makeFriend([...recent, ...early, apology]))
    expect(result.some(m => m.id === 'apology')).toBe(true)
  })
```

- [ ] **Step 2: 运行确认两个新用例失败**

Run: `npx vitest run lib/ai/selectMemoriesForAtlas.test.ts`
Expected: 新增 2 个用例 FAIL，原有用例 PASS

- [ ] **Step 3: 修改 `lib/ai/selectMemoriesForAtlas.ts`**

替换关键词表：

```ts
const KEYWORDS = [
  '生日', '礼物', '吵架', '和好', '道歉', '帮忙', '借', '搬家',
  '生病', '住院', '升职', '离职', '分手', '结婚', '旅行', '秘密', '第一次', '重要',
]
```

在 `keywordMatches` 定义之后加负面记忆桶：

```ts
  const negativeMemories = friend.memories.filter(m => m.valence === 'negative')
```

插入顺序（优先级）改为——在 `add(byDateAsc.slice(0, 3))` 之后、`add(byContentLengthDesc.slice(0, 5))` 之前插入：

```ts
  add(byDateDesc.slice(0, 15))
  add(byDateAsc.slice(0, 3))
  add(negativeMemories.slice(0, 5))
  add(byContentLengthDesc.slice(0, 5))
  add(byTagCountDesc.slice(0, 5))
  add(keywordMatches)
```

- [ ] **Step 4: 运行确认全部通过（含原有 5 个用例——原关键词测试用的『生日/礼物』仍在新表中）**

Run: `npx vitest run lib/ai/selectMemoriesForAtlas.test.ts`
Expected: PASS（7 个用例）

- [ ] **Step 5: Commit**

```bash
git add lib/ai/selectMemoriesForAtlas.ts lib/ai/selectMemoriesForAtlas.test.ts
git commit -m "feat: guarantee negative memories and expand keyword coverage in atlas selection"
```

---

### Task 6: contextBuilder 透传新字段

**Files:**
- Modify: `lib/ai/contextBuilder.ts`
- Modify: `lib/ai/contextBuilder.test.ts`

- [ ] **Step 1: 在 `lib/ai/contextBuilder.test.ts` 末尾追加测试（复用该文件已有的构造工具；若无，用下面内联写法）**

```ts
describe('new evidence fields passthrough', () => {
  it('includes relationshipGoal and memory valence/initiator in the context', () => {
    const friend: Friend = {
      id: 'f-ctx', name: 'Ctx', important: false,
      likes: [], dislikes: [], hobbies: [], portraits: [], relationships: [],
      relationshipGoal: 'repair',
      memories: [{
        id: 'm1', date: '2026-06-01', title: '吃饭', content: '聊开了',
        tags: [], media: [], valence: 'positive', initiator: 'friend',
      }],
      starConfig: { kind: 'nebula', coreColor: '#000', glowColor: '#000', size: 1, twinkleSpeed: 2, position: [0, 0, 0] },
      createdAt: '2026-01-01', updatedAt: '2026-01-01',
    }
    const context = buildFriendAtlasContext(friend, [friend])
    expect(context.friend.relationshipGoal).toBe('repair')
    expect(context.memories[0]).toMatchObject({ valence: 'positive', initiator: 'friend' })
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/ai/contextBuilder.test.ts`
Expected: 新用例 FAIL（字段为 undefined / 类型错误）

- [ ] **Step 3: 修改 `lib/ai/contextBuilder.ts`**

3a. `FriendAtlasContext` 接口：`friend` 内 `notes?: string` 之后加：

```ts
    notes?: string
    relationshipGoal?: 'maintain' | 'deepen' | 'repair'
```

`memories` 数组元素类型改为：

```ts
  memories: {
    id: string; date: string; title: string; content: string; tags: string[]
    valence?: 'positive' | 'neutral' | 'negative'
    initiator?: 'me' | 'friend' | 'both'
  }[]
```

3b. `buildFriendAtlasContext` 返回对象：`friend` 里 `notes: friend.notes,` 之后加：

```ts
      notes: friend.notes,
      relationshipGoal: friend.relationshipGoal,
```

memories 映射改为：

```ts
    memories: memories.map(m => ({
      id: m.id, date: m.date, title: m.title, content: m.content, tags: m.tags,
      valence: m.valence, initiator: m.initiator,
    })),
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/ai/contextBuilder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/ai/contextBuilder.ts lib/ai/contextBuilder.test.ts
git commit -m "feat: pass relationshipGoal and memory valence/initiator into AI context"
```

---

### Task 7: prompt 升级 + missingInfoQuestions 输出

**Files:**
- Modify: `lib/ai/prompts.ts`
- Create: `lib/ai/prompts.test.ts`
- Modify: `lib/ai/tokenEstimate.ts:11-14`（`OUTPUT_LIMITS.atlas` 2200 → 2600，容纳新字段）
- Modify: `app/api/ai/generate-atlas/route.ts`（解析新字段）

- [ ] **Step 1: 写失败测试 `lib/ai/prompts.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildAtlasPrompt } from './prompts'
import type { FriendAtlasContext } from './contextBuilder'

function makeContext(): FriendAtlasContext {
  return {
    friend: { id: 'f1', name: 'Test', important: false, relationshipGoal: 'repair' },
    likes: [], dislikes: [], hobbies: [],
    memories: [{ id: 'm1', date: '2026-06-01', title: 't', content: 'c', tags: [], valence: 'negative', initiator: 'friend' }],
    relationships: [],
    stats: {
      memoryCount: 1, relationshipCount: 0, profileCompletion: 20,
      growthStage: 'seed', energyLevel: 'low', confidence: 'low',
    },
  }
}

describe('buildAtlasPrompt', () => {
  it('asks for missingInfoQuestions in the output schema', () => {
    expect(buildAtlasPrompt(makeContext())).toContain('missingInfoQuestions')
  })

  it('explains valence/initiator semantics and relationshipGoal usage', () => {
    const prompt = buildAtlasPrompt(makeContext())
    expect(prompt).toContain('valence')
    expect(prompt).toContain('initiator')
    expect(prompt).toContain('relationshipGoal')
  })

  it('requires inferred content to be marked as speculation', () => {
    expect(buildAtlasPrompt(makeContext())).toContain('（推测）')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/ai/prompts.test.ts`
Expected: FAIL

- [ ] **Step 3: 修改 `lib/ai/prompts.ts` 的 `buildAtlasPrompt`**

重要规则列表：保留原第 1–6 条不动，在第 6 条之后插入以下第 7–10 条，原第 7 条（"用中文输出"）改为第 11 条：

```
7. memories 里的 valence 表示该次互动的情绪效价（positive/neutral/negative），initiator 表示发起方（me=用户主动，friend=好友主动，both=共同/自然发生）。
   - relationshipTrend 必须参考 valence 的正负分布和 initiator 的平衡（长期只有一方发起是重要信号）。
   - warnings 优先基于 valence 为 negative 的记录。
8. 如果 friend.relationshipGoal 存在（maintain=维持现状，deepen=更进一步，repair=修复关系），
   conversationTopics、suitableActivities、warnings 都要围绕这个目标给建议；repair 时优先温和的修复性建议。
9. 区分"记录"与"推断"：凡不是用户记录里直接出现、而是你推断出来的内容，必须在句末标注"（推测）"。
10. missingInfoQuestions：给出恰好 3 个问题——补充哪些观察最能提高这份图鉴的准确度。
    问题要具体到下次相处时可以直接留意（例如"TA 聊到工作时情绪如何"），不要问抽象问题。
11. 用中文输出。
```

JSON 输出结构里 `"relationshipTrend"` 行之后加：

```
  "relationshipTrend": "根据记录判断关系趋势。如果资料不足，请说明不确定。",
  "missingInfoQuestions": ["最能提高图鉴准确度的问题1", "问题2", "问题3"],
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/ai/prompts.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: `lib/ai/tokenEstimate.ts` 提高 atlas 输出上限**

```ts
export const OUTPUT_LIMITS = {
  atlas: 2600,
  question: 1200,
}
```

（检查 `lib/ai/tokenEstimate.test.ts` 是否有硬编码 2200 的断言，如有同步更新。）

- [ ] **Step 6: `app/api/ai/generate-atlas/route.ts` 解析新字段**

`AtlasAIOutput` 接口 `relationshipTrend: string` 之后加：

```ts
  relationshipTrend: string
  missingInfoQuestions?: string[]
```

`atlas` 对象构造中 `relationshipTrend` 行之后加：

```ts
    relationshipTrend: parsed.data.relationshipTrend,
    missingInfoQuestions: parsed.data.missingInfoQuestions ?? [],
```

- [ ] **Step 7: 全量验证**

Run: `npm test`
Expected: 全部 PASS

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 8: Commit**

```bash
git add lib/ai/prompts.ts lib/ai/prompts.test.ts lib/ai/tokenEstimate.ts app/api/ai/generate-atlas/route.ts
git commit -m "feat: teach atlas prompt valence/initiator/goal semantics and missingInfoQuestions output"
```

---

### Task 8: evidence 服务端校验

**Files:**
- Create: `lib/ai/validateEvidence.ts`
- Create: `lib/ai/validateEvidence.test.ts`
- Modify: `app/api/ai/generate-atlas/route.ts:85`
- Modify: `app/api/ai/ask-atlas/route.ts:69`

策略：`type === 'memory'` 且带 `id` 的 evidence，id 必须存在于本次传给模型的 memories 中，否则丢弃（模型编造了引用）。不带 id 的说明性依据和非 memory 类型（like/hobby/note 等，本身无 id 可校验）保留。

- [ ] **Step 1: 写失败测试 `lib/ai/validateEvidence.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { validateEvidence } from './validateEvidence'
import type { AtlasEvidence } from '../types'

const VALID_IDS = new Set(['m1', 'm2'])

describe('validateEvidence', () => {
  it('keeps memory evidence whose id exists in the context', () => {
    const evidence: AtlasEvidence[] = [{ type: 'memory', id: 'm1', text: 'ok' }]
    expect(validateEvidence(evidence, VALID_IDS)).toEqual(evidence)
  })

  it('drops memory evidence with a fabricated id', () => {
    const evidence: AtlasEvidence[] = [
      { type: 'memory', id: 'm1', text: 'real' },
      { type: 'memory', id: 'made-up', text: 'hallucinated' },
    ]
    expect(validateEvidence(evidence, VALID_IDS)).toEqual([{ type: 'memory', id: 'm1', text: 'real' }])
  })

  it('keeps memory evidence without an id (descriptive reference)', () => {
    const evidence: AtlasEvidence[] = [{ type: 'memory', text: '多条聚餐记录' }]
    expect(validateEvidence(evidence, VALID_IDS)).toEqual(evidence)
  })

  it('keeps non-memory evidence untouched', () => {
    const evidence: AtlasEvidence[] = [{ type: 'like', text: '喜欢咖啡' }, { type: 'note', text: '备注' }]
    expect(validateEvidence(evidence, VALID_IDS)).toEqual(evidence)
  })

  it('returns [] for undefined evidence', () => {
    expect(validateEvidence(undefined, VALID_IDS)).toEqual([])
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/ai/validateEvidence.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 创建 `lib/ai/validateEvidence.ts`**

```ts
import type { AtlasEvidence } from '../types'

export function validateEvidence(
  evidence: AtlasEvidence[] | undefined,
  validMemoryIds: Set<string>
): AtlasEvidence[] {
  if (!evidence) return []
  return evidence.filter(e => {
    if (e.type !== 'memory') return true
    if (!e.id) return true
    return validMemoryIds.has(e.id)
  })
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/ai/validateEvidence.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: 接入 `app/api/ai/generate-atlas/route.ts`**

加 import：

```ts
import { validateEvidence } from '@/lib/ai/validateEvidence'
```

`atlas` 对象里 `evidence` 一行替换为：

```ts
    evidence: validateEvidence(parsed.data.evidence, new Set(context.memories.map(m => m.id))),
```

- [ ] **Step 6: 接入 `app/api/ai/ask-atlas/route.ts`**

加 import（同上），最终 `NextResponse.json` 里 `evidence` 一行替换为：

```ts
    evidence: validateEvidence(parsed.data.evidence, new Set(context.memories.map(m => m.id))),
```

- [ ] **Step 7: 全量验证（`app/api/ai/ask-atlas/route.test.ts` 已有，必须保持通过；若其 mock 的 context 没有 memories 数组，按其现有构造方式补上空数组）**

Run: `npm test`
Expected: 全部 PASS

- [ ] **Step 8: Commit**

```bash
git add lib/ai/validateEvidence.ts lib/ai/validateEvidence.test.ts app/api/ai/generate-atlas/route.ts app/api/ai/ask-atlas/route.ts
git commit -m "feat: validate AI-cited evidence ids server-side to drop fabricated references"
```

---

### Task 9: 图鉴页渲染 missingInfoQuestions

**Files:**
- Modify: `app/atlas/[friendId]/page.tsx`（warnings section 之后、`<AtlasChatBox ...>` 之前）

- [ ] **Step 1: 在 warnings `</section>` 与 `<AtlasChatBox` 之间插入**

```tsx
            {(atlas.missingInfoQuestions?.length ?? 0) > 0 && (
              <section style={{ background:'rgba(155,142,196,0.05)', border:'1px solid rgba(155,142,196,0.2)',
                borderRadius:14, padding:'20px 24px' }}>
                <div style={{ color:'rgba(155,142,196,0.8)', fontSize:10, letterSpacing:3, marginBottom:12 }}>
                  ✧ 补充这些，图鉴会更准
                </div>
                <ul style={{ margin:0, paddingLeft:18, display:'flex', flexDirection:'column', gap:8 }}>
                  {atlas.missingInfoQuestions!.map(q => (
                    <li key={q} style={{ color:'#cbd5e1', fontSize:12, lineHeight:1.8 }}>{q}</li>
                  ))}
                </ul>
              </section>
            )}
```

- [ ] **Step 2: 验证构建**

Run: `npx tsc --noEmit`
Expected: 无错误

Run: `npm test`
Expected: 全部 PASS

- [ ] **Step 3: Commit**

```bash
git add "app/atlas/[friendId]/page.tsx"
git commit -m "feat: render missingInfoQuestions section on atlas page"
```

---

### Task 10: 端到端验证

**Files:** 无新改动，验证与收尾。

- [ ] **Step 1: 全量测试 + 构建**

Run: `npm test`
Expected: 全部 PASS

Run: `npm run build`
Expected: 构建成功，无类型错误

- [ ] **Step 2: 手动冒烟（`npm run dev`，localStorage 本地模式即可，不需要配 Supabase）**

1. 新建好友（完整档案）→ 能看到"我对这段关系的期待"三个选项，选中后保存。
2. 好友详情页添加回忆 → 能看到情绪/发起方选择器和引导提示；保存后列表日期旁显示表情。
3. 编辑该回忆 → 之前选的情绪/发起方被正确带入。
4. 刷新页面 → relationshipGoal 和 valence/initiator 仍在（验证 normalizeFriend 未剥字段）。
5. （需配置 AI key 时）生成图鉴 → 页面出现"补充这些，图鉴会更准"区块，恰好 3 个问题。
6. 打开一个旧好友的旧图鉴（如有）→ 页面不报错（missingInfoQuestions 可选字段兼容）。

- [ ] **Step 3: 若一切通过，按 superpowers:finishing-a-development-branch 流程收尾**
