# 友记 v0.2 · Bug 修复 + 关系状态化 星星/卡片/表单 设计文档

**日期**：2026-07-01
**状态**：已确认，待实现（含工程实现细节补充，已核实当前代码状态）
**依赖**：`docs/superpowers/specs/2026-06-30-friend-star-map-design.md`（v0.1 基础设计，本文档只描述在其之上的变更）

---

## 一、背景

v0.1 完成后发现四个问题：

1. 点击已创建的好友星星打不开详情/编辑页
2. 新建好友表单不美观，字段平铺一长条
3. MBTI 被设为必填项，但用户不一定第一次就想填
4. 下拉框（`<select>`）选项对比度过低，看不清文字

同时用户咨询了产品建议，希望星星能反映"关系状态"而不只是 MBTI/星座的静态标签。本文档在修复四个 bug 的同时，落地专家建议中标记为 **V0.2** 的部分：档案完整度、星星成长阶段、关系温度、聊天提示、生日状态、以及更丰富的好友卡片。V0.3 及以后（今日星象面板、孤星、共同标签关系线、时间旅行等）不在本文档范围内。

### 1.1 已核实的当前代码状态

实现前对照 v0.1 代码逐项核实（不假设文档描述与代码一致）：

| 检查项 | 结论 |
|---|---|
| 全局样式文件路径 | `app/globals.css`，由 `app/layout.tsx` 顶部 `import './globals.css'` 引入，不存在 `styles/globals.css` |
| `MemoryTimeline` 是否真正持久化 | **已经能**。`components/MemoryTimeline.tsx` 的 `onChange` 会被 `app/friend/[friendId]/page.tsx` 的 `handleMemoriesChange` 接住，内部调用 `saveFriend` + `pushFriend`，刷新后数据仍在。不需要补齐，只需要给它读取的 `friend.memories` 相关字段做 optional 兜底（本身已是必填数组，不受本次影响） |
| `/friend/[friendId]/page.tsx` 是否 client component | 是，文件顶部已有 `'use client'` |
| `StarMap.tsx` 的 hover/drag/raycaster 组织方式 | 单个 `mousemove` 处理 hover + 拖拽（`isDrag` 标志复用同一个 handler），`mousedown`/`mouseup` 只负责切换 `isDrag`，**没有任何 click 事件**，这是 2.1 bug 的根因 |
| `FriendCard` 是否通过 `Link` 跳转编辑页 | 是，`components/FriendCard.tsx` 用 `next/link` 的 `<Link href={/friend/${friend.id}}>`，跳转机制本身没问题，问题是卡片在能点到之前就消失了 |
| `starGen.ts` 是否假设 mbti/zodiac 必存在 | 是：`mbti.slice(0,2)`、`ELEMENT_COLORS[element]` 直接索引、`mbti[0]` 直接访问，均需要加 optional 处理 |
| 现有 mock data / 测试是否把这些字段当必填 | `lib/store.test.ts` 的 `MOCK_FRIEND` 目前没有 `important` 字段，类型改动后会编译失败，需要一并补上；`lib/starGen.test.ts` 全部用具体字符串调用，不受影响但会新增 undefined 用例；`app/atlas/[friendId]/page.tsx:82` 和 `app/api/generate-atlas/route.ts` 里有 `${friend.mbti} · ${friend.zodiac}` 这类字符串拼接，字段变可选后会输出字面量 `undefined`，需要一并修（原设计文档遗漏了这两个文件，已在下方"涉及文件"更正） |
| Three.js 场景是否会重复 build 星星 | 不会。`StarMap.tsx` 的建场 `useEffect` 依赖数组是 `[]`，整个组件生命周期内 `buildStar`/`buildConstellationLines` 只跑一次；`scene.ts` 的 `disposeScene()` 在 unmount 时整体 `dispose()` renderer 并清空引用，不存在"重复叠加星星/光环"的风险。因此**不需要**额外的"清理旧 stars/lines 再重建"逻辑——这条是在补充材料 review 后确认为当前架构下不适用，如果 V0.3 引入"不卸载组件的实时刷新"，需要重新评估 |

---

## 二、Bug 修复

### 2.1 点击星星打不开

**根因**：`StarMap.tsx` 只注册了 `mousemove` 做 hover 检测，`hoveredFriend` 随鼠标位置实时更新；`FriendCard` 弹出位置跟随鼠标（`x: e.clientX+22`）。当用户把鼠标从星星移向卡片上的"编辑"链接时，鼠标已经离开星星的碰撞体（`hitMesh`），`hoveredFriend` 被清空，卡片随之消失，用户点不到按钮。且从未注册任何 `click` 事件——即使卡片不消失，直接点星星本身也没有反应。

**修复**：点击星星后把卡片"钉住"，不再跟随鼠标。hover 预览卡片和 pinned 卡片是两套独立状态，不复用：

```ts
const [hoveredFriend, setHoveredFriend] = useState<Friend | null>(null)
const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })

const [pinnedFriend, setPinnedFriend] = useState<Friend | null>(null)
const [pinnedPos, setPinnedPos] = useState<{ x: number; y: number } | null>(null)
```

渲染规则：存在 pinned 好友时不显示 hover 预览卡片，避免两张卡片同时出现；hover 触发的关系线高亮/星星放大动效不受影响。

```tsx
{!pinnedFriend && hoveredFriend && (
  <FriendCard friend={hoveredFriend} style={{ left: hoverPos.x, top: hoverPos.y }} />
)}
{pinnedFriend && pinnedPos && (
  <FriendCard friend={pinnedFriend} pinned
    onClose={() => { setPinnedFriend(null); setPinnedPos(null) }}
    style={{ left: pinnedPos.x, top: pinnedPos.y }} />
)}
```

**click/drag 判定放在 `mouseup`，不是 `mousedown`**（`mousedown` 时还不知道用户接下来会不会拖动）：

```ts
const pointerDownRef = useRef<{ x: number; y: number } | null>(null)

function onMouseDown(e: MouseEvent) {
  pointerDownRef.current = { x: e.clientX, y: e.clientY }
  isDrag = true; lx = e.clientX; ly = e.clientY
}

function onMouseUp(e: MouseEvent) {
  const start = pointerDownRef.current
  pointerDownRef.current = null
  isDrag = false
  if (!start) return
  const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y)
  if (moved < 5) handleCanvasClick(e)   // 命中星星 → setPinnedFriend；未命中 → 清空 pinned（空白处点击关闭）
}
```

click 判定只挂在 **canvas** 的 `mouseup` 上（不是 `window`），这样点击 `FriendCard`（`pointerEvents:'auto'`，层级高于 canvas）内部的按钮不会被 canvas 误判为"点击空白处"而关闭卡片。

`Escape` 关闭 pinned 卡片，`useEffect` cleanup 里要 `removeEventListener`：

```ts
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') { setPinnedFriend(null); setPinnedPos(null) }
}
window.addEventListener('keydown', onKeyDown)
// cleanup: window.removeEventListener('keydown', onKeyDown)
```

`FriendCard` 增加 `pinned?: boolean` 与 `onClose?: () => void`，pinned 模式下右上角显示 `✕` 关闭按钮。

### 2.2 新建好友表单重设计

- 顶部增加"快速添加 / 完整档案"模式切换（纯前端展示切换，不影响已填数据，切换只影响渲染哪些字段区块）。**默认模式取决于新建/编辑**：`const [mode, setMode] = useState<'quick'|'full'>(initial ? 'full' : 'quick')`——新建默认快速添加降低门槛，编辑已有好友默认完整档案，避免用户以为原有字段丢了
- **快速添加**：名字 *、备注（单行 input，写入 `notes`）、重要程度（"普通"/"重要 ✦" 两态按钮，写入新增的 `important: boolean`）
- **完整档案**：三个分区卡片——
  - 基本信息：名字、昵称、生日、重要程度
  - 性格与喜好（选填）：MBTI、喜欢、讨厌、兴趣爱好
  - 关系与备注：共同好友（`RelationshipEditor`，仅编辑已存在好友时显示，与现状一致）、备注（改为 textarea，同一个 `notes` 字段）
- 两种模式**共用同一套 state**（`name`/`nickname`/`birthday`/`mbti`/`likes`/`dislikes`/`hobbies`/`notes`/`important`/`relationships`），切换模式只改变渲染哪些区块，不清空、不拆成两个表单
- 保存逻辑不变（`saveFriend` + `pushFriend`）

### 2.3 MBTI／生日改为选填

- `Friend.mbti`、`Friend.birthday`、`Friend.zodiac` 由必填改为可选（详见数据模型章节）
- `FriendForm` 提交校验只保留 `name.trim()` 非空；移除 `mbti`、`bday` 的 `required` 属性和 `if (!name || !bday || !mbti) return` 判断
- 生日存在时才计算星座：`const zodiac = bday ? getZodiac(bday) : undefined`
- `generateStarConfig` 与相关渲染代码对 `mbti`/`zodiac` 缺失做默认降级（见 4.4）

### 2.4 下拉框对比度修复

`app/globals.css`（已核实为唯一被 `layout.tsx` 引入的全局样式文件）追加：

```css
select {
  background-color: #0d1428;
  color: #f1e9d8;
}
select option {
  background-color: #0d1428;
  color: #f1e9d8;
}
```

站内目前有三处 `<select>`：`FriendForm` 的 MBTI，`RelationshipEditor` 的"选择好友"和"亲密度"——全局规则一次性修复，不用逐组件改。桌面端 Chrome/Edge/Firefox 均支持 `<option>` 的 `background-color`，覆盖系统默认白底问题。

---

## 三、数据模型变更（`lib/types.ts`）

```ts
export interface Friend {
  id: string
  name: string
  nickname?: string
  birthday?: string     // 必填 → 选填
  zodiac?: string        // 必填 → 选填，仅当 birthday 存在时计算
  mbti?: string            // 必填 → 选填
  important: boolean       // 新增，默认 false，"重要程度"标记
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
```

`StarConfig` 本身不变（仍是 kind/coreColor/glowColor/size/twinkleSpeed/position）。成长阶段、守护环、生日环**不写入** `StarConfig`，理由见 4.1。

### 3.1 `lib/store.ts`：统一用 `normalizeFriend` 兜底旧数据

不在多个组件里分散写 `?? false` / `?? []`，统一在读取入口处理一次：

```ts
function normalizeFriend(friend: Partial<Friend>): Friend {
  return {
    id: friend.id ?? crypto.randomUUID(),
    name: friend.name ?? '未命名好友',
    nickname: friend.nickname,
    birthday: friend.birthday,
    zodiac: friend.zodiac,
    mbti: friend.mbti,
    important: friend.important ?? false,
    likes: friend.likes ?? [],
    dislikes: friend.dislikes ?? [],
    hobbies: friend.hobbies ?? [],
    portraits: friend.portraits ?? [],
    memories: friend.memories ?? [],
    relationships: friend.relationships ?? [],
    notes: friend.notes,
    starConfig: friend.starConfig ?? DEFAULT_STAR_CONFIG,
    atlasId: friend.atlasId,
    createdAt: friend.createdAt ?? new Date().toISOString(),
    updatedAt: friend.updatedAt ?? new Date().toISOString(),
  }
}

const DEFAULT_STAR_CONFIG: StarConfig = {
  kind: 'nebula', coreColor: '#94a3b8', glowColor: '#cbd5e1',
  size: 1, twinkleSpeed: 2.4, position: [0, 0, 0],
}

export function getFriends(): Friend[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FRIENDS_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.map(normalizeFriend)
  } catch { return [] }
}
```

`DEFAULT_STAR_CONFIG` 只在极端情况（历史脏数据缺 `starConfig`）兜底用，正常创建流程仍然走 `generateStarConfig()`。不从 `starGen.ts` import，避免 `store.ts`（纯数据层）反向依赖生成逻辑。

---

## 四、V0.2 关系状态功能

### 4.1 架构决定：运行时计算，而不是烘焙进 StarConfig

专家建议里把成长阶段/生日环等都塞进 `StarConfig` 持久化字段。这里改成运行时计算：`StarBuilder.buildStar(friend)` 本来就接收完整 `friend` 对象，可以直接在构建星星外观时调用下面几个纯函数得到当前状态，**不修改 `cfg` 本身**，只用局部变量覆盖渲染时用到的值。

原因：`StarConfig` 只在 `FriendForm` 提交时通过 `generateStarConfig()` 重新生成一次；而添加回忆走的是 `MemoryTimeline` → `handleMemoriesChange`（已核实真实可用，见 1.1），并不会重新生成 `starConfig`。如果把成长阶段焼进 `size` 里，用户加完第 3 条回忆、星星应该从"幼星"变成"恒星"，但实际不会变，除非用户回到编辑表单重新点一次保存——体验割裂。改为运行时计算后，任何数据变化（加回忆、标记重要、生日临近）都会在下次渲染时立刻反映在星星外观上（当前架构下"下次渲染"即"下次进入星图页面"，见 1.1 关于场景不重复 build 的结论）。

### 4.2 新增 lib 模块

**`lib/growthStage.ts`**

```ts
export type GrowthStage = 'dust' | 'young' | 'bright' | 'stellar' | 'constellation-core'

export function getGrowthStage(friend: Friend): {
  stage: GrowthStage
  label: string       // 星尘 / 幼星 / 亮星 / 恒星 / 星座核心
  nextHint: string     // "还差 2 条回忆即可成长为亮星" / "已经是最高阶段"
}
```

判定规则（自上而下，满足即停止）：
- `constellation-core`：`relationships.length > 0 && memories.length >= 3`
- `stellar`：`memories.length >= 3`
- `bright`：`mbti` 存在 或 `likes.length>0` 或 `hobbies.length>0`
- `young`：`birthday` 存在 或 `notes` 非空
- `dust`：以上都不满足（只有名字）

**`lib/friendEnergy.ts`**

```ts
export type EnergyLevel = 'low' | 'medium' | 'high' | 'legendary'

export function calculateFriendEnergy(friend: Friend): {
  score: number
  level: EnergyLevel
  lastActivityText: string   // "最近一次记录：2026-07-01" / "还没有记录"
}
```

评分规则：
- 每条 memory +1
- memory 有图片/视频（`media.length>0`）+2
- memory 内容长（`content.length > 50`）+1
- 每条 relationship 按 `closeness` 值加分（1~3）
- **近期活跃 +3，判定优先级**：有 memory 时用最新一条 memory 的 `date`（`[...memories].sort((a,b)=>b.date.localeCompare(a.date))[0]`）判断是否在 30 天内；**没有 memory 时才**退回用 `friend.updatedAt` 判断——这样只是改了昵称不会让"关系温度"显得莫名变高，只有真实新增回忆才算数

`lastActivityText` **和打分逻辑分开处理**：只要 `memories.length === 0` 就固定显示"还没有记录"，即使 `updatedAt` 很新也不写"最近一次记录：xxx"，因为 `updatedAt` 是系统编辑时间，不是真实回忆——避免文案和实际感受矛盾。有 memory 时显示 `"最近一次记录：" + 最新 memory 的 date`。

等级：0-2 `low`，3-6 `medium`，7-12 `high`，13+ `legendary`。百分比显示用 `min(score/15, 1) * 100%` 做粗略换算（15 分封顶为 100%）。

**`lib/conversationHint.ts`**

```ts
export function generateConversationHint(friend: Friend): string
```

V0.2 用模板规则，不接 AI（真正的自然语言生成放到 V0.4 AI 图鉴，这里做不到"你最近拍照了吗"这种真正理解上下文的提问，只能是模板拼接）：
1. 有 memory → 用最近一条的标题："下次可以问问 TA 最近的『{title}』"
2. 否则有 hobbies → "可以聊聊 TA 的兴趣爱好：{hobbies[0]}"
3. 否则有 likes → "可以聊聊 TA 喜欢的：{likes[0]}"
4. 都没有 → "还不了解 TA，下次可以多问问喜好"

**`lib/birthdayStatus.ts`**

```ts
export function getBirthdayStatus(
  birthday?: string,
  now: Date = new Date(),   // 可注入，方便测试固定日期
): {
  daysUntil: number | null
  label: string | null      // "3 天后生日" / "今天生日 🎂"
  isToday: boolean
  isSoon: boolean            // 0 < daysUntil <= 7
}
```

**不用 `new Date('YYYY-MM-DD')` 直接解析**——这是无时区日期，`new Date()` 会按 UTC 解析再转本地时区，可能跨日偏移一天。手动拆分年月日：

```ts
function parseBirthday(birthday: string): { month: number; day: number } | null {
  const parts = birthday.split('-').map(Number)
  if (parts.length !== 3) return null
  const [, month, day] = parts
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null
  return { month, day }
}
```

用本地年月日构造 `Date`（不经过字符串解析）计算下一次生日：

```ts
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
let nextBirthday = new Date(now.getFullYear(), month - 1, day)
if (nextBirthday < today) nextBirthday = new Date(now.getFullYear() + 1, month - 1, day)
const daysUntil = Math.round((nextBirthday.getTime() - today.getTime()) / 86400000)
```

无 `birthday` 或解析失败：`{ daysUntil: null, label: null, isToday: false, isSoon: false }`。`daysUntil === 0` → `isToday: true, isSoon: true, label: '今天生日 🎂'`；`0 < daysUntil <= 7` → `isSoon: true, label: '${daysUntil} 天后生日'`；否则 `label: null`。

**`lib/profileCompletion.ts`**

```ts
export function calculateProfileCompletion(friend: Friend): {
  percent: number
  missing: string[]   // ["生日", "至少一条回忆"]
}
```

权重（与专家建议一致，合计 100）：生日 15 / MBTI 10 / 喜欢 15 / 讨厌 10 / 兴趣 10 / 备注 10 / 至少一条回忆 20 / 至少一张照片 10。

"至少一张照片"检查范围覆盖 `portraits` **和** `memories[].media`（不只看 `portraits`，因为回忆里传的照片也是真实存在的照片）：

```ts
const hasPhoto = friend.portraits.some(m => m.type === 'photo')
  || friend.memories.some(memory => memory.media.some(m => m.type === 'photo'))
```

v0.2 还没有图片上传 UI 落地验证（`MediaUpload.tsx` 已存在，本文档不改动），这一项在没传照片时正常显示"建议补充：...照片"，不为了刷满分造假。

### 4.3 星星外观增强（`StarBuilder.ts`）

在 `buildStar(friend)` 内部，取 `cfg = friend.starConfig` 后新增局部变量，**不修改 `cfg` 对象本身**：

```ts
const stageInfo = getGrowthStage(friend)
const birthday  = getBirthdayStatus(friend.birthday)

const STAGE_SIZE: Record<GrowthStage, number> = {
  dust: 0.55, young: 0.75, bright: 1.0, stellar: 1.15, 'constellation-core': 1.3,
}
const size = cfg.size * STAGE_SIZE[stageInfo.stage]
const twinkleSpeed = stageInfo.stage === 'dust' ? cfg.twinkleSpeed * 1.6 : cfg.twinkleSpeed
```

- 现有 6 个 `switch(cfg.kind)` 分支体内所有视觉相关的 `cfg.size` 替换为局部变量 `size`，所有 `cfg.twinkleSpeed` 替换为 `twinkleSpeed`；**不替换** `cfg.position`、`cfg.coreColor`、`cfg.glowColor`（这三个字段本来就该维持 MBTI/星座决定的身份色，不受成长阶段影响）
- `friend.important === true` → 加一层静态金色守护环（复用 `ringTex`）：半径比主光晕略大、透明度低、旋转慢、不遮挡主星
- `birthday.isSoon || birthday.isToday` → 加一层金色生日环：比守护环更亮、有轻微 pulse 动画（今天生日时 pulse 更明显），半径与守护环不同避免重叠

### 4.4 `generateStarConfig` 降级处理（`starGen.ts`）

```ts
const prefix = mbti?.slice(0, 2).toUpperCase()
const kind: StarKind = (prefix && KIND_MAP[prefix]) ?? 'nebula'   // 无 MBTI 默认 nebula（柔和/神秘，贴合"未知"气质）

const element = zodiac ? getZodiacElement(zodiac) : null
const { core: coreColor, glow: glowColor } = element
  ? ELEMENT_COLORS[element]
  : { core: '#94a3b8', glow: '#cbd5e1' }   // 无星座：中性银蓝色，不假装匹配一个星座

const isIntrovert = mbti?.[0]?.toUpperCase() === 'I'   // undefined 时按外向处理（不缩小）
```

函数签名变为 `generateStarConfig(mbti: string | undefined, zodiac: string | undefined, hobbies: string[], position: [...])`。

### 4.5 `FriendCard` 重设计

Pinned 模式下展示：

```
{name}                                    [✕ 关闭]
[friend.mbti, friend.zodiac, growthStage.label].filter(Boolean).join(' · ')
{important && '✦ 重要'}  {birthdayStatus.label}

关系温度：{energy.level}（{percent}%）
{energy.lastActivityText}

下次可以聊：{conversationHint}

档案完整度：{completion.percent}%（仅 <100% 时显示）
建议补充：{completion.missing.join('、')}

[编辑]  [{friend.atlasId ? '图鉴' : '生成图鉴'}]
```

字段全部做存在性判断（用 `filter(Boolean).join(' · ')` 之类写法拼接可选字段），缺失的部分（无 mbti/zodiac 等）直接跳过，不显示 `undefined` 字面量。

图鉴按钮**始终**链接到 `/atlas/${friend.id}`（不再像 v0.1 那样只在 `atlasId` 存在时才渲染 `Link`），因为 `app/atlas/[friendId]/page.tsx` 本身已经处理了"未生成 → 显示生成按钮 / 已生成 → 显示内容"两种状态，FriendCard 只需要决定按钮文案，不需要决定是否渲染链接，也不在 FriendCard 里直接调用生成 API。

---

## 五、Supabase SQL

**不需要迁移。** `supabase-schema.sql` 中 `friends.data` 列是 `jsonb`，本次所有改动（`mbti`/`birthday`/`zodiac` 变选填、新增 `important`）都只是 TypeScript 类型层面和 JSON 内容层面的变化，`jsonb` 列本身不做结构校验。已存在的记录（旧数据 mbti/birthday 必然有值）依然是新类型的合法子集；新建的轻量好友即使缺字段也能直接以合法 JSON 存入。不修改 `supabase-schema.sql`。

---

## 六、兼容性

- 旧 `Friend` 记录没有 `important` 字段 → `lib/store.ts` 的 `normalizeFriend()` 统一兜底 `important ?? false`，其余数组字段也一并兜底，避免下游任何一处判断因缺字段崩溃
- 旧记录的 `mbti`/`birthday`/`zodiac` 本来就是必填，不受影响，`getGrowthStage`/`profileCompletion` 等函数只是把这些字段当"更完整"处理
- 新建的轻量好友可能没有 `mbti`/`birthday`/`zodiac`，所有读取这些字段的地方（`FriendCard`、`StarBuilder`、`generateStarConfig`、`app/atlas/[friendId]/page.tsx`、`app/api/generate-atlas/route.ts`）都已按可选处理，不会因 `undefined` 崩溃或渲染出字面量 `undefined`

---

## 七、建议实现顺序

为避免一次性改动过多导致难以定位问题，按以下顺序实现，每完成一步跑一次 `npm run dev`（核心页面能打开）和 `npm run test`（新增测试通过），不要等全部做完才测试：

1. `lib/types.ts`：字段可选化，新增 `important`
2. `lib/store.ts`：新增 `normalizeFriend`，兼容旧数据；同步更新 `lib/store.test.ts` 的 `MOCK_FRIEND`（补 `important: false`）并新增一条"旧数据缺 important 字段"的读取测试
3. `lib/starGen.ts`：支持 `mbti`/`zodiac` 为 `undefined`；同步更新 `lib/starGen.test.ts` 新增 undefined 用例
4. `FriendForm`：快速/完整模式、分区布局、必填校验调整、重要程度字段
5. `StarMap` + `FriendCard`：点击星星 pinned 卡片修复（2.1）
6. 新增 5 个 lib 计算模块（growthStage / friendEnergy / conversationHint / birthdayStatus / profileCompletion）及各自测试
7. `FriendCard` 内容升级（接入第 6 步的模块）
8. `StarBuilder`：成长阶段尺寸、重要守护环、生日环
9. 全局 `select`/`option` 样式修复
10. `app/atlas/[friendId]/page.tsx`、`app/api/generate-atlas/route.ts`：mbti/zodiac 可选字段的显示/文案兜底
11. 手动完整验收（见第九节）

---

## 八、涉及文件

**修改**：
- `lib/types.ts` — Friend 字段可选化 + `important`
- `lib/store.ts` — 新增 `normalizeFriend`，`getFriends()` 统一走它
- `lib/store.test.ts` — `MOCK_FRIEND` 补 `important`，新增旧数据兼容测试
- `lib/starGen.ts` — mbti/zodiac 缺失降级
- `lib/starGen.test.ts` — 新增 undefined 用例
- `components/FriendForm.tsx` — 快速/完整模式、分区布局、必填校验调整、重要程度字段
- `components/FriendCard.tsx` — pinned 模式重设计
- `components/StarMap/StarMap.tsx` — 点击钉住逻辑（drag/click 区分、Escape、blank-click 清除）
- `components/StarMap/StarBuilder.ts` — 成长阶段尺寸/光晕、守护环、生日环
- `app/globals.css` — select/option 深色样式
- `app/atlas/[friendId]/page.tsx` — 第 82 行 `{friend.mbti} · {friend.zodiac}` 改为可选拼接
- `app/api/generate-atlas/route.ts` — stub 文案里的 `friend.mbti`/`friend.zodiac` 引用改为可选处理

**新增**：
- `lib/growthStage.ts` + `lib/growthStage.test.ts`
- `lib/friendEnergy.ts` + `lib/friendEnergy.test.ts`
- `lib/conversationHint.ts` + `lib/conversationHint.test.ts`
- `lib/birthdayStatus.ts` + `lib/birthdayStatus.test.ts`
- `lib/profileCompletion.ts` + `lib/profileCompletion.test.ts`

**不改动**：`supabase-schema.sql`、`lib/supabase.ts`、`components/MemoryTimeline.tsx`（已验证可正常工作，无需改动本体，只是它读取的 `friend.memories` 类型不受本次可选化影响）、`components/RelationshipEditor.tsx`（下拉框样式靠全局 CSS 规则覆盖，组件本身不用改）、`components/StarMap/constellationLines.ts`、`components/StarMap/scene.ts`、`components/StarMap/starfield.ts`、`components/StarMap/mouseTrail.ts`、`components/StarMap/OrreryEntry.tsx`、`components/MediaUpload.tsx`

---

## 九、测试计划

### 9.1 单元测试（vitest）

- `lib/growthStage.test.ts`：只有名字→dust；有 birthday→young；有 notes→young；有 mbti/likes/hobbies→bright；3 条 memories→stellar；relationships>0 且 memories>=3→constellation-core
- `lib/friendEnergy.test.ts`：空数据→low；memory/media/长文本/relationship closeness 各自加分；30 天内活跃加分（含"无 memory 时退回 updatedAt"的用例）；13+ 分→legendary
- `lib/conversationHint.test.ts`：有 memory 用标题；无 memory 有 hobby 用 hobby；无 hobby 有 like 用 like；都没有给出补充提示
- `lib/birthdayStatus.test.ts`：无 birthday；今天生日；3 天后；8 天后（不算 soon）；跨年生日；均通过注入固定 `now` 保证测试稳定
- `lib/profileCompletion.test.ts`：只有名字→0%；逐项加分；满数据→100%；照片检查覆盖 portraits 和 memory media 两种来源
- `lib/starGen.test.ts` 新增：mbti undefined→默认 nebula；zodiac undefined→默认银蓝色；两者都 undefined 不报错
- `lib/store.test.ts` 新增：`localStorage` 里存一条没有 `important` 字段的旧记录，`getFriends()` 读出后 `important` 为 `false`

### 9.2 手动验收清单

1. 新建好友页面默认是快速模式；编辑已有好友默认完整模式
2. 快速模式只填名字也能保存
3. 新建后首页出现星星（星尘外观：小、暗）
4. 点击星星后 FriendCard 被钉住，不再跟随鼠标
5. 鼠标从星星移到 FriendCard 上，卡片不会消失
6. 点击 FriendCard 的"编辑"按钮能正常跳转到编辑页（验证 2.1 修复）
7. 点击空白处或按 Escape 能关闭 pinned 卡片
8. MBTI 和生日可以不填，表单能提交成功
9. MBTI 下拉框选项文字清晰可读（不再是白底浅字）
10. 标记 important 后，星星出现金色守护环
11. 生日改到 7 天内，星星出现生日环，卡片显示"N 天后生日"
12. 给好友加 3 条回忆（不重新走表单保存）→ 回到星图，星星应变大（成长为恒星），验证 4.1 的运行时计算架构
13. FriendCard 显示成长阶段、关系温度、聊天提示、档案完整度和缺失建议
14. 旧数据（没有 `important` 字段）加载不崩溃
15. 刷新页面后所有数据仍然存在
16. `npm run test` 全部通过，`npm run dev` 无明显 console error

---

## 十、暂缓（不在本次范围）

今日星象面板、孤星标记、共同标签关系线、时间旅行模式、朋友宇宙统计页、真实 AI 图鉴、关系趋势升温/变冷、image upload、video upload、Supabase 自动同步（当前手动 push 机制不变）、OrreryEntry 重做、mouseTrail 重做——均按专家建议留到 V0.3 及以后，单独立项设计。如果实现过程中发现这些功能需要提前调整数据结构，只做最小兼容（比如多留一个可选字段），不展开完整功能。

---

## 十一、验收标准

v0.2 的核心目标不是堆更多功能，而是让已有功能真正可用：**能点、能保存、能编辑、能显示状态、能表达关系变化**。视觉增强可以保留，但不能为了动画效果牺牲基础交互的可靠性（尤其是 2.1 的点击修复，这是本次最高优先级）。
