# PWA 完全体(第四期)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手写 Service Worker 让已安装的友记断网全功能可用;设置页安装引导;紧急提醒的应用角标;快记成功轻震动。

**Architecture:** `public/sw.js` 经典脚本(缓存优先 static、网络优先导航、SWR 其余同源 GET、放行 /api 与跨域);`components/PwaSetup.tsx` 挂 layout 负责注册与 `beforeinstallprompt` 捕获(模块级导出 getInstallPrompt/promptInstall);`components/InstallPanel.tsx` 设置页三态安装面板;`lib/appBadge.ts` 特性检测角标;HomePage/QuickNoteOverlay 各一行接线。

**Tech Stack:** Next.js 16 App Router、React 19、Vitest + Testing Library、原生 Service Worker API(零新依赖)。

**注意:** AGENTS.md 要求写代码前查 `node_modules/next/dist/docs/`。本计划只用库中已在用的 API;`public/` 静态文件由 next 原样伺服(`/sw.js` 根作用域)。遇到行为差异先查 `node_modules/next/dist/docs/01-app/`。

Spec: `docs/superpowers/specs/2026-07-28-pwa-offline-design.md`

---

### Task 1: `lib/appBadge.ts` 应用角标

**Files:**
- Create: `lib/appBadge.ts`
- Test: `lib/appBadge.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `lib/appBadge.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { updateAppBadge } from './appBadge'

afterEach(() => {
  // @ts-expect-error 清理测试挂上去的 API
  delete navigator.setAppBadge
  // @ts-expect-error 同上
  delete navigator.clearAppBadge
})

describe('updateAppBadge', () => {
  it('count>0 时调用 setAppBadge', () => {
    const set = vi.fn().mockResolvedValue(undefined)
    const clear = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { setAppBadge: set, clearAppBadge: clear })
    updateAppBadge(3)
    expect(set).toHaveBeenCalledWith(3)
    expect(clear).not.toHaveBeenCalled()
  })

  it('count=0 时调用 clearAppBadge', () => {
    const set = vi.fn().mockResolvedValue(undefined)
    const clear = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { setAppBadge: set, clearAppBadge: clear })
    updateAppBadge(0)
    expect(clear).toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
  })

  it('不支持 Badging API 时不抛错', () => {
    expect(() => updateAppBadge(5)).not.toThrow()
  })

  it('API 抛错时静默', () => {
    Object.assign(navigator, {
      setAppBadge: vi.fn(() => { throw new Error('nope') }),
      clearAppBadge: vi.fn(),
    })
    expect(() => updateAppBadge(2)).not.toThrow()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/appBadge.test.ts`
Expected: FAIL — 找不到模块

- [ ] **Step 3: 实现**

创建 `lib/appBadge.ts`:

```ts
// 已安装 PWA 的图标角标:显示「今天必看」级信号数。特性检测,不支持/出错一律静默。
export function updateAppBadge(count: number): void {
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    if (count > 0) {
      void nav.setAppBadge?.(count)?.catch?.(() => {})
    } else {
      void nav.clearAppBadge?.()?.catch?.(() => {})
    }
  } catch { /* 静默 */ }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/appBadge.test.ts`
Expected: PASS(4 个用例)

- [ ] **Step 5: Commit**

```bash
git add lib/appBadge.ts lib/appBadge.test.ts
git commit -m "feat: add app badge helper with feature detection"
```

---

### Task 2: `public/sw.js` Service Worker

**Files:**
- Create: `public/sw.js`

(SW 在 jsdom 无法单测,本任务无测试文件;验证靠语法检查与 Task 6 E2E。)

- [ ] **Step 1: 实现**

创建 `public/sw.js`:

```js
// 友记 Service Worker:应用外壳离线缓存。数据在 localStorage,不经过这里。
// 改动本文件时递增版本号,activate 会清掉旧缓存。
const CACHE = 'youji-v1'
const SHELL_KEY = '/'

self.addEventListener('install', () => {
  // 不预缓存清单:运行时缓存足够;立即接管,避免旧 SW 滞留
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return   // 跨域(Supabase 等)不拦
  if (url.pathname.startsWith('/api/')) return       // AI 路由永远走网络

  // 页面导航:网络优先,成功则以 '/' 为 key 存外壳;断网回退缓存外壳
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then(c => c.put(SHELL_KEY, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => caches.match(SHELL_KEY).then(hit => hit ?? Response.error()))
    )
    return
  }

  // 内容哈希静态资源:缓存优先
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then(hit => hit ?? fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {})
        }
        return res
      }))
    )
    return
  }

  // 其余同源 GET(图标、字体等):stale-while-revalidate
  event.respondWith(
    caches.match(req).then(hit => {
      const refresh = fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {})
        }
        return res
      }).catch(() => hit ?? Response.error())
      return hit ?? refresh
    })
  )
})
```

- [ ] **Step 2: 语法验证**

Run: `node --check public/sw.js`
Expected: 无输出(语法合法)

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "feat: add offline app-shell service worker"
```

---

### Task 3: `PwaSetup` 注册组件 + 安装提示捕获

**Files:**
- Create: `components/PwaSetup.tsx`
- Modify: `app/layout.tsx`
- Test: `components/PwaSetup.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `components/PwaSetup.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import PwaSetup, { getInstallPrompt, promptInstall, _resetForTest } from './PwaSetup'

const register = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  _resetForTest()
  register.mockClear()
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true, value: { register },
  })
})
afterEach(() => {
  vi.unstubAllEnvs()
  // @ts-expect-error 清理 mock
  delete navigator.serviceWorker
})

describe('PwaSetup', () => {
  it('生产环境注册 /sw.js', () => {
    vi.stubEnv('NODE_ENV', 'production')
    render(<PwaSetup />)
    expect(register).toHaveBeenCalledWith('/sw.js')
  })

  it('开发环境不注册', () => {
    vi.stubEnv('NODE_ENV', 'development')
    render(<PwaSetup />)
    expect(register).not.toHaveBeenCalled()
  })

  it('捕获 beforeinstallprompt 后 getInstallPrompt 非空并派发就绪事件', () => {
    render(<PwaSetup />)
    const readyListener = vi.fn()
    window.addEventListener('youji:install-ready', readyListener)
    const evt = new Event('beforeinstallprompt') as Event & { preventDefault: () => void }
    const pd = vi.spyOn(evt, 'preventDefault')
    window.dispatchEvent(evt)
    expect(pd).toHaveBeenCalled()
    expect(getInstallPrompt()).toBe(evt)
    expect(readyListener).toHaveBeenCalled()
    window.removeEventListener('youji:install-ready', readyListener)
  })

  it('promptInstall 走 accepted 流程并清空存量', async () => {
    render(<PwaSetup />)
    const evt = Object.assign(new Event('beforeinstallprompt'), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    window.dispatchEvent(evt)
    await expect(promptInstall()).resolves.toBe('accepted')
    expect(evt.prompt).toHaveBeenCalled()
    expect(getInstallPrompt()).toBeNull()
  })

  it('无存量事件时 promptInstall 返回 unavailable', async () => {
    await expect(promptInstall()).resolves.toBe('unavailable')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run components/PwaSetup.test.tsx`
Expected: FAIL — 找不到模块

- [ ] **Step 3: 实现**

创建 `components/PwaSetup.tsx`:

```tsx
'use client'
import { useEffect } from 'react'

// beforeinstallprompt 是 Chromium 专有事件,lib.dom 无类型
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let installPrompt: BeforeInstallPromptEvent | null = null

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return installPrompt
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const evt = installPrompt
  if (!evt) return 'unavailable'
  await evt.prompt()
  const { outcome } = await evt.userChoice
  installPrompt = null
  window.dispatchEvent(new Event('youji:install-ready')) // 状态变化,面板重查
  return outcome
}

export function _resetForTest(): void {
  installPrompt = null
}

export default function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      installPrompt = e as BeforeInstallPromptEvent
      window.dispatchEvent(new Event('youji:install-ready'))
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])
  return null
}
```

`app/layout.tsx` 修改:

```tsx
import './globals.css'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import PwaSetup from '@/components/PwaSetup'
```

body 内:

```tsx
      <body>{children}<PwaSetup /></body>
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run components/PwaSetup.test.tsx` 然后 `npx vitest run`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add components/PwaSetup.tsx components/PwaSetup.test.tsx app/layout.tsx
git commit -m "feat: register service worker and capture install prompt"
```

---

### Task 4: `InstallPanel` 设置页安装面板

**Files:**
- Create: `components/InstallPanel.tsx`
- Modify: `app/settings/page.tsx`
- Test: `components/InstallPanel.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `components/InstallPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import InstallPanel from './InstallPanel'
import * as pwa from './PwaSetup'

vi.mock('./PwaSetup', async importOriginal => ({
  ...(await importOriginal<typeof import('./PwaSetup')>()),
  getInstallPrompt: vi.fn().mockReturnValue(null),
  promptInstall: vi.fn(),
}))

function stubMatchMedia(standalone: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q: string) => ({
    matches: q.includes('display-mode') ? standalone : false,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })))
}

function stubUA(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: ua })
}

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'

beforeEach(() => {
  vi.mocked(pwa.getInstallPrompt).mockReturnValue(null)
  vi.mocked(pwa.promptInstall).mockReset()
  stubMatchMedia(false)
  stubUA(DESKTOP_UA)
})
afterEach(() => vi.unstubAllGlobals())

describe('InstallPanel', () => {
  it('standalone 模式显示已安装', () => {
    stubMatchMedia(true)
    render(<InstallPanel />)
    expect(screen.getByText(/已安装/)).toBeInTheDocument()
  })

  it('可安装时显示安装按钮并调用 promptInstall', async () => {
    vi.mocked(pwa.getInstallPrompt).mockReturnValue({} as pwa.BeforeInstallPromptEvent)
    vi.mocked(pwa.promptInstall).mockResolvedValue('accepted')
    render(<InstallPanel />)
    fireEvent.click(screen.getByText(/安装友记/))
    await waitFor(() => expect(pwa.promptInstall).toHaveBeenCalled())
    expect(screen.getByText(/已安装/)).toBeInTheDocument()
  })

  it('iOS Safari 显示两步说明', () => {
    stubUA(IOS_UA)
    render(<InstallPanel />)
    expect(screen.getByText(/添加到主屏幕/)).toBeInTheDocument()
  })

  it('其余环境显示不支持提示', () => {
    render(<InstallPanel />)
    expect(screen.getByText(/不支持安装/)).toBeInTheDocument()
  })

  it('挂载后收到 install-ready 事件切换为可安装', () => {
    render(<InstallPanel />)
    expect(screen.getByText(/不支持安装/)).toBeInTheDocument()
    vi.mocked(pwa.getInstallPrompt).mockReturnValue({} as pwa.BeforeInstallPromptEvent)
    act(() => { window.dispatchEvent(new Event('youji:install-ready')) })
    expect(screen.getByText(/安装友记/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run components/InstallPanel.test.tsx`
Expected: FAIL — 找不到模块

- [ ] **Step 3: 实现**

创建 `components/InstallPanel.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { getInstallPrompt, promptInstall } from './PwaSetup'
import { fs, text, gold, border, radius, purple } from '@/lib/ui/tokens'

type InstallState = 'standalone' | 'installable' | 'ios' | 'unsupported'

function detectState(): InstallState {
  if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone'
  if (getInstallPrompt()) return 'installable'
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios'
  return 'unsupported'
}

export default function InstallPanel() {
  const [state, setState] = useState<InstallState>('unsupported')

  useEffect(() => {
    // 安装状态是 client-only 环境探测,SSR 期无法得知
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(detectState())
    const onReady = () => setState(detectState())
    window.addEventListener('youji:install-ready', onReady)
    return () => window.removeEventListener('youji:install-ready', onReady)
  }, [])

  async function install() {
    const outcome = await promptInstall()
    if (outcome === 'accepted') setState('standalone')
  }

  if (state === 'standalone') {
    return <p style={{ color: text.primary, fontSize: fs.sub, lineHeight: 2 }}>已安装,正以独立应用运行 ✓</p>
  }
  if (state === 'installable') {
    return (
      <button type="button" onClick={install} style={{
        color: gold.base, fontSize: fs.sub, letterSpacing: 2,
        border: `1px solid ${border.gold}`, borderRadius: radius.pill,
        padding: '10px 18px', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
      }}>⊕ 安装友记</button>
    )
  }
  if (state === 'ios') {
    return (
      <p style={{ color: text.primary, fontSize: fs.sub, lineHeight: 2 }}>
        1. 点浏览器底部 分享 按钮<br />2. 选择「添加到主屏幕」
      </p>
    )
  }
  return <p style={{ color: purple.muted, fontSize: fs.sub, lineHeight: 2 }}>当前浏览器不支持安装,可直接收藏本页。</p>
}
```

`app/settings/page.tsx` 修改:import 增加 `import InstallPanel from '@/components/InstallPanel'`;
在「云端备份」section 之后、「AI 使用成本参考」之前插入:

```tsx
        <section style={section}>
          <div style={sectionTitle}>✦ 安装到主屏</div>
          <InstallPanel />
        </section>
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run components/InstallPanel.test.tsx` 然后 `npx vitest run`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add components/InstallPanel.tsx components/InstallPanel.test.tsx app/settings/page.tsx
git commit -m "feat: add install-to-home panel in settings"
```

---

### Task 5: 角标与震动接线

**Files:**
- Modify: `app/page.tsx`(角标)
- Modify: `components/QuickNoteOverlay.tsx`(震动)
- Modify: `components/QuickNoteOverlay.test.tsx`(震动用例)

- [ ] **Step 1: 写失败测试(震动)**

`components/QuickNoteOverlay.test.tsx` 追加(放在「保存走降级并回调 onSaved」之后):

```tsx
it('保存成功触发轻震动(支持时)', async () => {
  const vibrate = vi.fn()
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate })
  const { onSaved } = setup({ defaultFriendId: 'a' })
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '试试震动' } })
  fireEvent.click(screen.getByText('保存'))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(vibrate).toHaveBeenCalledWith(10)
  // @ts-expect-error 清理
  delete navigator.vibrate
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run components/QuickNoteOverlay.test.tsx`
Expected: 新用例 FAIL

- [ ] **Step 3: 实现**

`components/QuickNoteOverlay.tsx` 的 `save()` 中,`onSaved(picked.id)` 之后加:

```tsx
    navigator.vibrate?.(10) // 触觉确认,不支持时为 undefined 安全跳过
```

`app/page.tsx`:import 增加 `import { updateAppBadge } from '@/lib/appBadge'`,
在 `insights`/`hasUrgent` 计算之后加 effect(与其他 effect 放一起):

```tsx
  // 已安装 PWA 的图标角标:今天必看的信号数
  const urgentCount = insights.filter(i => i.priority === 3).length
  useEffect(() => { updateAppBadge(urgentCount) }, [urgentCount])
```

(注意 hooks 顺序:该 useEffect 必须在组件顶层、早于任何条件 return——当前
HomePage 无条件 return,直接放在其他 effect 后即可。`urgentCount` 是原始数字,
依赖稳定。)

- [ ] **Step 4: 运行确认通过 + 门禁**

Run: `npx vitest run` → 全 PASS;`npm run lint` → 只剩存量四项;`npm run build` → 成功。

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/QuickNoteOverlay.tsx components/QuickNoteOverlay.test.tsx
git commit -m "feat: wire app badge and haptic feedback"
```

---

### Task 6: 端到端验证收尾(离线验收)

- [ ] **Step 1: 全量门禁**

Run: `npx vitest run && npm run lint && npm run build`
Expected: 测试全过;lint 只剩存量;构建成功。

- [ ] **Step 2: 离线 E2E(verify 技能基础上加 SW 流程)**

生产构建 + `npx next start`(SW 只在生产注册)。Playwright(msedge,
serviceWorkers 默认 allow):

1. 首次访问 `/` → 种子 localStorage 好友数据 → reload →
   等待 `navigator.serviceWorker.ready`(page.evaluate)→ 再 reload 一次让
   外壳与静态资源进缓存。
2. `context.setOffline(true)` → reload → 断言:入场/星图正常出现、好友数据渲染
   (星语提醒面板或导航可见)——外壳来自 SW 缓存。
3. 断网状态下 Ctrl+J 快记一条 → 降级标题保存成功(`/api/` 未被缓存,fetch 失败
   由客户端 5s 超时降级)。
4. `context.setOffline(false)` → 设置页 → 「安装到主屏」区块可见(headless 无
   beforeinstallprompt,断言显示 iOS 说明或不支持文案即可)。
5. 留存截图。

- [ ] **Step 3: 有问题修复后重跑 Step 1,全绿结束**
