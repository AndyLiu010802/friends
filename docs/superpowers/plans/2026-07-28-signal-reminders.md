# 星语提醒(第三期)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「今日星象」升级为可行动、可忽略的「星语提醒」信号流:新增关系目标偏离/单向发起/生日三档信号,每条可「知道了」(状态变化自动重现),行动按钮直达快记与飞星,导航加未读点。

**Architecture:** 信号生成仍是纯函数(`lib/insights.ts` 扩展 fingerprint/dismissible 与三类新信号);忽略状态是独立小模块 `lib/signalDismissals.ts`(localStorage,纯函数过滤);`InsightPanel` 改为受控组件(HomePage 计算信号并同时供面板与导航未读点使用);快记按钮复用第二期 `QuickNoteOverlay.defaultFriendId`。

**Tech Stack:** Next.js 16 App Router、React 19、Vitest + Testing Library。零新依赖、零新路由。

**注意:** AGENTS.md 要求写代码前查 `node_modules/next/dist/docs/`。本计划只用库中已在用的 API;遇到行为差异先查 `node_modules/next/dist/docs/01-app/`。

Spec: `docs/superpowers/specs/2026-07-28-signal-reminders-design.md`

对 spec 的两处已确认精化(实现按本计划为准):
1. `filterDismissed(insights, dismissals)` 为纯函数(忽略表由调用方持有),而非自读 localStorage——可测性更好。
2. 不做"指纹不同时清掉旧忽略记录":同 id 重忽略会覆盖,表的大小天然有界(好友数×信号类型),清理属 YAGNI。

---

### Task 1: `getBirthdayStatus` 增加 `isWithin14` 与 `nextBirthdayISO`

**Files:**
- Modify: `lib/birthdayStatus.ts`
- Test: `lib/birthdayStatus.test.ts`(追加)

- [ ] **Step 1: 写失败测试**

在 `lib/birthdayStatus.test.ts` 现有用例后追加(沿用该文件现有的 now 构造方式;若现有用例断言返回对象的全等形状,把新字段补进那些断言):

```ts
describe('isWithin14 与 nextBirthdayISO', () => {
  const now = new Date(2026, 6, 28) // 2026-07-28
  it('10 天后生日:isWithin14 为 true,isSoon 为 false', () => {
    const s = getBirthdayStatus('2000-08-07', now)
    expect(s.daysUntil).toBe(10)
    expect(s.isWithin14).toBe(true)
    expect(s.isSoon).toBe(false)
  })
  it('今天生日:isWithin14 为 true,nextBirthdayISO 是今天', () => {
    const s = getBirthdayStatus('2000-07-28', now)
    expect(s.isWithin14).toBe(true)
    expect(s.nextBirthdayISO).toBe('2026-07-28')
  })
  it('15 天后:isWithin14 为 false', () => {
    expect(getBirthdayStatus('2000-08-12', now).isWithin14).toBe(false)
  })
  it('已过的生日翻到明年:nextBirthdayISO 为明年日期', () => {
    expect(getBirthdayStatus('2000-01-05', now).nextBirthdayISO).toBe('2027-01-05')
  })
  it('无生日:两个新字段为 false/null', () => {
    const s = getBirthdayStatus(undefined, now)
    expect(s.isWithin14).toBe(false)
    expect(s.nextBirthdayISO).toBeNull()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/birthdayStatus.test.ts`
Expected: FAIL(新字段不存在)

- [ ] **Step 3: 实现**

`lib/birthdayStatus.ts` 返回类型与三个 return 分支补充两个字段:

```ts
export function getBirthdayStatus(
  birthday?: string,
  now: Date = new Date(),
): {
  daysUntil: number | null
  label: string | null
  isToday: boolean
  isSoon: boolean
  isWithin14: boolean
  nextBirthdayISO: string | null
} {
  const parsed = birthday ? parseBirthday(birthday) : null
  if (!parsed) {
    return { daysUntil: null, label: null, isToday: false, isSoon: false, isWithin14: false, nextBirthdayISO: null }
  }

  const { month, day } = parsed
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let nextBirthday = new Date(now.getFullYear(), month - 1, day)
  if (nextBirthday < today) {
    nextBirthday = new Date(now.getFullYear() + 1, month - 1, day)
  }
  const daysUntil = Math.round((nextBirthday.getTime() - today.getTime()) / 86400000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const nextBirthdayISO = `${nextBirthday.getFullYear()}-${pad(nextBirthday.getMonth() + 1)}-${pad(nextBirthday.getDate())}`
  const isWithin14 = daysUntil <= 14

  if (daysUntil === 0) {
    return { daysUntil, label: '今天生日 🎂', isToday: true, isSoon: true, isWithin14, nextBirthdayISO }
  }
  if (daysUntil <= 7) {
    return { daysUntil, label: `${daysUntil} 天后生日`, isToday: false, isSoon: true, isWithin14, nextBirthdayISO }
  }
  return { daysUntil, label: null, isToday: false, isSoon: false, isWithin14, nextBirthdayISO }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/birthdayStatus.test.ts` 然后 `npx vitest run`
Expected: 全部 PASS(现有消费者 StarBuilder/FriendCard 只读旧字段,不受影响)

- [ ] **Step 5: Commit**

```bash
git add lib/birthdayStatus.ts lib/birthdayStatus.test.ts
git commit -m "feat: expose isWithin14 and nextBirthdayISO from birthday status"
```

---

### Task 2: `lib/signalDismissals.ts` 忽略模块

**Files:**
- Create: `lib/signalDismissals.ts`
- Test: `lib/signalDismissals.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `lib/signalDismissals.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getDismissals, dismissSignal, filterDismissed } from './signalDismissals'

beforeEach(() => localStorage.clear())

describe('signalDismissals', () => {
  it('初始为空表', () => {
    expect(getDismissals()).toEqual({})
  })

  it('dismiss 后落库并返回新表', () => {
    const next = dismissSignal('f1-birthday', '2026-08-01-soon')
    expect(next).toEqual({ 'f1-birthday': '2026-08-01-soon' })
    expect(getDismissals()).toEqual({ 'f1-birthday': '2026-08-01-soon' })
  })

  it('同 id 再次 dismiss 覆盖旧指纹', () => {
    dismissSignal('a', 'fp1')
    expect(dismissSignal('a', 'fp2')).toEqual({ a: 'fp2' })
  })

  it('filterDismissed:指纹相同滤掉,不同保留', () => {
    const dismissals = { a: 'fp1' }
    const signals = [
      { id: 'a', fingerprint: 'fp1' },
      { id: 'a2', fingerprint: 'fp1' },
      { id: 'b', fingerprint: 'x' },
    ]
    expect(filterDismissed(signals, dismissals).map(s => s.id)).toEqual(['a2', 'b'])
  })

  it('指纹变化(状态变化)后同 id 信号重现', () => {
    const d = dismissSignal('a', 'old-state')
    expect(filterDismissed([{ id: 'a', fingerprint: 'new-state' }], d)).toHaveLength(1)
  })

  it('损坏 JSON 静默降级为空表', () => {
    localStorage.setItem('yj_dismissed_signals', '{not json')
    expect(getDismissals()).toEqual({})
  })

  it('存的是数组等非对象也降级为空表', () => {
    localStorage.setItem('yj_dismissed_signals', '[1,2]')
    expect(getDismissals()).toEqual({})
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/signalDismissals.test.ts`
Expected: FAIL — 找不到模块

- [ ] **Step 3: 实现**

创建 `lib/signalDismissals.ts`:

```ts
// 「知道了」忽略表:id -> 触发条件指纹。设备本地状态,不进云备份。
// 指纹变化(触发条件的状态变化)时同 id 信号会重新出现。
const KEY = 'yj_dismissed_signals'

export interface DismissableSignal {
  id: string
  fingerprint: string
}

export function getDismissals(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    return raw
  } catch {
    return {}
  }
}

export function dismissSignal(id: string, fingerprint: string): Record<string, string> {
  const next = { ...getDismissals(), [id]: fingerprint }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* 存不进就只在本次会话生效 */ }
  return next
}

export function filterDismissed<T extends DismissableSignal>(
  signals: T[],
  dismissals: Record<string, string>,
): T[] {
  return signals.filter(s => dismissals[s.id] !== s.fingerprint)
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/signalDismissals.test.ts`
Expected: PASS(7 个用例)

- [ ] **Step 5: Commit**

```bash
git add lib/signalDismissals.ts lib/signalDismissals.test.ts
git commit -m "feat: add signal dismissal store with state fingerprints"
```

---

### Task 3: `lib/insights.ts` 信号层扩展

**Files:**
- Modify: `lib/insights.ts`(整体重写,保留既有文案)
- Test: `lib/insights.test.ts`(先读现有文件:保留仍适用的用例并按新字段微调,追加新信号用例)

- [ ] **Step 1: 写失败测试**

先读 `lib/insights.test.ts` 现有内容(baseFriend 工厂 + NOW 常量)。保留现有用例
(生日 7 天内、inactive、无记录、incomplete、important、lonely、排序),若其中有
断言"最多 5 条"的用例,改为断言"最多 8 条"。然后追加:

```ts
describe('新信号:goal-drift', () => {
  it('deepen 且超 30 天无记录:priority 2', () => {
    const f = baseFriend({ relationshipGoal: 'deepen',
      memories: [{ id:'m1', date:'2026-05-01', title:'t', content:'', tags:[], media:[] }] })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'goal-drift')!
    expect(hit.text).toContain('更近一步')
    expect(hit.priority).toBe(2)
    expect(hit.dismissible).toBe(true)
    expect(hit.fingerprint).toBe('2026-05-01')
  })
  it('deepen 且完全无记录也触发,指纹为 none', () => {
    const f = baseFriend({ relationshipGoal: 'deepen' })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'goal-drift')!
    expect(hit.fingerprint).toBe('none')
  })
  it('deepen 但 30 天内有记录:不触发', () => {
    const f = baseFriend({ relationshipGoal: 'deepen',
      memories: [{ id:'m1', date:'2026-07-20', title:'t', content:'', tags:[], media:[] }] })
    expect(generateFriendInsights([f], NOW).find(i => i.type === 'goal-drift')).toBeUndefined()
  })
  it('repair 且最新记录为 negative:priority 3,指纹为该记录 id', () => {
    const f = baseFriend({ relationshipGoal: 'repair', memories: [
      { id:'ok', date:'2026-07-01', title:'t', content:'', tags:[], media:[], valence:'positive' },
      { id:'bad', date:'2026-07-20', title:'t', content:'', tags:[], media:[], valence:'negative' },
    ] })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'goal-drift')!
    expect(hit.priority).toBe(3)
    expect(hit.text).toContain('缓和')
    expect(hit.fingerprint).toBe('bad')
  })
  it('repair 但最新记录非 negative:不触发', () => {
    const f = baseFriend({ relationshipGoal: 'repair', memories: [
      { id:'bad', date:'2026-07-01', title:'t', content:'', tags:[], media:[], valence:'negative' },
      { id:'ok', date:'2026-07-20', title:'t', content:'', tags:[], media:[], valence:'positive' },
    ] })
    expect(generateFriendInsights([f], NOW).find(i => i.type === 'goal-drift')).toBeUndefined()
  })
})

describe('新信号:one-sided', () => {
  const mem = (id: string, date: string, initiator?: 'me' | 'friend' | 'both') =>
    ({ id, date, title:'t', content:'', tags:[], media:[], initiator })
  it('最近 5 条有 initiator 的记录全为 me:触发,指纹为 5 个 id', () => {
    const f = baseFriend({ memories: [
      mem('m1','2026-07-01','me'), mem('m2','2026-07-02','me'), mem('m3','2026-07-03','me'),
      mem('m4','2026-07-04','me'), mem('m5','2026-07-05','me'),
      mem('old','2026-01-01','friend'), // 第 6 近,不在窗口内
      mem('x','2026-07-06'),            // 无 initiator,不计入选取
    ] })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'one-sided')!
    expect(hit.priority).toBe(2)
    expect(hit.fingerprint).toBe('m5,m4,m3,m2,m1')
  })
  it('有 initiator 的记录不足 5 条:不触发', () => {
    const f = baseFriend({ memories: [
      mem('m1','2026-07-01','me'), mem('m2','2026-07-02','me'),
      mem('m3','2026-07-03','me'), mem('m4','2026-07-04','me'),
    ] })
    expect(generateFriendInsights([f], NOW).find(i => i.type === 'one-sided')).toBeUndefined()
  })
  it('最近 5 条里混有 friend/both:不触发', () => {
    const f = baseFriend({ memories: [
      mem('m1','2026-07-01','me'), mem('m2','2026-07-02','me'), mem('m3','2026-07-03','both'),
      mem('m4','2026-07-04','me'), mem('m5','2026-07-05','me'),
    ] })
    expect(generateFriendInsights([f], NOW).find(i => i.type === 'one-sided')).toBeUndefined()
  })
})

describe('生日三档', () => {
  it('今天生日:priority 3 且不可忽略,指纹含 today', () => {
    const f = baseFriend({ birthday: '2000-07-28' })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'birthday')!
    expect(hit.priority).toBe(3)
    expect(hit.dismissible).toBe(false)
    expect(hit.fingerprint).toBe('2026-07-28-today')
  })
  it('7 天内:priority 3 可忽略,档位 soon', () => {
    const f = baseFriend({ birthday: '2000-08-02' })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'birthday')!
    expect(hit.priority).toBe(3)
    expect(hit.dismissible).toBe(true)
    expect(hit.fingerprint).toBe('2026-08-02-soon')
  })
  it('8-14 天:priority 2,档位 later', () => {
    const f = baseFriend({ birthday: '2000-08-08' })
    const hit = generateFriendInsights([f], NOW).find(i => i.type === 'birthday')!
    expect(hit.priority).toBe(2)
    expect(hit.fingerprint).toBe('2026-08-08-later')
    expect(hit.text).toContain('11 天后')
  })
  it('15 天以上:无生日信号', () => {
    const f = baseFriend({ birthday: '2000-08-15' })
    expect(generateFriendInsights([f], NOW).find(i => i.type === 'birthday')).toBeUndefined()
  })
})

describe('通用字段', () => {
  it('所有信号都带 fingerprint 与 dismissible', () => {
    const f = baseFriend({ birthday: '2000-08-02', relationshipGoal: 'deepen' })
    for (const ins of generateFriendInsights([f], NOW)) {
      expect(typeof ins.fingerprint).toBe('string')
      expect(ins.fingerprint.length).toBeGreaterThan(0)
      expect(typeof ins.dismissible).toBe('boolean')
    }
  })
  it('上限 8 条', () => {
    const many = Array.from({ length: 6 }, (_, i) => baseFriend({
      id: `f${i}`, name: `友${i}`, birthday: '2000-08-02', relationshipGoal: 'deepen',
    }))
    expect(generateFriendInsights(many, NOW).length).toBeLessThanOrEqual(8)
  })
})
```

(注意:NOW 若现有文件不是 2026-07-28,保留现有 NOW 并按其调整上述日期——生日用例
需要"今天/5 天后/11 天后/18 天后"四种相对距离、goal-drift 需要"距 NOW >30 天"与
"<30 天"的日期。实现者按现有 NOW 换算,断言的档位/优先级/指纹结构不变。)

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/insights.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

重写 `lib/insights.ts` 为:

```ts
// lib/insights.ts
import type { Friend, Memory } from './types'
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
  | 'goal-drift'
  | 'one-sided'

export interface FriendInsight {
  id: string
  type: FriendInsightType
  friendId: string
  friendName: string
  text: string
  priority: 1 | 2 | 3
  fingerprint: string   // 触发条件的状态指纹:状态变化后同 id 信号重新出现
  dismissible: boolean  // 生日当天为 false
}

function latestMemoryOf(friend: Friend): Memory | undefined {
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
    const latest = latestMemoryOf(friend)
    const latestFp = latest?.date ?? 'none'

    const birthday = getBirthdayStatus(friend.birthday, now)
    if (birthday.isWithin14 && birthday.daysUntil !== null && birthday.nextBirthdayISO) {
      const tier = birthday.isToday ? 'today' : birthday.daysUntil <= 7 ? 'soon' : 'later'
      insights.push({
        id: `${friend.id}-birthday`, type: 'birthday', friendId: friend.id, friendName: friend.name,
        text: birthday.isToday
          ? `今天是${friend.name}生日 🎂`
          : `${birthday.daysUntil} 天后是${friend.name}生日`,
        priority: tier === 'later' ? 2 : 3,
        fingerprint: `${birthday.nextBirthdayISO}-${tier}`,
        dismissible: !birthday.isToday,
      })
    }

    const memoryAge = daysSinceLatestMemory(friend, now)
    if (memoryAge !== null) {
      if (memoryAge > 60) {
        insights.push({
          id: `${friend.id}-inactive`, type: 'inactive', friendId: friend.id, friendName: friend.name,
          text: `你已经 ${memoryAge} 天没有更新${friend.name}的记录`, priority: 2,
          fingerprint: latestFp, dismissible: true,
        })
      }
      if (memoryAge <= 7) {
        insights.push({
          id: `${friend.id}-recent-memory`, type: 'recent-memory', friendId: friend.id, friendName: friend.name,
          text: `最近新增了关于${friend.name}的回忆`, priority: 2,
          fingerprint: latestFp, dismissible: true,
        })
      }
    } else {
      const createdDays = daysBetween(new Date(friend.createdAt), now)
      if (createdDays > 14) {
        insights.push({
          id: `${friend.id}-inactive`, type: 'inactive', friendId: friend.id, friendName: friend.name,
          text: `${friend.name}还没有任何回忆记录`, priority: 1,
          fingerprint: 'none', dismissible: true,
        })
      }
    }

    const completion = calculateProfileCompletion(friend)
    if (completion.percent < 50) {
      insights.push({
        id: `${friend.id}-incomplete`, type: 'incomplete', friendId: friend.id, friendName: friend.name,
        text: `${friend.name}的档案还很空，可以补充：${completion.missing.slice(0, 2).join('、')}`, priority: 1,
        fingerprint: String(Math.floor(completion.percent / 10) * 10), dismissible: true,
      })
    }

    if (friend.important && (memoryAge === null || memoryAge > 30)) {
      insights.push({
        id: `${friend.id}-important`, type: 'important', friendId: friend.id, friendName: friend.name,
        text: `重要朋友${friend.name}最近还没有新记录`, priority: 2,
        fingerprint: latestFp, dismissible: true,
      })
    }

    if (isLonelyStar(friend)) {
      insights.push({
        id: `${friend.id}-lonely`, type: 'lonely', friendId: friend.id, friendName: friend.name,
        text: `${friend.name}还是一颗孤星，可以添加回忆或连接朋友`, priority: 1,
        fingerprint: latestFp, dismissible: true,
      })
    }

    // 关系目标偏离:同一好友只会命中其一(goal 是单值)
    if (friend.relationshipGoal === 'deepen' && (memoryAge === null || memoryAge > 30)) {
      insights.push({
        id: `${friend.id}-goal-drift`, type: 'goal-drift', friendId: friend.id, friendName: friend.name,
        text: `你想和${friend.name}更近一步，最近却安静了`, priority: 2,
        fingerprint: latestFp, dismissible: true,
      })
    } else if (friend.relationshipGoal === 'repair' && latest?.valence === 'negative') {
      insights.push({
        id: `${friend.id}-goal-drift`, type: 'goal-drift', friendId: friend.id, friendName: friend.name,
        text: `修复中的关系，最近一次互动不太顺，也许该缓和一下`, priority: 3,
        fingerprint: latest.id, dismissible: true,
      })
    }

    // 单向发起:最近 5 条带 initiator 的记录全是 me
    const withInitiator = [...friend.memories]
      .filter(m => m.initiator)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
    if (withInitiator.length === 5 && withInitiator.every(m => m.initiator === 'me')) {
      insights.push({
        id: `${friend.id}-one-sided`, type: 'one-sided', friendId: friend.id, friendName: friend.name,
        text: `最近都是你主动找${friend.name}，留意一下平衡`, priority: 2,
        fingerprint: withInitiator.map(m => m.id).join(','), dismissible: true,
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
    .slice(0, 8)
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/insights.test.ts` 然后 `npx vitest run`
Expected: lib 层全过。**注意**:`components/InsightPanel.test.tsx` 此刻可能因 mock
的洞察对象缺新字段而仍然通过(它 mock 了整个模块)——组件在 Task 4 处理;若全套
出现其他失败,先修复再提交。

- [ ] **Step 5: Commit**

```bash
git add lib/insights.ts lib/insights.test.ts
git commit -m "feat: add goal-drift, one-sided and tiered birthday signals with fingerprints"
```

---

### Task 4: InsightPanel 升级为受控「星语提醒」

**Files:**
- Modify: `components/InsightPanel.tsx`(整体重写)
- Modify: `components/InsightPanel.test.tsx`(整体重写)

- [ ] **Step 1: 写失败测试**

重写 `components/InsightPanel.test.tsx` 为:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InsightPanel from './InsightPanel'
import { useIsMobile } from '@/lib/useIsMobile'
import type { FriendInsight } from '@/lib/insights'

vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: vi.fn() }))
beforeEach(() => vi.mocked(useIsMobile).mockReturnValue(false))

function ins(overrides: Partial<FriendInsight>): FriendInsight {
  return {
    id: 'i1', type: 'inactive', friendId: 'f1', friendName: '小王',
    text: '默认文本', priority: 2, fingerprint: 'fp', dismissible: true,
    ...overrides,
  }
}

const THREE = [
  ins({ id: 'a', priority: 3, text: '今天是小王生日 🎂', type: 'birthday', dismissible: false }),
  ins({ id: 'b', priority: 2, text: '你已 70 天没记录小李', friendId: 'f2' }),
  ins({ id: 'c', priority: 1, text: '小张的档案还很空', friendId: 'f3' }),
]

function setup(insights = THREE, mobile = false) {
  vi.mocked(useIsMobile).mockReturnValue(mobile)
  const onSelectFriend = vi.fn()
  const onQuickNote = vi.fn()
  const onDismiss = vi.fn()
  render(<InsightPanel insights={insights}
    onSelectFriend={onSelectFriend} onQuickNote={onQuickNote} onDismiss={onDismiss} />)
  return { onSelectFriend, onQuickNote, onDismiss }
}

describe('InsightPanel(星语提醒)', () => {
  it('按优先级分组渲染,组标题正确', () => {
    setup()
    expect(screen.getByText('今天必看')).toBeInTheDocument()
    expect(screen.getByText('值得留意')).toBeInTheDocument()
    expect(screen.getByText('顺手补全')).toBeInTheDocument()
    expect(screen.getByText(/小王生日/)).toBeInTheDocument()
  })

  it('空组不显示组标题', () => {
    setup([ins({ priority: 2 })])
    expect(screen.queryByText('今天必看')).not.toBeInTheDocument()
    expect(screen.getByText('值得留意')).toBeInTheDocument()
  })

  it('全空显示安静文案', () => {
    setup([])
    expect(screen.getByText(/很安静/)).toBeInTheDocument()
  })

  it('去看看触发 onSelectFriend', () => {
    const { onSelectFriend } = setup()
    fireEvent.click(screen.getAllByText('去看看')[0])
    expect(onSelectFriend).toHaveBeenCalledWith('f1')
  })

  it('记一笔触发 onQuickNote', () => {
    const { onQuickNote } = setup()
    fireEvent.click(screen.getAllByText('✎ 记一笔')[1])
    expect(onQuickNote).toHaveBeenCalledWith('f2')
  })

  it('知道了触发 onDismiss 并传整条信号', () => {
    const { onDismiss } = setup()
    fireEvent.click(screen.getAllByText('知道了')[0])
    expect(onDismiss).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }))
  })

  it('不可忽略的信号没有知道了按钮', () => {
    setup([ins({ dismissible: false, priority: 3 })])
    expect(screen.queryByText('知道了')).not.toBeInTheDocument()
  })

  it('手机:胶囊显示条数,展开后分组可见', () => {
    setup(THREE, true)
    const capsule = screen.getByRole('button', { name: /星语提醒 · 3/ })
    expect(screen.queryByText('今天必看')).not.toBeInTheDocument()
    fireEvent.click(capsule)
    expect(screen.getByText('今天必看')).toBeInTheDocument()
  })

  it('手机:去看看回调后面板收起', () => {
    const { onSelectFriend } = setup(THREE, true)
    fireEvent.click(screen.getByRole('button', { name: /星语提醒 · 3/ }))
    fireEvent.click(screen.getAllByText('去看看')[0])
    expect(onSelectFriend).toHaveBeenCalledWith('f1')
    expect(screen.queryByText('今天必看')).not.toBeInTheDocument()
  })

  it('手机:无信号时不渲染胶囊', () => {
    setup([], true)
    expect(screen.queryByRole('button', { name: /星语提醒/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run components/InsightPanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: 实现**

重写 `components/InsightPanel.tsx` 为:

```tsx
'use client'
import { useState } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { fs, text, gold, purple, border, surface, radius, font } from '@/lib/ui/tokens'
import type { FriendInsight } from '@/lib/insights'

interface Props {
  insights: FriendInsight[]
  onSelectFriend: (friendId: string) => void
  onQuickNote: (friendId: string) => void
  onDismiss: (insight: FriendInsight) => void
}

const GROUPS: { priority: 1 | 2 | 3; title: string }[] = [
  { priority: 3, title: '今天必看' },
  { priority: 2, title: '值得留意' },
  { priority: 1, title: '顺手补全' },
]

export default function InsightPanel({ insights, onSelectFriend, onQuickNote, onDismiss }: Props) {
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(false)

  const actionBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: fs.meta, letterSpacing: 1, padding: '2px 6px', fontFamily: font.serif,
  }

  const insightRow = (insight: FriendInsight) => (
    <div key={insight.id} style={{
      background: surface.raise, border: `1px solid ${border.goldFaint}`,
      borderRadius: radius.sm, padding: isMobile ? '12px 12px' : '8px 10px',
    }}>
      <div style={{ color: text.primary, fontSize: fs.sub, lineHeight: 1.6, fontFamily: font.serif }}>
        {insight.text}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <button type="button" style={{ ...actionBtn, color: gold.base }}
          onClick={() => { onQuickNote(insight.friendId); setExpanded(false) }}>✎ 记一笔</button>
        <button type="button" style={{ ...actionBtn, color: gold.muted }}
          onClick={() => { onSelectFriend(insight.friendId); setExpanded(false) }}>去看看</button>
        {insight.dismissible && (
          <button type="button" style={{ ...actionBtn, color: purple.muted, marginLeft: 'auto' }}
            onClick={() => onDismiss(insight)}>知道了</button>
        )}
      </div>
    </div>
  )

  const groupedList = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {GROUPS.map(g => {
        const items = insights.filter(i => i.priority === g.priority)
        if (items.length === 0) return null
        return (
          <div key={g.priority}>
            <div style={{ color: gold.muted, fontSize: fs.meta, letterSpacing: 2, marginBottom: 8 }}>
              {g.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(insightRow)}
            </div>
          </div>
        )
      })}
    </div>
  )

  if (isMobile) {
    if (insights.length === 0) return null
    if (!expanded) {
      return (
        <button type="button" onClick={() => setExpanded(true)} style={{
          position: 'fixed', left: 16, bottom: 'calc(16px + env(safe-area-inset-bottom))',
          zIndex: 25, minHeight: 44,
          background: surface.card, border: `1px solid ${border.gold}`,
          borderRadius: radius.pill, padding: '10px 18px', backdropFilter: 'blur(12px)',
          color: gold.base, fontSize: fs.meta, letterSpacing: 2, cursor: 'pointer',
          fontFamily: font.serif,
        }}>
          ✦ 星语提醒 · {insights.length}
        </button>
      )
    }
    return (
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 25,
        background: surface.card, border: `1px solid ${border.gold}`,
        borderRadius: `${radius.lg}px ${radius.lg}px 0 0`, padding: '16px 18px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        backdropFilter: 'blur(12px)', maxHeight: '50vh', overflowY: 'auto',
        animation: 'youji-sheet-in .25s ease-out',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ color: gold.base, fontSize: fs.meta, letterSpacing: 2 }}>星语提醒</span>
          <button type="button" onClick={() => setExpanded(false)} style={{
            background: 'none', border: 'none', color: gold.muted,
            cursor: 'pointer', fontSize: fs.body, padding: '4px 8px',
          }}>✕</button>
        </div>
        {groupedList}
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', right: 24, bottom: 24, zIndex: 25, width: 300,
      background: surface.card, border: `1px solid ${border.gold}`,
      borderRadius: radius.md, padding: '16px 18px', backdropFilter: 'blur(12px)',
      maxHeight: '60vh', overflowY: 'auto',
    }}>
      <div style={{ color: gold.base, fontSize: fs.meta, letterSpacing: 2, marginBottom: 12 }}>星语提醒</div>
      {insights.length === 0 ? (
        <div style={{ color: purple.muted, fontSize: fs.sub, lineHeight: 1.6 }}>
          今天的朋友宇宙很安静。
        </div>
      ) : groupedList}
    </div>
  )
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run components/InsightPanel.test.tsx`
Expected: PASS(11 个用例)。全套 `npx vitest run` 此刻会因 `app/page.tsx` 还在用旧
props 而**类型不匹配但测试仍绿**(页面无测试);Task 5 完成接线后再看全绿。

- [ ] **Step 5: Commit**

```bash
git add components/InsightPanel.tsx components/InsightPanel.test.tsx
git commit -m "feat: controlled InsightPanel with groups, actions and dismissal"
```

---

### Task 5: HomePage 接线(信号计算 + 未读点 + 快记预选)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 实现**

对 `app/page.tsx`:

1. import 增加:

```tsx
import { generateFriendInsights } from '@/lib/insights'
import { getDismissals, dismissSignal, filterDismissed } from '@/lib/signalDismissals'
```

2. 状态增加(noteOpen 之后):

```tsx
const [noteFriendId, setNoteFriendId] = useState<string | undefined>(undefined)
const [dismissals, setDismissals] = useState<Record<string, string>>({})
```

挂载时读忽略表(放在现有 pullAll useEffect 之后,单独 effect):

```tsx
// 忽略表是 client-only localStorage 状态,SSR 期不存在,无渲染期替代方案
useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setDismissals(getDismissals())
}, [])
```

3. 渲染前计算(组件体内,return 之前):

```tsx
const insights = filterDismissed(generateFriendInsights(friends), dismissals)
const hasUrgent = insights.some(i => i.priority === 3)
```

4. 导航标题加未读点——把现有 `✦ 友记` 的 span 内容改为:

```tsx
<span style={{ position:'relative', color: gold.base, fontFamily: font.hand,
  fontSize: fs.title, letterSpacing:4 }}>
  ✦ 友记
  {hasUrgent && <span style={{
    position:'absolute', top:2, right:-12, width:8, height:8,
    borderRadius: radius.pill, background: gold.base,
    boxShadow:`0 0 6px ${gold.base}`,
  }} />}
</span>
```

5. InsightPanel 调用处改为:

```tsx
{!focusedFriendId && (
  <InsightPanel
    insights={insights}
    onSelectFriend={id => { setSelectedFriendId(id); setFocusedFriendId(id) }}
    onQuickNote={id => { setNoteFriendId(id); setNoteOpen(true) }}
    onDismiss={ins => setDismissals(dismissSignal(ins.id, ins.fingerprint))}
  />
)}
```

6. 导航「✎ 记一笔」按钮 onClick 改为 `() => { setNoteFriendId(undefined); setNoteOpen(true) }`;
   `QuickNoteOverlay` 增加 prop `defaultFriendId={noteFriendId}`。

- [ ] **Step 2: 门禁**

Run: `npx vitest run` → 全 PASS;`npm run lint` → 只剩存量四项;`npm run build` → 成功。

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire signal reminders into home with unread dot and quick-note preselect"
```

---

### Task 6: 端到端验证收尾

- [ ] **Step 1: 全量门禁**

Run: `npx vitest run && npm run lint && npm run build`
Expected: 测试全过;lint 只剩存量;构建成功。

- [ ] **Step 2: 真实界面验证(verify 技能,无需 mock AI——本期不新增 AI 调用)**

种子数据:好友 A 生日=今天、好友 B `relationshipGoal:'deepen'` 且最新记录 40 天前。驱动:

1. 进入星图 → 面板显示「今天必看」(A 生日)与「值得留意」(B goal-drift);
   导航「✦ 友记」右上有金色未读点。
2. A 生日行没有「知道了」按钮;B 行点「知道了」→ 即时消失;刷新页面 → 仍不出现。
3. 给 B 快记一条(走「记一笔」行动按钮 → QuickNoteOverlay 应预选 B 直达记录步)
   → 保存后 goal-drift 条件消失;面板出现 B 的 recent-memory 信号(新指纹,未被忽略)。
4. 移动端 375px:胶囊「✦ 星语提醒 · n」、展开分组、未读点可见。
5. 留存截图。

- [ ] **Step 3: 有问题修复后重跑 Step 1,全绿结束**
