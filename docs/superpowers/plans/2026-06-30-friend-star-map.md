# 朋友星图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal friend-book web app where each friend is a unique glowing star in an explorable 3D star map.

**Architecture:** Next.js 14 App Router + Three.js star map on the home route; friend data stored in localStorage with Supabase as cloud backup; star appearance derived deterministically from MBTI + zodiac.

**Tech Stack:** Next.js 14, TypeScript, Three.js r134, GSAP 3, Supabase JS v2, Tailwind CSS, Vitest

---

## File Map

```
友记/
├── app/
│   ├── layout.tsx               # Root layout, fonts, global CSS
│   ├── page.tsx                 # Entry: orrery → star map
│   ├── friend/
│   │   ├── new/page.tsx         # New friend form
│   │   └── [friendId]/page.tsx  # Edit friend form
│   └── atlas/
│       └── [friendId]/page.tsx  # Atlas report page
├── components/
│   ├── StarMap/
│   │   ├── StarMap.tsx          # Three.js canvas wrapper
│   │   ├── scene.ts             # Three.js scene singleton
│   │   ├── starfield.ts         # Background star points
│   │   ├── StarBuilder.ts       # StarConfig → Three.js objects
│   │   ├── constellationLines.ts# Relationship lines
│   │   ├── mouseTrail.ts        # Moon fragment 2D canvas trail
│   │   └── OrreryEntry.tsx      # Spinning dial entry animation
│   ├── FriendCard.tsx           # Hover tooltip popup
│   ├── FriendForm.tsx           # New/edit friend form
│   ├── MemoryTimeline.tsx       # Activity records list
│   └── MediaUpload.tsx          # Photo/video upload
├── lib/
│   ├── types.ts                 # All TypeScript interfaces
│   ├── starGen.ts               # MBTI + zodiac → StarConfig
│   ├── zodiac.ts                # Birthday → zodiac string
│   ├── poissonDisk.ts           # Poisson disk placement
│   ├── store.ts                 # localStorage read/write
│   └── supabase.ts              # Supabase client + sync helpers
└── styles/
    └── globals.css              # CSS vars, fonts, base styles
```

---

## Phase 1 — Foundation

### Task 1: Init Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`

- [ ] **Step 1: Scaffold**

```bash
cd "C:/Users/andyl/友记"
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

- [ ] **Step 2: Install runtime deps**

```bash
npm install three@0.134.0 gsap@3.12.2 @supabase/supabase-js@2
npm install -D @types/three vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Add vitest config** — create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

- [ ] **Step 4: Create `vitest.setup.ts`**:

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to `package.json`** — add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify**

```bash
npm run dev
```

Expected: Next.js default page at `http://localhost:3000`

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: init Next.js project with Three.js, GSAP, Supabase"
```

---

### Task 2: Design tokens + global styles

**Files:**
- Modify: `styles/globals.css`
- Modify: `tailwind.config.ts`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace `styles/globals.css`**:

```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;700&family=Ma+Shan+Zheng&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg:        #020408;
  --gold:      #e2b96f;
  --gold-dim:  rgba(226,185,111,0.3);
  --purple:    #9b8ec4;
  --purple-dim:rgba(155,142,196,0.5);
  --card-bg:   rgba(4,7,20,0.94);
  --card-border:rgba(226,185,111,0.3);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: var(--bg);
  color: #e2e8f0;
  font-family: 'Noto Serif SC', serif;
  overflow: hidden;
  cursor: none;
}

/* Custom cursor hidden — moon trail replaces it */
* { cursor: none !important; }
```

- [ ] **Step 2: Update `tailwind.config.ts`**:

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold:   '#e2b96f',
        'gold-dim': 'rgba(226,185,111,0.3)',
        night:  '#020408',
        purple: '#9b8ec4',
      },
      fontFamily: {
        serif:     ['Noto Serif SC', 'serif'],
        handwrite: ['Ma Shan Zheng', 'cursive'],
      },
    },
  },
}
export default config
```

- [ ] **Step 3: Update `app/layout.tsx`**:

```tsx
import '@/styles/globals.css'
import type { ReactNode } from 'react'

export const metadata = { title: '✦ 友记', description: '朋友星图' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add design tokens and global styles"
```

---

### Task 3: TypeScript types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Write `lib/types.ts`**:

```ts
export type MediaType = 'photo' | 'video'

export interface Media {
  id: string
  type: MediaType
  url: string
  thumbnailUrl: string
  caption?: string
  duration?: number   // seconds, video only
  takenAt?: string
  size: number        // bytes
}

export interface Memory {
  id: string
  date: string        // YYYY-MM-DD
  title: string
  content: string
  tags: string[]
  media: Media[]
}

export type Closeness = 1 | 2 | 3

export interface Relationship {
  friendId: string
  label: string
  closeness: Closeness
}

export type StarKind = 'radiant' | 'nebula' | 'blossom' | 'giant' | 'pulsar' | 'twin'

export interface StarConfig {
  kind: StarKind
  coreColor: string    // hex
  glowColor: string    // hex
  size: number         // 0.5–1.5
  twinkleSpeed: number // seconds per cycle
  position: [number, number, number]
}

export interface Friend {
  id: string
  name: string
  nickname?: string
  birthday: string     // YYYY-MM-DD
  zodiac: string
  mbti: string
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

export interface Atlas {
  id: string
  friendId: string
  generatedAt: string
  summary: string
  personality: string
  predictions: string
  giftIdeas: string[]
  warnings: string[]
  rawInput: Partial<Friend>
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts && git commit -m "feat: add TypeScript data model types"
```

---

### Task 4: Zodiac + star generation utilities

**Files:**
- Create: `lib/zodiac.ts`
- Create: `lib/starGen.ts`
- Create: `lib/poissonDisk.ts`
- Create: `lib/zodiac.test.ts`
- Create: `lib/starGen.test.ts`

- [ ] **Step 1: Write failing tests** — create `lib/zodiac.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getZodiac } from './zodiac'

describe('getZodiac', () => {
  it('returns 白羊座 for March 21', () => {
    expect(getZodiac('2000-03-21')).toBe('白羊座')
  })
  it('returns 双鱼座 for March 20', () => {
    expect(getZodiac('2000-03-20')).toBe('双鱼座')
  })
  it('returns 摩羯座 for December 22', () => {
    expect(getZodiac('2000-12-22')).toBe('摩羯座')
  })
  it('returns 射手座 for November 22', () => {
    expect(getZodiac('2000-11-22')).toBe('射手座')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- lib/zodiac.test.ts
```

- [ ] **Step 3: Implement `lib/zodiac.ts`**:

```ts
const SIGNS = [
  { name: '摩羯座', from: [12, 22] },
  { name: '水瓶座', from: [1,  20] },
  { name: '双鱼座', from: [2,  19] },
  { name: '白羊座', from: [3,  21] },
  { name: '金牛座', from: [4,  20] },
  { name: '双子座', from: [5,  21] },
  { name: '巨蟹座', from: [6,  21] },
  { name: '狮子座', from: [7,  23] },
  { name: '处女座', from: [8,  23] },
  { name: '天秤座', from: [9,  23] },
  { name: '天蝎座', from: [10, 23] },
  { name: '射手座', from: [11, 22] },
] as const

export function getZodiac(birthday: string): string {
  const d = new Date(birthday)
  const m = d.getMonth() + 1
  const day = d.getDate()
  for (let i = SIGNS.length - 1; i >= 0; i--) {
    const [sm, sd] = SIGNS[i].from
    if (m > sm || (m === sm && day >= sd)) return SIGNS[i].name
  }
  return '摩羯座'
}

export function getZodiacElement(zodiac: string): 'fire' | 'earth' | 'air' | 'water' {
  if (['白羊座','狮子座','射手座'].includes(zodiac)) return 'fire'
  if (['金牛座','处女座','摩羯座'].includes(zodiac)) return 'earth'
  if (['双子座','天秤座','水瓶座'].includes(zodiac)) return 'air'
  return 'water'
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- lib/zodiac.test.ts
```

- [ ] **Step 5: Write `lib/starGen.test.ts`**:

```ts
import { describe, it, expect } from 'vitest'
import { generateStarConfig } from './starGen'

describe('generateStarConfig', () => {
  it('gives radiant kind to ENFP', () => {
    const cfg = generateStarConfig('ENFP', '双子座', [], [0,0,0])
    expect(cfg.kind).toBe('radiant')
  })
  it('gives nebula kind to INFJ', () => {
    const cfg = generateStarConfig('INFJ', '双鱼座', [], [0,0,0])
    expect(cfg.kind).toBe('nebula')
  })
  it('gives fire element gold core to 白羊座', () => {
    const cfg = generateStarConfig('ENFP', '白羊座', [], [0,0,0])
    expect(cfg.coreColor).toBe('#ef4444')
  })
  it('gives water element purple core to 双鱼座', () => {
    const cfg = generateStarConfig('INFJ', '双鱼座', [], [0,0,0])
    expect(cfg.coreColor).toBe('#7c3aed')
  })
  it('uses provided position', () => {
    const cfg = generateStarConfig('ENFP', '双子座', [], [1,2,3])
    expect(cfg.position).toEqual([1,2,3])
  })
})
```

- [ ] **Step 6: Run — expect FAIL**

```bash
npm test -- lib/starGen.test.ts
```

- [ ] **Step 7: Implement `lib/starGen.ts`**:

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

export function generateStarConfig(
  mbti: string,
  zodiac: string,
  hobbies: string[],
  position: [number, number, number]
): StarConfig {
  const prefix = mbti.slice(0, 2).toUpperCase() as keyof typeof KIND_MAP
  const kind: StarKind = KIND_MAP[prefix] ?? 'radiant'
  const element = getZodiacElement(zodiac)
  const { core: coreColor, glow: glowColor } = ELEMENT_COLORS[element]

  const hasArt     = hobbies.some(h => /音乐|艺术|绘画|摄影/.test(h))
  const hasSport   = hobbies.some(h => /运动|健身|户外|爬山/.test(h))
  const isIntrovert = mbti[0].toUpperCase() === 'I'

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

- [ ] **Step 8: Run — expect PASS**

```bash
npm test -- lib/starGen.test.ts lib/zodiac.test.ts
```

- [ ] **Step 9: Create `lib/poissonDisk.ts`**:

```ts
/** Returns a random point at least `minDist` from all points in `existing`. */
export function findSafePosition(
  existing: [number, number, number][],
  minDist = 2.5,
  spread = 6,
  maxAttempts = 60
): [number, number, number] {
  for (let i = 0; i < maxAttempts; i++) {
    const radius = spread + Math.floor(i / 15) * 2
    const x = (Math.random() - 0.5) * radius * 2
    const y = (Math.random() - 0.5) * radius * 1.5
    const z = (Math.random() - 0.5) * 1.5
    const tooClose = existing.some(([ex, ey, ez]) => {
      const dx = x - ex, dy = y - ey, dz = z - ez
      return Math.sqrt(dx*dx + dy*dy + dz*dz) < minDist
    })
    if (!tooClose) return [x, y, z]
  }
  // Fallback: place far out
  const angle = Math.random() * Math.PI * 2
  return [Math.cos(angle) * (spread + 4), Math.sin(angle) * (spread + 4), 0]
}
```

- [ ] **Step 10: Commit**

```bash
git add lib/ && git commit -m "feat: add zodiac, star generation, and poisson disk utilities"
```

---

### Task 5: localStorage store

**Files:**
- Create: `lib/store.ts`
- Create: `lib/store.test.ts`

- [ ] **Step 1: Write failing tests** — create `lib/store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getFriends, saveFriend, deleteFriend } from './store'
import type { Friend } from './types'

const MOCK_FRIEND: Friend = {
  id: 'f1', name: '小雨', birthday: '1999-06-05', zodiac: '双子座',
  mbti: 'ENFP', likes: [], dislikes: [], hobbies: [],
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
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- lib/store.test.ts
```

- [ ] **Step 3: Implement `lib/store.ts`**:

```ts
import type { Friend, Atlas } from './types'

const FRIENDS_KEY = 'yj_friends'
const ATLAS_KEY   = 'yj_atlas'

export function getFriends(): Friend[] {
  try {
    return JSON.parse(localStorage.getItem(FRIENDS_KEY) ?? '[]')
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

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- lib/store.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts lib/store.test.ts && git commit -m "feat: add localStorage store with CRUD operations"
```

---

### Task 6: Supabase setup

**Files:**
- Create: `lib/supabase.ts`
- Create: `.env.local`
- Create: `supabase-schema.sql`

- [ ] **Step 1: Create Supabase project**

Go to https://supabase.com → New project → name "yj-friend-map" → note the **Project URL** and **anon key**.

- [ ] **Step 2: Create `.env.local`**:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

- [ ] **Step 3: Create `supabase-schema.sql`** and run it in Supabase SQL editor:

```sql
create table friends (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create table atlas (
  id          text primary key,
  friend_id   text not null references friends(id) on delete cascade,
  data        jsonb not null,
  generated_at timestamptz not null default now()
);

-- Storage bucket for media
insert into storage.buckets (id, name, public)
values ('friend-media', 'friend-media', true);

-- RLS: allow all for now (single-user, no auth)
alter table friends enable row level security;
alter table atlas   enable row level security;
create policy "allow all" on friends for all using (true) with check (true);
create policy "allow all" on atlas   for all using (true) with check (true);
```

- [ ] **Step 4: Create `lib/supabase.ts`**:

```ts
import { createClient } from '@supabase/supabase-js'
import type { Friend, Atlas } from './types'
import { saveFriend, saveAtlas, getFriends, getAtlasList } from './store'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function pushFriend(friend: Friend): Promise<void> {
  await supabase.from('friends').upsert({
    id: friend.id,
    data: friend,
    updated_at: new Date().toISOString(),
  })
}

export async function pushAtlas(atlas: Atlas): Promise<void> {
  await supabase.from('atlas').upsert({
    id: atlas.id,
    friend_id: atlas.friendId,
    data: atlas,
  })
}

export async function pullAll(): Promise<void> {
  const [{ data: fRows }, { data: aRows }] = await Promise.all([
    supabase.from('friends').select('data'),
    supabase.from('atlas').select('data'),
  ])
  fRows?.forEach(r => saveFriend(r.data as Friend))
  aRows?.forEach(r => saveAtlas(r.data as Atlas))
}

export async function uploadMedia(
  friendId: string,
  folder: string,
  file: File
): Promise<{ url: string; thumbnailUrl: string }> {
  const path = `friends/${friendId}/${folder}/${Date.now()}-${file.name}`
  await supabase.storage.from('friend-media').upload(path, file)
  const { data } = supabase.storage.from('friend-media').getPublicUrl(path)
  // Thumbnail: same URL (browser will scale); for video, caller provides thumb
  return { url: data.publicUrl, thumbnailUrl: data.publicUrl }
}

export { supabase }
```

- [ ] **Step 5: Commit**

```bash
git add lib/supabase.ts supabase-schema.sql .env.local && git commit -m "feat: add Supabase client and sync helpers"
```

Note: `.env.local` is in `.gitignore` — commit only `supabase-schema.sql`.

---

## Phase 2 — Star Map

### Task 7: Three.js scene + background starfield

**Files:**
- Create: `components/StarMap/scene.ts`
- Create: `components/StarMap/starfield.ts`
- Create: `components/StarMap/mouseTrail.ts`

- [ ] **Step 1: Create `components/StarMap/scene.ts`**:

```ts
import * as THREE from 'three'

let _renderer: THREE.WebGLRenderer | null = null
let _scene:    THREE.Scene | null = null
let _camera:   THREE.PerspectiveCamera | null = null
let _pivot:    THREE.Group | null = null

export function initScene(canvas: HTMLCanvasElement) {
  _renderer = new THREE.WebGLRenderer({ antialias: true, canvas })
  _renderer.setSize(window.innerWidth, window.innerHeight)
  _renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  _renderer.toneMapping = THREE.ACESFilmicToneMapping
  _renderer.toneMappingExposure = 1.3

  _scene = new THREE.Scene()
  _scene.fog = new THREE.FogExp2(0x020408, 0.018)

  _camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.01, 300)
  _camera.position.z = 9

  _pivot = new THREE.Group()
  _scene.add(_pivot)
  _scene.add(new THREE.AmbientLight(0x080820, 4))

  window.addEventListener('resize', onResize)
  return { renderer: _renderer, scene: _scene, camera: _camera, pivot: _pivot }
}

export function getScene() {
  return { renderer: _renderer!, scene: _scene!, camera: _camera!, pivot: _pivot! }
}

export function disposeScene() {
  window.removeEventListener('resize', onResize)
  _renderer?.dispose()
  _renderer = _scene = _camera = _pivot = null
}

function onResize() {
  if (!_renderer || !_camera) return
  _camera.aspect = window.innerWidth / window.innerHeight
  _camera.updateProjectionMatrix()
  _renderer.setSize(window.innerWidth, window.innerHeight)
}
```

- [ ] **Step 2: Create `components/StarMap/starfield.ts`**:

```ts
import * as THREE from 'three'

export function buildStarfield(): THREE.Points {
  const N = 1500
  const pos = new Float32Array(N * 3)
  const col = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const r = 45 + Math.random() * 80
    const t = Math.random() * Math.PI * 2
    const p = Math.acos(2 * Math.random() - 1)
    pos[i*3]   = r * Math.sin(p) * Math.cos(t)
    pos[i*3+1] = r * Math.sin(p) * Math.sin(t)
    pos[i*3+2] = r * Math.cos(p)
    const w = Math.random()
    col[i*3] = 0.7 + w * 0.3; col[i*3+1] = 0.72 + w * 0.2; col[i*3+2] = 0.88 + w * 0.12
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3))
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.05, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.45,
  }))
}
```

- [ ] **Step 3: Create `components/StarMap/mouseTrail.ts`**:

```ts
type Particle = {
  x: number; y: number; vx: number; vy: number
  size: number; angle: number; spin: number
  shape: 'crescent' | 'shard' | 'diamond' | 'ring'
  hue: number; alpha: number; life: number; decay: number
}

const particles: Particle[] = []
let moving = false
let moveTimer: ReturnType<typeof setTimeout>

export function initTrail(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight
  })
  window.addEventListener('mousemove', e => {
    spawn(e.clientX, e.clientY)
    moving = true
    clearTimeout(moveTimer)
    moveTimer = setTimeout(() => { moving = false }, 80)
  })

  let last = 0
  function loop(ts: number) {
    requestAnimationFrame(loop)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (moving && ts - last > 28) { spawn(lastX, lastY); last = ts }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x += p.vx; p.y += p.vy; p.vy += 0.04; p.angle += p.spin
      p.life -= p.decay; p.size *= 0.985
      if (p.life <= 0) { particles.splice(i, 1); continue }
      draw(ctx, p)
    }
  }
  requestAnimationFrame(loop)
}

let lastX = 0, lastY = 0
function spawn(x: number, y: number) {
  lastX = x; lastY = y
  const shapes: Particle['shape'][] = ['crescent','shard','diamond','ring']
  particles.push({
    x: x + (Math.random()-.5)*6, y: y + (Math.random()-.5)*6,
    vx: (Math.random()-.5)*1.2, vy: -0.5 - Math.random()*1.5,
    size: 4 + Math.random()*10, angle: Math.random()*Math.PI*2,
    spin: (Math.random()-.5)*0.15,
    shape: shapes[Math.floor(Math.random()*4)],
    hue: 200 + Math.random()*50,
    alpha: 0.85 + Math.random()*0.15,
    life: 1, decay: 0.022 + Math.random()*0.025,
  })
}

function draw(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save()
  ctx.translate(p.x, p.y); ctx.rotate(p.angle)
  ctx.globalAlpha = p.alpha * p.life
  const g = ctx.createRadialGradient(0,0,0,0,0,p.size*2.5)
  g.addColorStop(0, `hsla(${p.hue},80%,92%,0.4)`)
  g.addColorStop(1, `hsla(${p.hue},80%,80%,0)`)
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(0,0,p.size*2.5,0,Math.PI*2); ctx.fill()
  ctx.fillStyle = `hsla(${p.hue},70%,88%,1)`
  ctx.strokeStyle = `hsla(${p.hue},90%,96%,0.9)`
  ctx.lineWidth = 0.8; ctx.shadowColor = `hsla(${p.hue},80%,90%,0.9)`; ctx.shadowBlur = 8
  if (p.shape==='crescent') {
    ctx.beginPath(); ctx.arc(0,0,p.size,0,Math.PI*2)
    ctx.arc(p.size*.42,-p.size*.1,p.size*.72,Math.PI*2,0,true); ctx.closePath()
  } else if (p.shape==='shard') {
    ctx.beginPath(); ctx.moveTo(0,-p.size*1.4); ctx.lineTo(p.size*.3,p.size*.5); ctx.lineTo(-p.size*.25,p.size*.7); ctx.closePath()
  } else if (p.shape==='diamond') {
    ctx.beginPath(); ctx.moveTo(0,-p.size); ctx.lineTo(p.size*.45,0); ctx.lineTo(0,p.size*.7); ctx.lineTo(-p.size*.45,0); ctx.closePath()
  } else {
    ctx.beginPath(); ctx.arc(0,0,p.size,0,Math.PI*2); ctx.arc(0,0,p.size*.55,Math.PI*2,0,true); ctx.closePath()
  }
  ctx.fill(); ctx.stroke(); ctx.restore()
}
```

- [ ] **Step 4: Commit**

```bash
git add components/StarMap/ && git commit -m "feat: add Three.js scene, starfield, and mouse trail"
```

---

### Task 8: Star builder (StarConfig → Three.js objects)

**Files:**
- Create: `components/StarMap/StarBuilder.ts`

- [ ] **Step 1: Create `components/StarMap/StarBuilder.ts`**:

```ts
import * as THREE from 'three'
import { gsap } from 'gsap'
import type { Friend, StarConfig } from '@/lib/types'

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

export function buildStar(friend: Friend): StarObject {
  const { starConfig: cfg } = friend
  const root = new THREE.Group()
  root.position.set(...cfg.position)

  const hex = (h: string) => `rgb(${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)})`
  const coreRgb = hex(cfg.coreColor)
  const glowRgb = hex(cfg.glowColor)

  switch (cfg.kind) {
    case 'radiant': {
      const core = sp(burstTex(256,coreRgb,8), cfg.size*.82)
      root.add(core)
      root.add(sp(radialTex(128,[[0,`rgba(0,0,0,0)`],[.3,`${cfg.glowColor}28`],[.72,`${cfg.glowColor}10`],[1,'rgba(0,0,0,0)']]),cfg.size*1.8))
      const rot = sp(burstTex(256,glowRgb,4), cfg.size*.76, .35); root.add(rot)
      gsap.to(rot.material,{rotation:Math.PI*2, duration:18, repeat:-1, ease:'none'})
      const dg=new THREE.Group(); root.add(dg)
      const dot=sp(radialTex(64,[[0,'rgba(255,255,200,1)'],[.4,'rgba(255,200,80,0.6)'],[1,'rgba(0,0,0,0)']]),cfg.size*.16)
      dot.position.set(cfg.size*.48,0,0); dg.add(dot)
      gsap.to(dg.rotation,{z:-Math.PI*2, duration:7, repeat:-1, ease:'none'})
      gsap.to(core.material,{opacity:.72, duration:cfg.twinkleSpeed*.7, repeat:-1, yoyo:true, ease:'sine.inOut'})
      break
    }
    case 'nebula': {
      root.add(sp(radialTex(256,[[0,'rgba(255,255,255,1)'],[.06,`${cfg.coreColor}f2`],[.25,`${cfg.glowColor}80`],[.55,`${cfg.coreColor}2d`],[.82,`${cfg.coreColor}0f`],[1,'rgba(0,0,0,0)']]),cfg.size*.76))
      const h1=sp(ringTex(256,glowRgb,.11),cfg.size*1.35,.48); root.add(h1)
      gsap.to(h1.material,{rotation:Math.PI*2, duration:22, repeat:-1, ease:'none'})
      const h2=sp(ringTex(256,coreRgb,.07),cfg.size*2.0,.28); root.add(h2)
      gsap.to(h2.material,{rotation:-Math.PI*2, duration:36, repeat:-1, ease:'none'})
      gsap.to(root.children[0].material,{opacity:.65, duration:cfg.twinkleSpeed, repeat:-1, yoyo:true, ease:'sine.inOut', delay:.8})
      break
    }
    case 'blossom': {
      const core=sp(burstTex(256,coreRgb,6),cfg.size*.70); root.add(core)
      root.add(sp(radialTex(128,[[0,'rgba(253,164,175,0)'],[.4,'rgba(253,164,175,0.18)'],[.76,'rgba(251,113,133,0.07)'],[1,'rgba(0,0,0,0)']]),cfg.size*1.65))
      for(let i=0;i<5;i++){
        const ang=(i/5)*Math.PI*2, pg=new THREE.Group(); root.add(pg)
        const p=sp(radialTex(64,[[0,'rgba(255,200,210,1)'],[.4,'rgba(253,164,175,0.6)'],[1,'rgba(0,0,0,0)']]),cfg.size*.14+Math.random()*.07,.75)
        p.position.set(Math.cos(ang)*cfg.size*.42,Math.sin(ang)*cfg.size*.42,0); pg.add(p)
        gsap.to(pg.rotation,{z:-Math.PI*2, duration:8+i*1.5, repeat:-1, ease:'none'})
        gsap.to(p.material,{opacity:.18, duration:(8+i*1.5)/5, repeat:-1, yoyo:true, ease:'sine.inOut', delay:i*.3})
      }
      gsap.to(core.material,{opacity:.68, duration:cfg.twinkleSpeed, repeat:-1, yoyo:true, ease:'sine.inOut'})
      break
    }
    case 'giant': {
      root.add(sp(radialTex(256,[[0,'rgba(255,255,220,1)'],[.08,`${cfg.coreColor}f2`],[.28,`${cfg.coreColor}ad`],[.55,`${cfg.coreColor}47`],[.82,`${cfg.coreColor}17`],[1,'rgba(0,0,0,0)']]),cfg.size*.98))
      ;[[1.05,1.55,.26],[1.2,1.75,.15],[1.35,1.95,.09]].forEach(([i,o,op])=>{
        const rg=new THREE.RingGeometry(i*.75*cfg.size,o*.75*cfg.size,96)
        const rm=new THREE.MeshBasicMaterial({color:0xe2b96f,side:THREE.DoubleSide,transparent:true,opacity:op,blending:THREE.AdditiveBlending})
        const ring=new THREE.Mesh(rg,rm); ring.rotation.x=1.1; ring.rotation.z=.25; root.add(ring)
        gsap.to(ring.rotation,{z:ring.rotation.z+Math.PI*2, duration:28, repeat:-1, ease:'none'})
      })
      gsap.to(root.children[0].material,{opacity:.72, duration:cfg.twinkleSpeed, repeat:-1, yoyo:true, ease:'sine.inOut'})
      break
    }
    case 'pulsar': {
      const core=sp(burstTex(256,coreRgb,4),cfg.size*.54); root.add(core)
      root.add(sp(radialTex(128,[[0,'rgba(0,0,0,0)'],[.5,`${cfg.coreColor}1a`],[.82,`${cfg.coreColor}0a`],[1,'rgba(0,0,0,0)']]),cfg.size*1.5))
      for(let p=0;p<3;p++){
        const ring=sp(ringTex(128,glowRgb,.15),cfg.size*.45,.5); root.add(ring)
        const tl=gsap.timeline({repeat:-1,delay:p*.38})
        tl.fromTo(ring.scale,{x:.3,y:.3},{x:1.8,y:1.8,duration:1.1,ease:'power1.out'})
          .fromTo(ring.material,{opacity:.55},{opacity:0,duration:1.1,ease:'power1.out'},'<')
      }
      gsap.to(core.material,{opacity:.38, duration:cfg.twinkleSpeed*.3, repeat:-1, yoyo:true, ease:'sine.inOut'})
      break
    }
    case 'twin': {
      ;[{col:coreRgb,r:.30,spd:4.5,sz:.44},{col:glowRgb,r:.30,spd:4.5,sz:.33}].forEach((p,pi)=>{
        const og=new THREE.Group(); root.add(og)
        const star=sp(burstTex(128,p.col,6),p.sz*cfg.size)
        star.position.set(p.r*(pi===0?1:-1)*cfg.size,0,0); og.add(star)
        const gh=sp(radialTex(64,[[0,'rgba(0,0,0,0)'],[.45,'rgba(180,170,255,0.22)'],[1,'rgba(0,0,0,0)']]),p.sz*2.0*cfg.size)
        gh.position.copy(star.position); og.add(gh)
        gsap.to(og.rotation,{z:(pi===0?-1:1)*Math.PI*2, duration:p.spd*(pi===0?1:1.1), repeat:-1, ease:'none'})
        gsap.to(star.material,{opacity:.62, duration:cfg.twinkleSpeed, repeat:-1, yoyo:true, ease:'sine.inOut', delay:pi*.8})
      })
      root.add(sp(radialTex(128,[[0,'rgba(200,190,255,0.55)'],[.38,'rgba(167,139,250,0.12)'],[1,'rgba(0,0,0,0)']]),cfg.size*.75))
      break
    }
  }

  // Entrance animation
  root.scale.setScalar(0)
  gsap.to(root.scale,{x:1,y:1,z:1, duration:1.4, ease:'back.out(2)'})

  // Invisible hit sphere
  const hitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(cfg.size*.55,8,8),
    new THREE.MeshBasicMaterial({visible:false})
  )
  root.add(hitMesh)

  return { root, hitMesh, friendId: friend.id }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/StarMap/StarBuilder.ts && git commit -m "feat: add star builder — StarConfig to Three.js objects"
```

---

### Task 9: Constellation lines

**Files:**
- Create: `components/StarMap/constellationLines.ts`

- [ ] **Step 1: Create `components/StarMap/constellationLines.ts`**:

```ts
import * as THREE from 'three'
import type { Friend } from '@/lib/types'

export interface LineObject {
  line: THREE.Line
  friendAId: string
  friendBId: string
  closeness: 1 | 2 | 3
}

const OPACITY = { 1: 0.15, 2: 0.35, 3: 0.65 } as const
const WIDTH   = { 1: 1,    2: 2,    3: 3    } as const

export function buildConstellationLines(friends: Friend[]): LineObject[] {
  const objects: LineObject[] = []
  const seen = new Set<string>()

  for (const fA of friends) {
    for (const rel of fA.relationships) {
      const key = [fA.id, rel.friendId].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)

      const fB = friends.find(f => f.id === rel.friendId)
      if (!fB) continue

      const posA = new THREE.Vector3(...fA.starConfig.position)
      const posB = new THREE.Vector3(...fB.starConfig.position)

      const geo = new THREE.BufferGeometry().setFromPoints([posA, posB])
      const mat = new THREE.LineBasicMaterial({
        color: 0xe2b96f,
        transparent: true,
        opacity: OPACITY[rel.closeness],
        linewidth: WIDTH[rel.closeness],
      })
      objects.push({ line: new THREE.Line(geo, mat), friendAId: fA.id, friendBId: fB.id, closeness: rel.closeness })
    }
  }
  return objects
}

export function highlightLines(objects: LineObject[], activeFriendId: string | null) {
  for (const obj of objects) {
    const mat = obj.line.material as THREE.LineBasicMaterial
    const isActive = !activeFriendId || obj.friendAId === activeFriendId || obj.friendBId === activeFriendId
    mat.opacity = isActive ? OPACITY[obj.closeness] : 0.03
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/StarMap/constellationLines.ts && git commit -m "feat: add constellation line builder and highlight logic"
```

---

### Task 10: Orrery entry animation + StarMap React component

**Files:**
- Create: `components/StarMap/OrreryEntry.tsx`
- Create: `components/StarMap/StarMap.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `components/StarMap/OrreryEntry.tsx`**:

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

interface Props { onEnter: () => void }

export default function OrreryEntry({ onEnter }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current!
    gsap.fromTo(el, { opacity:0, scale:.8 }, { opacity:1, scale:1, duration:1.5, ease:'power2.out' })
  }, [])

  function handleClick() {
    const el = ref.current!
    gsap.to(el, { opacity:0, scale:1.4, duration:.8, ease:'power2.in', onComplete: onEnter })
  }

  return (
    <div
      ref={ref}
      onClick={handleClick}
      style={{ position:'fixed', inset:0, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', cursor:'pointer', zIndex:50 }}
    >
      {/* Orrery dial — concentric rotating rings */}
      <div style={{ position:'relative', width:220, height:220, marginBottom:32 }}>
        {[100,76,54].map((size,i) => (
          <div key={i} style={{
            position:'absolute', top:'50%', left:'50%',
            width:size, height:size,
            marginTop:-size/2, marginLeft:-size/2,
            border:`${2-i*.5}px solid rgba(226,185,111,${.5-i*.1})`,
            borderRadius:'50%',
            animation:`spin${i} ${8+i*6}s linear infinite`,
          }}/>
        ))}
        <div style={{
          position:'absolute', top:'50%', left:'50%',
          transform:'translate(-50%,-50%)',
          width:20, height:20, borderRadius:'50%',
          background:'radial-gradient(circle, #fff 0%, #e2b96f 40%, transparent 70%)',
          boxShadow:'0 0 20px #e2b96f, 0 0 60px rgba(226,185,111,0.4)',
        }}/>
      </div>

      <div style={{ color:'#e2b96f', fontFamily:'Ma Shan Zheng, cursive', fontSize:28, letterSpacing:8 }}>
        朋友笔记
      </div>
      <div style={{ color:'rgba(155,142,196,0.6)', fontSize:11, letterSpacing:3, marginTop:10 }}>
        点击打开星图
      </div>

      <style>{`
        @keyframes spin0 { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes spin1 { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
        @keyframes spin2 { from{transform:rotate(45deg)} to{transform:rotate(405deg)} }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/StarMap/StarMap.tsx`**:

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { initScene, getScene } from './scene'
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
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
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
    })

    // Raycaster for hover
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2(-99, -99)
    let isDrag = false, lx = 0, ly = 0

    const canvas = threeRef.current!
    const onMouseMove = (e: MouseEvent) => {
      mouse.x =  (e.clientX / innerWidth)  * 2 - 1
      mouse.y = -(e.clientY / innerHeight) * 2 + 1
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
        setTooltipPos({ x: e.clientX + 22, y: e.clientY - 12 })
        highlightLines(linesRef.current, star.friendId)
        gsap.to(star.root.scale, { x:1.22, y:1.22, z:1.22, duration:.3, ease:'back.out(2)' })
      } else {
        setHoveredFriend(null)
        highlightLines(linesRef.current, null)
        starsRef.current.forEach(s => gsap.to(s.root.scale, { x:1, y:1, z:1, duration:.3 }))
      }
    }
    canvas.addEventListener('mousedown', e => { isDrag=true; lx=e.clientX; ly=e.clientY })
    window.addEventListener('mouseup', () => isDrag=false)
    window.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('wheel', e => {
      camera.position.z = Math.max(3.5, Math.min(16, camera.position.z + e.deltaY * .007))
    }, { passive: true })

    // Render loop
    let raf: number
    const loop = () => { raf = requestAnimationFrame(loop); renderer.render(scene, camera) }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return (
    <>
      <canvas ref={threeRef} style={{ position:'fixed', inset:0 }} />
      <canvas ref={trailRef} style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:5 }} />
      {hoveredFriend && (
        <FriendCard
          friend={hoveredFriend}
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Create `components/FriendCard.tsx`**:

```tsx
import type { CSSProperties } from 'react'
import type { Friend } from '@/lib/types'
import Link from 'next/link'

interface Props { friend: Friend; style?: CSSProperties }

export default function FriendCard({ friend, style }: Props) {
  return (
    <div style={{
      position:'fixed', zIndex:20, minWidth:160,
      background:'rgba(4,7,20,0.94)', border:'1px solid rgba(226,185,111,0.3)',
      borderRadius:12, padding:'14px 20px',
      backdropFilter:'blur(12px)', pointerEvents:'auto',
      ...style,
    }}>
      <div style={{ color:'#e2b96f', fontSize:15, marginBottom:4 }}>{friend.name}</div>
      <div style={{ color:'rgba(155,142,196,0.75)', fontSize:10, lineHeight:1.8 }}>
        {friend.mbti} · {friend.zodiac}<br/>
        {friend.nickname ?? ''}
      </div>
      <div style={{ marginTop:10, display:'flex', gap:8 }}>
        <Link href={`/friend/${friend.id}`}
          style={{ color:'#e2b96f', fontSize:10, letterSpacing:1, textDecoration:'none',
            border:'1px solid rgba(226,185,111,0.3)', borderRadius:10, padding:'4px 10px' }}>
          编辑
        </Link>
        {friend.atlasId && (
          <Link href={`/atlas/${friend.id}`}
            style={{ color:'rgba(155,142,196,0.8)', fontSize:10, letterSpacing:1, textDecoration:'none',
              border:'1px solid rgba(155,142,196,0.3)', borderRadius:10, padding:'4px 10px' }}>
            图鉴
          </Link>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update `app/page.tsx`**:

```tsx
'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import OrreryEntry from '@/components/StarMap/OrreryEntry'

const StarMap = dynamic(() => import('@/components/StarMap/StarMap'), { ssr: false })

export default function HomePage() {
  const [entered, setEntered] = useState(false)

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
          <a href="/friend/new" style={{
            color:'#e2b96f', fontSize:11, letterSpacing:2,
            border:'1px solid rgba(226,185,111,0.35)', borderRadius:20,
            padding:'6px 16px', textDecoration:'none', pointerEvents:'auto',
          }}>✦ 新纪录</a>
        </nav>
      )}

      {!entered && <OrreryEntry onEnter={() => setEntered(true)} />}
      {entered  && <StarMap />}
    </>
  )
}
```

- [ ] **Step 5: Test visually**

```bash
npm run dev
```

Open `http://localhost:3000` — expect: spinning orrery dial → click → star map loads with empty field and mouse trail.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add orrery entry, star map canvas, friend card tooltip"
```

---

## Phase 3 — Friend CRUD

### Task 11: New friend form

**Files:**
- Create: `components/FriendForm.tsx`
- Create: `app/friend/new/page.tsx`

- [ ] **Step 1: Create `components/FriendForm.tsx`**:

```tsx
'use client'
import { useState } from 'react'
import type { Friend, Media, Relationship } from '@/lib/types'
import { getZodiac } from '@/lib/zodiac'
import { generateStarConfig } from '@/lib/starGen'
import { findSafePosition } from '@/lib/poissonDisk'
import { saveFriend, getFriends } from '@/lib/store'
import { pushFriend } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const MBTI_OPTIONS = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP']

interface Props { initial?: Friend }

export default function FriendForm({ initial }: Props) {
  const router = useRouter()
  const [name,    setName]    = useState(initial?.name ?? '')
  const [nick,    setNick]    = useState(initial?.nickname ?? '')
  const [bday,    setBday]    = useState(initial?.birthday ?? '')
  const [mbti,    setMbti]    = useState(initial?.mbti ?? '')
  const [likes,   setLikes]   = useState(initial?.likes.join(', ') ?? '')
  const [dislikes,setDislikes]= useState(initial?.dislikes.join(', ') ?? '')
  const [hobbies, setHobbies] = useState(initial?.hobbies.join(', ') ?? '')
  const [notes,   setNotes]   = useState(initial?.notes ?? '')
  const [saving,  setSaving]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !bday || !mbti) return
    setSaving(true)

    const zodiac  = getZodiac(bday)
    const existing = getFriends()
    const positions = existing
      .filter(f => f.id !== initial?.id)
      .map(f => f.starConfig.position as [number,number,number])
    const position  = initial?.starConfig.position ?? findSafePosition(positions)
    const starConfig = generateStarConfig(mbti, zodiac, hobbies.split(',').map(h=>h.trim()), position)

    const friend: Friend = {
      id:        initial?.id ?? crypto.randomUUID(),
      name, nickname: nick || undefined,
      birthday: bday, zodiac, mbti,
      likes:    likes.split(',').map(s=>s.trim()).filter(Boolean),
      dislikes: dislikes.split(',').map(s=>s.trim()).filter(Boolean),
      hobbies:  hobbies.split(',').map(s=>s.trim()).filter(Boolean),
      portraits: initial?.portraits ?? [],
      memories:  initial?.memories  ?? [],
      relationships: initial?.relationships ?? [],
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

  return (
    <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {field('名字 *', <input value={name} onChange={e=>setName(e.target.value)} required style={inputStyle}/>)}
      {field('昵称', <input value={nick} onChange={e=>setNick(e.target.value)} style={inputStyle}/>)}
      {field('生日 *', <input type="date" value={bday} onChange={e=>setBday(e.target.value)} required style={inputStyle}/>)}
      {field('MBTI *',
        <select value={mbti} onChange={e=>setMbti(e.target.value)} required style={inputStyle}>
          <option value="">选择 MBTI</option>
          {MBTI_OPTIONS.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
      )}
      {field('喜欢的东西（逗号分隔）', <input value={likes} onChange={e=>setLikes(e.target.value)} style={inputStyle}/>)}
      {field('讨厌的东西（逗号分隔）', <input value={dislikes} onChange={e=>setDislikes(e.target.value)} style={inputStyle}/>)}
      {field('兴趣爱好（逗号分隔）', <input value={hobbies} onChange={e=>setHobbies(e.target.value)} style={inputStyle}/>)}
      {field('备注', <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} style={{...inputStyle,resize:'vertical'}}/>)}

      <button type="submit" disabled={saving} style={{
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

- [ ] **Step 2: Create `app/friend/new/page.tsx`**:

```tsx
import FriendForm from '@/components/FriendForm'
import Link from 'next/link'

export default function NewFriendPage() {
  return (
    <main style={{
      minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'flex-start', padding:'60px 24px 80px',
      background:'radial-gradient(ellipse at 30% 40%, #0d1b4b 0%, #020408 70%)',
    }}>
      <div style={{ width:'100%', maxWidth:560 }}>
        <Link href="/" style={{ color:'rgba(226,185,111,0.5)', fontSize:11, letterSpacing:2,
          textDecoration:'none', display:'block', marginBottom:32 }}>← 返回星图</Link>
        <h1 style={{ color:'#e2b96f', fontFamily:'Ma Shan Zheng, cursive',
          fontSize:28, letterSpacing:4, marginBottom:32 }}>✦ 新纪录</h1>
        <FriendForm />
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Test**

```bash
npm run dev
```

Go to `http://localhost:3000/friend/new` — fill in a friend, save → should redirect to star map with the new star.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add new friend form with star generation"
```

---

### Task 12: Edit friend form + memory timeline

**Files:**
- Create: `app/friend/[friendId]/page.tsx`
- Create: `components/MemoryTimeline.tsx`
- Create: `components/MediaUpload.tsx`

- [ ] **Step 1: Create `components/MediaUpload.tsx`**:

```tsx
'use client'
import { useRef } from 'react'
import { uploadMedia } from '@/lib/supabase'
import type { Media } from '@/lib/types'

interface Props {
  friendId: string
  folder: string
  onUploaded: (media: Media) => void
}

export default function MediaUpload({ friendId, folder, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const isVideo = file.type.startsWith('video/')
    const { url, thumbnailUrl } = await uploadMedia(friendId, folder, file)
    const media: Media = {
      id: crypto.randomUUID(), type: isVideo ? 'video' : 'photo',
      url, thumbnailUrl, size: file.size,
      caption: '', takenAt: new Date().toISOString(),
      duration: undefined,
    }
    onUploaded(media)
    e.target.value = ''
  }

  return (
    <div>
      <button type="button" onClick={() => inputRef.current?.click()}
        style={{ padding:'6px 14px', background:'rgba(255,255,255,0.04)',
          border:'1px solid rgba(226,185,111,0.2)', borderRadius:8,
          color:'rgba(226,185,111,0.7)', fontSize:11, letterSpacing:1, cursor:'pointer' }}>
        + 上传照片/视频
      </button>
      <input ref={inputRef} type="file" accept="image/*,video/*"
        onChange={handleFile} style={{ display:'none' }} />
    </div>
  )
}
```

- [ ] **Step 2: Create `components/MemoryTimeline.tsx`**:

```tsx
'use client'
import { useState } from 'react'
import type { Memory, Media } from '@/lib/types'
import MediaUpload from './MediaUpload'

interface Props { friendId: string; memories: Memory[]; onChange: (m: Memory[]) => void }

export default function MemoryTimeline({ friendId, memories, onChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Partial<Memory>>({})

  function saveMemory() {
    if (!draft.title || !draft.date) return
    const mem: Memory = {
      id: crypto.randomUUID(),
      date:    draft.date!,
      title:   draft.title!,
      content: draft.content ?? '',
      tags:    (draft.tags as unknown as string ?? '').split(',').map((t:string)=>t.trim()).filter(Boolean),
      media:   [],
    }
    onChange([...memories, mem].sort((a,b)=>b.date.localeCompare(a.date)))
    setDraft({}); setAdding(false)
  }

  function addMedia(memId: string, media: Media) {
    onChange(memories.map(m => m.id===memId ? {...m, media:[...m.media, media]} : m))
  }

  const inp: React.CSSProperties = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(226,185,111,0.15)',
    borderRadius:6, padding:'8px 12px', color:'#e2e8f0', fontSize:12, width:'100%', fontFamily:'Noto Serif SC, serif' }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <span style={{ color:'rgba(226,185,111,0.7)', fontSize:11, letterSpacing:2 }}>行动记录</span>
        <button type="button" onClick={()=>setAdding(true)} style={{ ...inp, width:'auto', padding:'4px 12px', cursor:'pointer' }}>+ 新记录</button>
      </div>

      {adding && (
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(226,185,111,0.15)',
          borderRadius:10, padding:16, marginBottom:16, display:'flex', flexDirection:'column', gap:10 }}>
          <input placeholder="日期" type="date" value={draft.date??''} onChange={e=>setDraft({...draft,date:e.target.value})} style={inp}/>
          <input placeholder="标题" value={draft.title??''} onChange={e=>setDraft({...draft,title:e.target.value})} style={inp}/>
          <textarea placeholder="描述" rows={3} value={draft.content??''} onChange={e=>setDraft({...draft,content:e.target.value})} style={{...inp,resize:'vertical'}}/>
          <input placeholder="标签（逗号分隔）" value={(draft.tags as unknown as string)??''} onChange={e=>setDraft({...draft,tags:e.target.value as unknown as string[]})} style={inp}/>
          <button type="button" onClick={saveMemory} style={{...inp,width:'auto',cursor:'pointer',color:'#e2b96f'}}>保存</button>
        </div>
      )}

      {memories.map(m => (
        <div key={m.id} style={{ borderLeft:'2px solid rgba(226,185,111,0.2)', paddingLeft:16, marginBottom:20 }}>
          <div style={{ color:'rgba(226,185,111,0.5)', fontSize:10 }}>{m.date}</div>
          <div style={{ color:'#e2e8f0', fontSize:13, margin:'4px 0' }}>{m.title}</div>
          {m.content && <div style={{ color:'rgba(155,142,196,0.7)', fontSize:11, lineHeight:1.6 }}>{m.content}</div>}
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
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `app/friend/[friendId]/page.tsx`**:

```tsx
import { getFriends } from '@/lib/store'
import FriendForm from '@/components/FriendForm'
import MemoryTimeline from '@/components/MemoryTimeline'
import Link from 'next/link'

export default function EditFriendPage({ params }: { params: { friendId: string } }) {
  const friend = getFriends().find(f => f.id === params.friendId)
  if (!friend) return <div style={{color:'#e2b96f',padding:40}}>好友不存在</div>

  return (
    <main style={{
      minHeight:'100vh', padding:'60px 24px 80px',
      background:'radial-gradient(ellipse at 30% 40%, #0d1b4b 0%, #020408 70%)',
    }}>
      <div style={{ width:'100%', maxWidth:560, margin:'0 auto' }}>
        <Link href="/" style={{ color:'rgba(226,185,111,0.5)', fontSize:11, letterSpacing:2,
          textDecoration:'none', display:'block', marginBottom:32 }}>← 返回星图</Link>
        <h1 style={{ color:'#e2b96f', fontFamily:'Ma Shan Zheng, cursive',
          fontSize:28, letterSpacing:4, marginBottom:32 }}>✦ {friend.name}</h1>
        <FriendForm initial={friend} />
        <div style={{ marginTop:48 }}>
          <MemoryTimeline
            friendId={friend.id}
            memories={friend.memories}
            onChange={() => {/* handled inside FriendForm save */}}
          />
        </div>
        {!friend.atlasId && (
          <div style={{ marginTop:40, textAlign:'center' }}>
            <Link href={`/atlas/${friend.id}`} style={{
              display:'inline-block', padding:'12px 32px',
              background:'rgba(226,185,111,0.08)', border:'1px solid rgba(226,185,111,0.35)',
              borderRadius:12, color:'#e2b96f', fontSize:12, letterSpacing:2, textDecoration:'none',
            }}>✦ 生成图鉴</Link>
          </div>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add edit friend form, memory timeline, media upload"
```

---

## Phase 4 — Relationships

### Task 13: Relationship UI in edit form

**Files:**
- Create: `components/RelationshipEditor.tsx`
- Modify: `components/FriendForm.tsx`

- [ ] **Step 1: Create `components/RelationshipEditor.tsx`**:

```tsx
'use client'
import { useState } from 'react'
import { getFriends } from '@/lib/store'
import type { Relationship } from '@/lib/types'

interface Props {
  currentFriendId: string
  relationships: Relationship[]
  onChange: (r: Relationship[]) => void
}

export default function RelationshipEditor({ currentFriendId, relationships, onChange }: Props) {
  const allFriends = getFriends().filter(f => f.id !== currentFriendId)
  const [sel, setSel]   = useState('')
  const [label, setLabel] = useState('')
  const [close, setClose] = useState<1|2|3>(2)

  function add() {
    if (!sel || !label) return
    const rel: Relationship = { friendId: sel, label, closeness: close }
    onChange([...relationships.filter(r=>r.friendId!==sel), rel])
    setSel(''); setLabel(''); setClose(2)
  }

  const inp: React.CSSProperties = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(226,185,111,0.15)',
    borderRadius:6, padding:'8px 12px', color:'#e2e8f0', fontSize:12, fontFamily:'Noto Serif SC, serif' }

  return (
    <div>
      <div style={{ color:'rgba(226,185,111,0.7)', fontSize:11, letterSpacing:2, marginBottom:12 }}>共同好友关系</div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        <select value={sel} onChange={e=>setSel(e.target.value)} style={inp}>
          <option value="">选择好友</option>
          {allFriends.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <input placeholder="关系描述" value={label} onChange={e=>setLabel(e.target.value)} style={{...inp,flex:1}}/>
        <select value={close} onChange={e=>setClose(Number(e.target.value) as 1|2|3)} style={inp}>
          <option value={1}>普通认识</option>
          <option value={2}>比较熟</option>
          <option value={3}>很亲近</option>
        </select>
        <button type="button" onClick={add} style={{...inp,cursor:'pointer',color:'#e2b96f'}}>添加</button>
      </div>
      {relationships.map(r => {
        const f = allFriends.find(f=>f.id===r.friendId)
        return (
          <div key={r.friendId} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'6px 12px', marginBottom:6, background:'rgba(255,255,255,0.03)',
            border:'1px solid rgba(226,185,111,0.1)', borderRadius:8 }}>
            <span style={{ color:'#e2e8f0', fontSize:12 }}>{f?.name} · {r.label}</span>
            <button type="button" onClick={()=>onChange(relationships.filter(x=>x.friendId!==r.friendId))}
              style={{ background:'none', border:'none', color:'rgba(155,142,196,0.5)', cursor:'pointer', fontSize:12 }}>✕</button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Add `RelationshipEditor` to `components/FriendForm.tsx`** — add import and insert after hobbies field:

```tsx
// Add import at top:
import RelationshipEditor from './RelationshipEditor'

// Add state:
const [rels, setRels] = useState<Relationship[]>(initial?.relationships ?? [])

// Add field before notes:
{initial && field('共同好友',
  <RelationshipEditor
    currentFriendId={initial.id}
    relationships={rels}
    onChange={setRels}
  />
)}

// Include rels in the Friend object:
relationships: rels,
```

- [ ] **Step 3: Import `Relationship` type** — add to FriendForm.tsx imports:

```tsx
import type { Friend, Media, Relationship } from '@/lib/types'
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add relationship editor with constellation closeness levels"
```

---

## Phase 5 — Atlas Page

### Task 14: Atlas report page + AI stub

**Files:**
- Create: `app/atlas/[friendId]/page.tsx`
- Create: `app/api/generate-atlas/route.ts`

- [ ] **Step 1: Create `app/api/generate-atlas/route.ts`**:

```ts
import { NextRequest, NextResponse } from 'next/server'
import type { Friend, Atlas } from '@/lib/types'

export async function POST(req: NextRequest) {
  const friend: Friend = await req.json()

  // Stub — replace with Claude API call in next phase
  const atlas: Atlas = {
    id:          crypto.randomUUID(),
    friendId:    friend.id,
    generatedAt: new Date().toISOString(),
    summary:     `${friend.name}是一个${friend.zodiac}的${friend.mbti}，个性独特，值得深交。`,
    personality: `作为${friend.mbti}类型，${friend.name}在人际关系中展现出独特的魅力...`,
    predictions: `根据${friend.name}的星座特征和性格类型，预计在艺术、创意领域有较强共鸣。`,
    giftIdeas:   ['手工制品', '独特体验', '个性化定制礼物'],
    warnings:    ['需要给予足够的个人空间', '避免在公开场合批评'],
    rawInput:    { id:friend.id, name:friend.name, mbti:friend.mbti, zodiac:friend.zodiac, likes:friend.likes },
  }

  return NextResponse.json(atlas)
}
```

- [ ] **Step 2: Create `app/atlas/[friendId]/page.tsx`**:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { getFriends, getAtlasByFriendId, saveAtlas } from '@/lib/store'
import { pushAtlas } from '@/lib/supabase'
import type { Atlas, Friend } from '@/lib/types'
import Link from 'next/link'

export default function AtlasPage({ params }: { params: { friendId: string } }) {
  const friend  = getFriends().find(f => f.id === params.friendId)
  const [atlas,   setAtlas]   = useState<Atlas | null>(getAtlasByFriendId(params.friendId) ?? null)
  const [loading, setLoading] = useState(false)

  async function generate() {
    if (!friend) return
    setLoading(true)
    const res  = await fetch('/api/generate-atlas', { method:'POST', body:JSON.stringify(friend), headers:{'Content-Type':'application/json'} })
    const data: Atlas = await res.json()
    saveAtlas(data)
    await pushAtlas(data).catch(console.error)
    setAtlas(data)
    setLoading(false)
  }

  if (!friend) return <div style={{color:'#e2b96f',padding:40}}>好友不存在</div>

  return (
    <main style={{
      minHeight:'100vh', padding:'60px 24px 80px', overflowY:'auto',
      background:'radial-gradient(ellipse at 20% 30%, #0d1b4b 0%, #020408 70%)',
    }}>
      <div style={{ maxWidth:620, margin:'0 auto' }}>
        <Link href="/" style={{ color:'rgba(226,185,111,0.5)', fontSize:11, letterSpacing:2,
          textDecoration:'none', display:'block', marginBottom:32 }}>← 返回星图</Link>

        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ color:'rgba(155,142,196,0.5)', fontSize:10, letterSpacing:3, marginBottom:8 }}>FRIEND ATLAS</div>
          <h1 style={{ color:'#e2b96f', fontFamily:'Ma Shan Zheng, cursive', fontSize:36, letterSpacing:6 }}>{friend.name}</h1>
          <div style={{ color:'rgba(155,142,196,0.6)', fontSize:11, marginTop:6 }}>{friend.mbti} · {friend.zodiac}</div>
        </div>

        {!atlas && (
          <div style={{ textAlign:'center' }}>
            <button onClick={generate} disabled={loading} style={{
              padding:'14px 40px', background:'rgba(226,185,111,0.1)',
              border:'1px solid rgba(226,185,111,0.4)', borderRadius:14,
              color:'#e2b96f', fontSize:13, letterSpacing:2, cursor:'pointer',
            }}>
              {loading ? '✦ 生成中...' : '✦ 生成图鉴'}
            </button>
          </div>
        )}

        {atlas && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            {[
              { label:'人物总结', content: atlas.summary },
              { label:'性格分析', content: atlas.personality },
              { label:'喜好预测', content: atlas.predictions },
            ].map(({ label, content }) => (
              <section key={label} style={{
                background:'rgba(226,185,111,0.04)', border:'1px solid rgba(226,185,111,0.15)',
                borderRadius:14, padding:'20px 24px',
              }}>
                <div style={{ color:'rgba(226,185,111,0.6)', fontSize:10, letterSpacing:3, marginBottom:10 }}>✦ {label}</div>
                <p style={{ color:'#e2e8f0', fontSize:13, lineHeight:2 }}>{content}</p>
              </section>
            ))}

            <section style={{ background:'rgba(226,185,111,0.04)', border:'1px solid rgba(226,185,111,0.15)', borderRadius:14, padding:'20px 24px' }}>
              <div style={{ color:'rgba(226,185,111,0.6)', fontSize:10, letterSpacing:3, marginBottom:12 }}>✦ 礼物建议</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {atlas.giftIdeas.map(g=>(
                  <span key={g} style={{ padding:'4px 12px', border:'1px solid rgba(226,185,111,0.25)', borderRadius:20, color:'#e2b96f', fontSize:11 }}>{g}</span>
                ))}
              </div>
            </section>

            <section style={{ background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:14, padding:'20px 24px' }}>
              <div style={{ color:'rgba(239,68,68,0.6)', fontSize:10, letterSpacing:3, marginBottom:12 }}>⚠ 相处注意</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {atlas.warnings.map(w=>(
                  <span key={w} style={{ padding:'4px 12px', border:'1px solid rgba(239,68,68,0.2)', borderRadius:20, color:'rgba(252,165,165,0.8)', fontSize:11 }}>{w}</span>
                ))}
              </div>
            </section>

            <div style={{ textAlign:'center', marginTop:8 }}>
              <button onClick={generate} disabled={loading} style={{
                padding:'8px 24px', background:'none',
                border:'1px solid rgba(226,185,111,0.2)', borderRadius:10,
                color:'rgba(226,185,111,0.5)', fontSize:10, letterSpacing:1, cursor:'pointer',
              }}>重新生成</button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Test full flow**

```bash
npm run dev
```

1. Open `http://localhost:3000` → click orrery → star map
2. Click "✦ 新纪录" → fill friend info → save → star appears
3. Click star → card popup → "编辑" → edit page loads
4. Click "✦ 生成图鉴" → atlas page loads → click generate → report appears

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 5: Final commit**

```bash
git add -A && git commit -m "feat: add atlas page with generate endpoint stub"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ 封面入口 (OrreryEntry) → Task 10
- ✅ 星图主界面 + 拖拽平移 → Task 10
- ✅ 月亮碎片拖尾 → Task 7
- ✅ 星星外观生成 (MBTI + 星座) → Task 4
- ✅ Poisson Disk 排他区域 → Task 4
- ✅ 好友 CRUD → Task 11, 12
- ✅ 行动记录 + 媒体上传 → Task 12
- ✅ 关系网络 + 星座连线 → Task 9, 13
- ✅ 图鉴页 (AI stub) → Task 14
- ✅ localStorage + Supabase 双存档 → Task 5, 6
- ⏳ AI 图鉴生成接入 Claude API → 后续单独任务
- ⏳ 边缘星光提示"更多方向" → 可在 Task 10 迭代

**Types used consistently:** `Friend`, `Atlas`, `Memory`, `Media`, `Relationship`, `StarConfig`, `StarKind` — all defined in `lib/types.ts` Task 3 and referenced unchanged throughout.
