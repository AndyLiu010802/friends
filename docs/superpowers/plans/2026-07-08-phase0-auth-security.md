# 阶段 0：认证与安全加固 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为友记加上 Supabase Auth 登录门禁：未登录者无法访问页面、无法调用 AI 路由、无法读写数据库、无法访问媒体文件；同时保持"未配置 Supabase 时纯本地模式零门槛可用"。

**Architecture:** 用 `@supabase/ssr` 把会话从 localStorage 改为 cookie 存储，使服务端（`proxy.ts` 门禁 + API 路由守卫）和客户端共享同一会话。数据库与 Storage 的硬防线由 RLS `to authenticated` 策略和私有桶承担；媒体从"存公开 URL"改为"存 storage 路径 + 渲染时换签名 URL"（带内存缓存），旧数据的公开 URL 自动提取路径兼容。

**Tech Stack:** Next.js 16（注意：`middleware` 已改名 `proxy.ts`，见 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`）、@supabase/ssr、@supabase/supabase-js v2、Vitest + Testing Library（jsdom；服务端测试文件用 `// @vitest-environment node`）。

**关键约定（全计划通用）：**

- 双模式行为：`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` 未配置 = 本地模式，一切放行；已配置 = 云端模式，处处要求登录。
- 测试命令统一为 `npx vitest run <file>`，全量为 `npm test`。
- 每个 Task 结束提交一次 git commit。

**人工步骤（代码完成后由用户在 Supabase 控制台执行，见 Task 11 的 README）：**

1. SQL Editor 重新执行更新后的 `supabase-schema.sql`。
2. Authentication → Sign In / Up → 关闭 "Allow new users to sign up"。
3. Authentication → Users → Add user，手动创建唯一账号（邮箱 + 密码）。

---

### Task 1: 安装 @supabase/ssr 并确认基线

**Files:**
- Modify: `package.json`（由 npm 自动改）

- [ ] **Step 1: 安装依赖**

Run: `npm install @supabase/ssr`
Expected: package.json dependencies 中出现 `"@supabase/ssr"`。

- [ ] **Step 2: 基线测试全绿**

Run: `npm test`
Expected: 全部现有测试 PASS（记录基线，后续任何红灯都是我们引入的）。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @supabase/ssr for cookie-based auth sessions"
```

---

### Task 2: `isSupabaseConfigured()` 配置探测

**Files:**
- Create: `lib/auth/config.ts`
- Test: `lib/auth/config.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// lib/auth/config.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest'
import { isSupabaseConfigured } from './config'

afterEach(() => vi.unstubAllEnvs())

describe('isSupabaseConfigured', () => {
  it('两个环境变量都存在时返回 true', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    expect(isSupabaseConfigured()).toBe(true)
  })

  it('缺少 URL 时返回 false', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    expect(isSupabaseConfigured()).toBe(false)
  })

  it('缺少 key 时返回 false', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    expect(isSupabaseConfigured()).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run lib/auth/config.test.ts`
Expected: FAIL — 找不到模块 `./config`。

- [ ] **Step 3: 最小实现**

```ts
// lib/auth/config.ts
// 每次调用现读 env（而不是模块顶层常量），让测试可以用 vi.stubEnv 覆盖。
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run lib/auth/config.test.ts`
Expected: 3 passed。

- [ ] **Step 5: Commit**

```bash
git add lib/auth/config.ts lib/auth/config.test.ts
git commit -m "feat: add isSupabaseConfigured() env probe"
```

---

### Task 3: `extractStoragePath()` 媒体路径解析（纯函数）

**Files:**
- Create: `lib/mediaPath.ts`
- Test: `lib/mediaPath.test.ts`

语义：返回 `friend-media` 桶内的 storage 路径；返回 `null` 表示"这不是我们桶里的东西，原样使用"。

- [ ] **Step 1: 写失败测试**

```ts
// lib/mediaPath.test.ts
import { describe, it, expect } from 'vitest'
import { extractStoragePath } from './mediaPath'

describe('extractStoragePath', () => {
  it('纯 storage 路径原样返回', () => {
    expect(extractStoragePath('friends/f1/portraits/123-a.jpg'))
      .toBe('friends/f1/portraits/123-a.jpg')
  })

  it('旧数据的 Supabase 公开 URL 提取出路径', () => {
    expect(extractStoragePath(
      'https://xxxx.supabase.co/storage/v1/object/public/friend-media/friends/f1/memories/m1/9-b.png'
    )).toBe('friends/f1/memories/m1/9-b.png')
  })

  it('公开 URL 中的百分号编码被还原', () => {
    expect(extractStoragePath(
      'https://xxxx.supabase.co/storage/v1/object/public/friend-media/friends/f1/portraits/1-%E7%85%A7.jpg'
    )).toBe('friends/f1/portraits/1-照.jpg')
  })

  it('外部 http(s) URL 返回 null（原样使用）', () => {
    expect(extractStoragePath('https://example.com/a.jpg')).toBeNull()
  })

  it('空字符串返回 null', () => {
    expect(extractStoragePath('')).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run lib/mediaPath.test.ts`
Expected: FAIL — 找不到模块 `./mediaPath`。

- [ ] **Step 3: 最小实现**

```ts
// lib/mediaPath.ts
const PUBLIC_URL_MARKER = '/storage/v1/object/public/friend-media/'

// 把 Media.url / thumbnailUrl 字段的历史取值统一解析为 friend-media 桶内路径。
// 返回 null 表示该值不属于我们的桶（外部 URL 或空值），应原样使用。
export function extractStoragePath(raw: string): string | null {
  if (!raw) return null
  const idx = raw.indexOf(PUBLIC_URL_MARKER)
  if (idx !== -1) return decodeURIComponent(raw.slice(idx + PUBLIC_URL_MARKER.length))
  if (/^https?:\/\//.test(raw)) return null
  return raw
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run lib/mediaPath.test.ts`
Expected: 5 passed。

- [ ] **Step 5: Commit**

```bash
git add lib/mediaPath.ts lib/mediaPath.test.ts
git commit -m "feat: add extractStoragePath for legacy media URL compatibility"
```

---

### Task 4: 签名 URL 解析器（可注入、带缓存）

**Files:**
- Create: `lib/signedUrlCache.ts`
- Test: `lib/signedUrlCache.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// lib/signedUrlCache.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createSignedUrlResolver } from './signedUrlCache'

describe('createSignedUrlResolver', () => {
  it('storage 路径换取签名 URL', async () => {
    const sign = vi.fn().mockResolvedValue('https://signed/a.jpg')
    const resolve = createSignedUrlResolver(sign)
    expect(await resolve('friends/f1/portraits/a.jpg')).toBe('https://signed/a.jpg')
    expect(sign).toHaveBeenCalledWith('friends/f1/portraits/a.jpg')
  })

  it('外部 URL 不签名，原样返回', async () => {
    const sign = vi.fn()
    const resolve = createSignedUrlResolver(sign)
    expect(await resolve('https://example.com/a.jpg')).toBe('https://example.com/a.jpg')
    expect(sign).not.toHaveBeenCalled()
  })

  it('旧公开 URL 提取路径后签名', async () => {
    const sign = vi.fn().mockResolvedValue('https://signed/b.png')
    const resolve = createSignedUrlResolver(sign)
    expect(await resolve(
      'https://xxxx.supabase.co/storage/v1/object/public/friend-media/friends/f1/b.png'
    )).toBe('https://signed/b.png')
    expect(sign).toHaveBeenCalledWith('friends/f1/b.png')
  })

  it('缓存未过期时不重复签名', async () => {
    const sign = vi.fn().mockResolvedValue('https://signed/a.jpg')
    let clock = 0
    const resolve = createSignedUrlResolver(sign, () => clock)
    await resolve('p/a.jpg')
    clock = 54 * 60 * 1000 // 54 分钟后，仍在 55 分钟有效期内
    await resolve('p/a.jpg')
    expect(sign).toHaveBeenCalledTimes(1)
  })

  it('缓存过期后重新签名', async () => {
    const sign = vi.fn().mockResolvedValue('https://signed/a.jpg')
    let clock = 0
    const resolve = createSignedUrlResolver(sign, () => clock)
    await resolve('p/a.jpg')
    clock = 56 * 60 * 1000
    await resolve('p/a.jpg')
    expect(sign).toHaveBeenCalledTimes(2)
  })

  it('签名失败（返回 null）时回退原值且不写缓存', async () => {
    const sign = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('https://signed/a.jpg')
    const resolve = createSignedUrlResolver(sign)
    expect(await resolve('p/a.jpg')).toBe('p/a.jpg')
    expect(await resolve('p/a.jpg')).toBe('https://signed/a.jpg')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run lib/signedUrlCache.test.ts`
Expected: FAIL — 找不到模块 `./signedUrlCache`。

- [ ] **Step 3: 最小实现**

```ts
// lib/signedUrlCache.ts
import { extractStoragePath } from './mediaPath'

const CACHE_TTL_MS = 55 * 60 * 1000 // 签名有效期 60 分钟，留 5 分钟余量

// sign 与 now 可注入，便于测试；生产装配见 lib/supabase.ts 的 getMediaDisplayUrl。
export function createSignedUrlResolver(
  sign: (path: string) => Promise<string | null>,
  now: () => number = Date.now
): (raw: string) => Promise<string> {
  const cache = new Map<string, { url: string; expiresAt: number }>()
  return async function resolve(raw: string): Promise<string> {
    const path = extractStoragePath(raw)
    if (!path) return raw
    const hit = cache.get(path)
    if (hit && hit.expiresAt > now()) return hit.url
    const url = await sign(path)
    if (!url) return raw
    cache.set(path, { url, expiresAt: now() + CACHE_TTL_MS })
    return url
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run lib/signedUrlCache.test.ts`
Expected: 6 passed。

- [ ] **Step 5: Commit**

```bash
git add lib/signedUrlCache.ts lib/signedUrlCache.test.ts
git commit -m "feat: add cached signed-url resolver for private media"
```

---

### Task 5: `lib/supabase.ts` 改造 — cookie 会话 + 私有桶上传

**Files:**
- Modify: `lib/supabase.ts:1-12`（客户端创建）与 `lib/supabase.ts:47-58`（uploadMedia）

此文件是薄封装（全是对 supabase client 的直传调用），行为由 Task 3/4 的单元测试和 Task 11 的构建验证覆盖，本任务不新增测试文件。

- [ ] **Step 1: 替换客户端创建方式**

把 `lib/supabase.ts` 顶部：

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
```

改为：

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
```

并把：

```ts
const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null
```

改为：

```ts
// createBrowserClient 把会话写入 cookie（而非 localStorage），
// 使 proxy.ts 门禁和 API 路由能在服务端读到登录态。
const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createBrowserClient(supabaseUrl, supabaseAnonKey) : null
```

- [ ] **Step 2: uploadMedia 改为返回 storage 路径，并追加 getMediaDisplayUrl**

把 `uploadMedia` 函数末尾：

```ts
  const { data } = supabase.storage.from('friend-media').getPublicUrl(path)
  return { url: data.publicUrl, thumbnailUrl: data.publicUrl }
```

改为：

```ts
  // 桶已私有：存 storage 路径，渲染时用 getMediaDisplayUrl 换签名 URL。
  return { url: path, thumbnailUrl: path }
```

并在文件中（`uploadMedia` 之后）新增：

```ts
import { createSignedUrlResolver } from './signedUrlCache'

// 把 Media.url / thumbnailUrl（storage 路径或旧公开 URL）解析为可渲染地址。
export const getMediaDisplayUrl = createSignedUrlResolver(async path => {
  if (!supabase) return null
  const { data } = await supabase.storage.from('friend-media').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
})
```

（import 语句放到文件顶部与其他 import 并列。）

- [ ] **Step 3: 全量测试 + 类型检查**

Run: `npm test`（应全绿）
Run: `npx tsc --noEmit`
Expected: 无类型错误。

- [ ] **Step 4: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat: cookie-based supabase sessions and private-bucket media paths"
```

---

### Task 6: `MediaItem` 组件 — 渲染时解析签名 URL

**Files:**
- Create: `components/MediaItem.tsx`
- Test: `components/MediaItem.test.tsx`
- Modify: `components/MemoryTimeline.tsx:122-127`

- [ ] **Step 1: 写失败测试**

```tsx
// components/MediaItem.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MediaItem from './MediaItem'
import type { Media } from '@/lib/types'

vi.mock('@/lib/supabase', () => ({
  getMediaDisplayUrl: vi.fn(async (raw: string) => `https://signed/${raw}`),
}))

const photo: Media = {
  id: 'm1', type: 'photo', url: 'p/full.jpg', thumbnailUrl: 'p/thumb.jpg',
  caption: '合照', size: 100,
}
const video: Media = {
  id: 'm2', type: 'video', url: 'p/clip.mp4', thumbnailUrl: 'p/clip.jpg',
  caption: '', size: 100,
}

describe('MediaItem', () => {
  it('照片用缩略图路径换签名 URL 渲染 img', async () => {
    render(<MediaItem media={photo} />)
    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', 'https://signed/p/thumb.jpg')
    expect(img).toHaveAttribute('alt', '合照')
  })

  it('视频用完整路径换签名 URL 渲染 video', async () => {
    const { container } = render(<MediaItem media={video} />)
    await vi.waitFor(() => {
      const v = container.querySelector('video')
      expect(v).not.toBeNull()
      expect(v).toHaveAttribute('src', 'https://signed/p/clip.mp4')
    })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run components/MediaItem.test.tsx`
Expected: FAIL — 找不到模块 `./MediaItem`。

- [ ] **Step 3: 实现组件**

```tsx
// components/MediaItem.tsx
'use client'
import { useEffect, useState } from 'react'
import { getMediaDisplayUrl } from '@/lib/supabase'
import type { Media } from '@/lib/types'

export default function MediaItem({ media }: { media: Media }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let cancelled = false
    const raw = media.type === 'photo' ? media.thumbnailUrl : media.url
    getMediaDisplayUrl(raw).then(u => { if (!cancelled) setSrc(u) })
    return () => { cancelled = true }
  }, [media])

  if (!src) return <div style={{ width:'100%', height:'100%' }} />
  return media.type === 'photo'
    ? <img src={src} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt={media.caption}/>
    : <video src={src} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted/>
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run components/MediaItem.test.tsx`
Expected: 2 passed。

- [ ] **Step 5: 接入 MemoryTimeline**

`components/MemoryTimeline.tsx` 中把：

```tsx
                {m.media.map(md => (
                  <div key={md.id} style={{ width:60, height:60, borderRadius:6, overflow:'hidden', background:'rgba(255,255,255,0.05)' }}>
                    {md.type==='photo'
                      ? <img src={md.thumbnailUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt={md.caption}/>
                      : <video src={md.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted/>}
                  </div>
                ))}
```

改为：

```tsx
                {m.media.map(md => (
                  <div key={md.id} style={{ width:60, height:60, borderRadius:6, overflow:'hidden', background:'rgba(255,255,255,0.05)' }}>
                    <MediaItem media={md} />
                  </div>
                ))}
```

并在文件顶部 import 区加入：

```tsx
import MediaItem from './MediaItem'
```

- [ ] **Step 6: 全量测试**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 7: Commit**

```bash
git add components/MediaItem.tsx components/MediaItem.test.tsx components/MemoryTimeline.tsx
git commit -m "feat: resolve media through signed URLs in memory timeline"
```

---

### Task 7: 登录页 `/login`

**Files:**
- Create: `app/login/page.tsx`
- Test: `app/login/page.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// app/login/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LoginPage from './page'
import { isSupabaseConfigured } from '@/lib/auth/config'

const signInWithPassword = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...a: unknown[]) => signInWithPassword(...a) } },
}))
vi.mock('@/lib/auth/config', () => ({ isSupabaseConfigured: vi.fn() }))

beforeEach(() => {
  signInWithPassword.mockReset()
  vi.mocked(isSupabaseConfigured).mockReturnValue(true)
})

describe('LoginPage', () => {
  it('未配置 Supabase 时显示本地模式提示', () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    render(<LoginPage />)
    expect(screen.getByText(/本地模式，无需登录/)).toBeInTheDocument()
  })

  it('提交时以邮箱密码调用 signInWithPassword', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'pw123456' } })
    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    await vi.waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.c', password: 'pw123456' })
    )
  })

  it('登录失败时展示错误信息', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    expect(await screen.findByText(/登录失败/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run app/login/page.test.tsx`
Expected: FAIL — 找不到模块 `./page`。

- [ ] **Step 3: 实现登录页**

```tsx
// app/login/page.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { isSupabaseConfigured } from '@/lib/auth/config'

const wrap: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24, background: 'radial-gradient(ellipse at 20% 30%, #0d1b4b 0%, #020408 70%)',
}
const card: React.CSSProperties = {
  width: '100%', maxWidth: 360, padding: '32px 28px', borderRadius: 14,
  background: 'rgba(226,185,111,0.04)', border: '1px solid rgba(226,185,111,0.15)',
}
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', marginTop: 6, borderRadius: 8,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(226,185,111,0.2)',
  color: '#e2e8f0', fontSize: 13,
}
const label: React.CSSProperties = {
  display: 'block', color: 'rgba(226,185,111,0.6)', fontSize: 10, letterSpacing: 3, marginBottom: 14,
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isSupabaseConfigured()) {
    return (
      <main style={wrap}>
        <div style={card}>
          <h1 style={{ color: '#e2b96f', fontFamily: 'Ma Shan Zheng, cursive', fontSize: 26, letterSpacing: 4, marginBottom: 16 }}>✦ 友记</h1>
          <p style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 2, marginBottom: 16 }}>当前为本地模式，无需登录。</p>
          <Link href="/" style={{ color: '#e2b96f', fontSize: 12, letterSpacing: 1 }}>进入星图 →</Link>
        </div>
      </main>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || busy) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (err) {
      setError('登录失败：邮箱或密码不正确。')
      return
    }
    // 整页跳转（而非客户端路由），让 proxy 门禁读到新写入的会话 cookie。
    window.location.replace('/')
  }

  return (
    <main style={wrap}>
      <form style={card} onSubmit={handleSubmit}>
        <h1 style={{ color: '#e2b96f', fontFamily: 'Ma Shan Zheng, cursive', fontSize: 26, letterSpacing: 4, marginBottom: 20 }}>✦ 友记</h1>
        <label style={label}>邮箱
          <input style={inp} type="email" value={email} autoComplete="email"
            onChange={e => setEmail(e.target.value)} required />
        </label>
        <label style={label}>密码
          <input style={inp} type="password" value={password} autoComplete="current-password"
            onChange={e => setPassword(e.target.value)} required />
        </label>
        {error && <p style={{ color: 'rgba(252,165,165,0.9)', fontSize: 11, marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{
          width: '100%', padding: '10px 0', borderRadius: 8, cursor: 'pointer',
          background: 'rgba(226,185,111,0.12)', border: '1px solid rgba(226,185,111,0.4)',
          color: '#e2b96f', fontSize: 13, letterSpacing: 4,
        }}>{busy ? '登录中…' : '登录'}</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run app/login/page.test.tsx`
Expected: 3 passed（jsdom 对 `window.location.replace` 会打印 "Not implemented: navigation" 警告，属预期，非失败）。

- [ ] **Step 5: Commit**

```bash
git add app/login/page.tsx app/login/page.test.tsx
git commit -m "feat: add /login page with supabase password sign-in"
```

---

### Task 8: `proxy.ts` 全站门禁

**Files:**
- Create: `proxy.ts`（项目根目录，与 `app/` 同级）
- Test: `proxy.test.ts`

注意：这个 Next.js 版本中 `middleware.ts` 已废弃改名 `proxy.ts`，导出函数名为 `proxy`。

- [ ] **Step 1: 写失败测试**

```ts
// proxy.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { unstable_doesProxyMatch, getRedirectUrl } from 'next/experimental/testing/server'

const getUser = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}))

import { proxy, config } from './proxy'

function req(path: string) {
  return new NextRequest(new URL(path, 'https://youji.test'))
}

beforeEach(() => {
  getUser.mockReset()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
})
afterEach(() => vi.unstubAllEnvs())

describe('matcher', () => {
  it('静态资源不经过门禁，页面与 API 经过', () => {
    const nextConfig = {}
    expect(unstable_doesProxyMatch({ config, nextConfig, url: '/_next/static/a.js' })).toBe(false)
    expect(unstable_doesProxyMatch({ config, nextConfig, url: '/' })).toBe(true)
    expect(unstable_doesProxyMatch({ config, nextConfig, url: '/api/ai/ask-atlas' })).toBe(true)
    expect(unstable_doesProxyMatch({ config, nextConfig, url: '/login' })).toBe(true)
  })
})

describe('proxy', () => {
  it('未配置 Supabase（本地模式）时放行', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const res = await proxy(req('/'))
    expect(res.headers.get('x-middleware-next')).toBe('1')
    expect(getUser).not.toHaveBeenCalled()
  })

  it('未登录访问页面 → 重定向 /login', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await proxy(req('/friend/new'))
    expect(getRedirectUrl(res)).toBe('https://youji.test/login')
  })

  it('未登录调用 API → 401 JSON', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await proxy(req('/api/ai/ask-atlas'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  it('未登录访问 /login → 放行', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await proxy(req('/login'))
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('已登录访问页面 → 放行', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await proxy(req('/'))
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('已登录访问 /login → 重定向回星图', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await proxy(req('/login'))
    expect(getRedirectUrl(res)).toBe('https://youji.test/')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run proxy.test.ts`
Expected: FAIL — 找不到模块 `./proxy`。

- [ ] **Step 3: 实现 proxy**

```ts
// proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // 本地模式：未配置 Supabase 时无认证概念，全部放行。
  if (!url || !key) return NextResponse.next()

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => {}, // 门禁只读会话；token 刷新由浏览器端 client 负责
    },
  })
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isLogin = pathname === '/login'

  if (user) {
    return isLogin ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next()
  }
  if (isLogin) return NextResponse.next()
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: '未登录，请先登录。' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run proxy.test.ts`
Expected: 7 passed。

- [ ] **Step 5: Commit**

```bash
git add proxy.ts proxy.test.ts
git commit -m "feat: add auth gate proxy redirecting anonymous visitors to /login"
```

---

### Task 9: AI 路由内层守卫（纵深防御）

**Files:**
- Create: `lib/auth/verifyRequest.ts`
- Test: `lib/auth/verifyRequest.test.ts`
- Modify: `app/api/ai/ask-atlas/route.ts:22`、`app/api/ai/generate-atlas/route.ts:26`
- Test: `app/api/ai/ask-atlas/route.test.ts`

文档明示 proxy 的 matcher 变更可能悄悄漏掉路由，"Always verify authentication inside each Server Function rather than relying on Proxy alone"，故路由内再验一次。

- [ ] **Step 1: 写 verifyRequest 失败测试**

```ts
// lib/auth/verifyRequest.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const getUser = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}))

import { isAuthorized } from './verifyRequest'

const req = () => new NextRequest(new URL('/api/ai/ask-atlas', 'https://youji.test'))

beforeEach(() => {
  getUser.mockReset()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
})
afterEach(() => vi.unstubAllEnvs())

describe('isAuthorized', () => {
  it('本地模式（未配置）放行', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(await isAuthorized(req())).toBe(true)
    expect(getUser).not.toHaveBeenCalled()
  })

  it('有登录用户时放行', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    expect(await isAuthorized(req())).toBe(true)
  })

  it('无登录用户时拒绝', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect(await isAuthorized(req())).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run lib/auth/verifyRequest.test.ts`
Expected: FAIL — 找不到模块 `./verifyRequest`。

- [ ] **Step 3: 实现 verifyRequest**

```ts
// lib/auth/verifyRequest.ts
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// API 路由内层守卫：proxy 之外的第二道防线（matcher 疏漏时兜底）。
export async function isAuthorized(req: NextRequest): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return true // 本地模式

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: () => {},
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  return user !== null
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run lib/auth/verifyRequest.test.ts`
Expected: 3 passed。

- [ ] **Step 5: 写路由级失败测试**

```ts
// app/api/ai/ask-atlas/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/verifyRequest', () => ({ isAuthorized: vi.fn() }))
vi.mock('@/lib/ai/provider', () => ({ MODEL: 'test-model', generateWithAI: vi.fn() }))

import { POST } from './route'
import { isAuthorized } from '@/lib/auth/verifyRequest'
import { generateWithAI } from '@/lib/ai/provider'

function post(body: unknown) {
  return new NextRequest(new URL('/api/ai/ask-atlas', 'https://youji.test'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => vi.mocked(isAuthorized).mockReset())

describe('POST /api/ai/ask-atlas', () => {
  it('未授权请求返回 401 且不调用 AI', async () => {
    vi.mocked(isAuthorized).mockResolvedValue(false)
    const res = await POST(post({ context: {}, messages: [], question: 'hi' }))
    expect(res.status).toBe(401)
    expect(generateWithAI).not.toHaveBeenCalled()
  })

  it('已授权但缺参数返回 400（证明守卫在业务校验之前且不拦好人）', async () => {
    vi.mocked(isAuthorized).mockResolvedValue(true)
    const res = await POST(post({ context: null, messages: [], question: '' }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 6: 跑测试确认失败**

Run: `npx vitest run app/api/ai/ask-atlas/route.test.ts`
Expected: FAIL — 第一条用例得到 400 而非 401（守卫尚未接入）。

- [ ] **Step 7: 两个路由接入守卫**

`app/api/ai/ask-atlas/route.ts`：在 import 区加入

```ts
import { isAuthorized } from '@/lib/auth/verifyRequest'
```

并把 `export async function POST(req: NextRequest) {` 的函数体第一行改为先执行：

```ts
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ ok: false, error: '未登录，请先登录。' }, { status: 401 })
  }
```

`app/api/ai/generate-atlas/route.ts` 做完全相同的两处修改（同样的 import、同样的守卫放在 `POST` 函数体最前）。

- [ ] **Step 8: 跑测试确认通过**

Run: `npx vitest run app/api/ai/ask-atlas/route.test.ts`
Expected: 2 passed。

- [ ] **Step 9: Commit**

```bash
git add lib/auth/verifyRequest.ts lib/auth/verifyRequest.test.ts app/api/ai/ask-atlas/route.ts app/api/ai/ask-atlas/route.test.ts app/api/ai/generate-atlas/route.ts
git commit -m "feat: require authenticated session in AI API routes"
```

---

### Task 10: 数据库与 Storage 策略收紧（schema SQL）

**Files:**
- Modify: `supabase-schema.sql`（整文件重写为可重复执行版本）

- [ ] **Step 1: 重写 schema**

用以下内容整体替换 `supabase-schema.sql`：

```sql
-- 友记 Supabase schema —— 可重复执行（对已有库安全）。
-- 安全模型：单用户私有应用。所有表与媒体桶仅 authenticated 角色可读写。
-- 必做的人工步骤：
--   1. Authentication → Sign In / Up → 关闭 "Allow new users to sign up"
--   2. Authentication → Users → Add user 手动创建唯一账号

create table if not exists friends (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists atlas (
  id           text primary key,
  friend_id    text not null references friends(id) on delete cascade,
  data         jsonb not null,
  generated_at timestamptz not null default now()
);

create table if not exists friend_backups (
  id text primary key,
  backup_name text not null,
  friends jsonb not null,
  atlas_list jsonb not null default '[]'::jsonb,
  ai_chats jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists atlas_chats (
  id text primary key,
  friend_id text not null references friends(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 媒体桶：私有（已存在的公开桶会被改为私有）
insert into storage.buckets (id, name, public)
values ('friend-media', 'friend-media', false)
on conflict (id) do update set public = false;

alter table friends        enable row level security;
alter table atlas          enable row level security;
alter table friend_backups enable row level security;
alter table atlas_chats    enable row level security;

-- 移除旧的 allow-all 策略
drop policy if exists "allow all" on friends;
drop policy if exists "allow all" on atlas;
drop policy if exists "allow all friend_backups" on friend_backups;
drop policy if exists "allow all atlas_chats" on atlas_chats;

-- 仅 authenticated 可读写
drop policy if exists "authenticated all friends" on friends;
create policy "authenticated all friends" on friends
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all atlas" on atlas;
create policy "authenticated all atlas" on atlas
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all friend_backups" on friend_backups;
create policy "authenticated all friend_backups" on friend_backups
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all atlas_chats" on atlas_chats;
create policy "authenticated all atlas_chats" on atlas_chats
  for all to authenticated using (true) with check (true);

-- Storage 对象策略：仅 authenticated 可操作 friend-media 桶
drop policy if exists "authenticated media all" on storage.objects;
create policy "authenticated media all" on storage.objects
  for all to authenticated
  using (bucket_id = 'friend-media')
  with check (bucket_id = 'friend-media');
```

- [ ] **Step 2: 人工验证清单（写进 commit message 供追溯，用户执行）**

用户在 Supabase SQL Editor 执行后，验证：
1. 未登录（anon key、无 Authorization 用户头）请求 `GET {SUPABASE_URL}/rest/v1/friends?select=id` 返回空数组 `[]`（RLS 生效，匿名不可见）。
2. 旧公开媒体 URL 直接访问返回 400/403（桶已私有）。
3. 网页登录后好友数据仍可正常同步、图片正常显示（走签名 URL）。

- [ ] **Step 3: Commit**

```bash
git add supabase-schema.sql
git commit -m "feat: lock down RLS to authenticated role and make media bucket private"
```

---

### Task 11: 设置页账号区 + README 收尾 + 全量回归

**Files:**
- Create: `components/AccountPanel.tsx`
- Test: `components/AccountPanel.test.tsx`
- Modify: `app/settings/page.tsx:17-25`
- Modify: `README.md`

- [ ] **Step 1: 写 AccountPanel 失败测试**

```tsx
// components/AccountPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AccountPanel from './AccountPanel'
import { isSupabaseConfigured } from '@/lib/auth/config'

const getUser = vi.fn()
const signOut = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...a: unknown[]) => getUser(...a),
      signOut: (...a: unknown[]) => signOut(...a),
    },
  },
}))
vi.mock('@/lib/auth/config', () => ({ isSupabaseConfigured: vi.fn() }))

beforeEach(() => {
  getUser.mockReset()
  signOut.mockReset()
  vi.mocked(isSupabaseConfigured).mockReturnValue(true)
  getUser.mockResolvedValue({ data: { user: { email: 'me@youji.app' } } })
  signOut.mockResolvedValue({ error: null })
})

describe('AccountPanel', () => {
  it('未配置 Supabase 时显示本地模式说明', () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    render(<AccountPanel />)
    expect(screen.getByText(/本地模式/)).toBeInTheDocument()
  })

  it('显示当前登录邮箱', async () => {
    render(<AccountPanel />)
    expect(await screen.findByText(/me@youji\.app/)).toBeInTheDocument()
  })

  it('点击退出登录调用 signOut', async () => {
    render(<AccountPanel />)
    fireEvent.click(await screen.findByRole('button', { name: '退出登录' }))
    await vi.waitFor(() => expect(signOut).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run components/AccountPanel.test.tsx`
Expected: FAIL — 找不到模块 `./AccountPanel`。

- [ ] **Step 3: 实现 AccountPanel**

```tsx
// components/AccountPanel.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isSupabaseConfigured } from '@/lib/auth/config'

export default function AccountPanel() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  if (!isSupabaseConfigured()) {
    return <p style={{ color: '#e2e8f0', fontSize: 12 }}>本地模式，未启用云端账号。</p>
  }

  async function logout() {
    await supabase?.auth.signOut()
    window.location.replace('/login')
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: '#e2e8f0', fontSize: 12 }}>
        {email ? `已登录：${email}` : '未登录'}
      </span>
      <button type="button" onClick={logout} style={{
        padding: '6px 14px', background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(226,185,111,0.2)', borderRadius: 8,
        color: 'rgba(226,185,111,0.7)', fontSize: 11, letterSpacing: 1, cursor: 'pointer',
      }}>退出登录</button>
    </div>
  )
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run components/AccountPanel.test.tsx`
Expected: 3 passed。

- [ ] **Step 5: 接入设置页**

`app/settings/page.tsx`：import 区加入

```tsx
import AccountPanel from '@/components/AccountPanel'
```

在 `<h1 …>设置</h1>` 之后、`✦ 云端备份` section 之前插入：

```tsx
        <section style={{
          background: 'rgba(226,185,111,0.04)', border: '1px solid rgba(226,185,111,0.15)',
          borderRadius: 14, padding: '20px 24px', marginBottom: 24,
        }}>
          <div style={{ color: 'rgba(226,185,111,0.6)', fontSize: 10, letterSpacing: 3, marginBottom: 16 }}>✦ 账号</div>
          <AccountPanel />
        </section>
```

- [ ] **Step 6: 更新 README**

README「Optional: Supabase cloud sync」一节：

1. 删掉末尾整段 `Note: the shipped RLS policy is "allow all" …`。
2. 在第 3 步（.env.local）之后追加：

```markdown
4. Enable auth: in the Supabase dashboard go to Authentication → Sign In / Up and
   turn **off** "Allow new users to sign up", then under Authentication → Users use
   **Add user** to create your single personal account (email + password).
5. Re-run `supabase-schema.sql` any time you pull schema changes — it is idempotent
   and will tighten existing databases (private media bucket, authenticated-only RLS).

With Supabase configured, the app requires signing in at `/login`; without it, the
app stays in local-only mode with no login. Media files live in a private bucket and
are served through short-lived signed URLs.
```

- [ ] **Step 7: 全量回归 + 构建**

Run: `npm test`
Expected: 全绿。
Run: `npm run build`
Expected: 构建成功，无类型错误；输出中出现 proxy（门禁被识别）。

- [ ] **Step 8: Commit**

```bash
git add components/AccountPanel.tsx components/AccountPanel.test.tsx app/settings/page.tsx README.md
git commit -m "feat: add account panel with sign-out and document auth setup"
```

---

## 自查记录

- **Spec 覆盖**：登录门禁（Task 7/8）、AI 路由鉴权（Task 9）、私有桶 + 签名 URL（Task 4/5/6/10）、RLS 收紧（Task 10）、本地模式零门槛保留（各 Task 的未配置分支）、退出登录（Task 11）。
- **占位符扫描**：无 TBD/TODO；每个代码步骤均含完整代码。
- **类型一致性**：`isSupabaseConfigured`（Task 2 定义，Task 7/11 使用）、`extractStoragePath`（Task 3 定义，Task 4 使用）、`createSignedUrlResolver`（Task 4 定义，Task 5 使用）、`getMediaDisplayUrl`（Task 5 定义，Task 6 使用）、`isAuthorized`（Task 9 定义与使用）命名与签名一致。
