# 友记 v0.2 · Bug 修复 + 关系状态化 星星/卡片/表单 设计文档

**日期**：2026-07-01
**状态**：已确认，待实现
**依赖**：`docs/superpowers/specs/2026-06-30-friend-star-map-design.md`（v0.1 基础设计，本文档只描述在其之上的变更）

---

## 一、背景

v0.1 完成后发现三个问题：

1. 点击已创建的好友星星打不开详情/编辑页
2. 新建好友表单不美观，字段平铺一长条
3. MBTI 被设为必填项，但用户不一定第一次就想填
4. 下拉框（`<select>`）选项对比度过低，看不清文字

同时用户咨询了产品建议，希望星星能反映"关系状态"而不只是 MBTI/星座的静态标签。本文档在修复三个 bug 的同时，落地专家建议中标记为 **V0.2** 的部分：档案完整度、星星成长阶段、关系温度、聊天提示、生日状态、以及更丰富的好友卡片。V0.3 及以后（今日星象面板、孤星、共同标签关系线、时间旅行等）不在本文档范围内。

---

## 二、Bug 修复

### 2.1 点击星星打不开

**根因**：`StarMap.tsx` 只注册了 `mousemove` 做 hover 检测，`hoveredFriend` 随鼠标位置实时更新；`FriendCard` 弹出位置跟随鼠标（`x: e.clientX+22`）。当用户把鼠标从星星移向卡片上的"编辑"链接时，鼠标已经离开星星的碰撞体（`hitMesh`），`hoveredFriend` 被清空，卡片随之消失，用户点不到按钮。且从未注册任何 `click` 事件——即使卡片不消失，直接点星星本身也没有反应。

**修复**：点击星星后把卡片"钉住"，不再跟随鼠标。

- `StarMap.tsx` 新增状态：`pinnedFriendId: string | null`、`pinnedPos: {x,y} | null`
- `mousedown`/`mouseup` 增加位移阈值判断（<5px 视为点击，否则视为拖拽）
- 点击命中星星时：`setPinnedFriendId(friendId)`，`setPinnedPos` 记录当前鼠标屏幕坐标（此后不再更新，直到下次点击/取消）
- 点击空白处（raycaster 未命中任何星星）或按 `Escape`：清空 pinned 状态
- 当存在 pinned 好友时，hover 产生的临时预览卡片不再显示（避免两张卡片同时出现），但 hover 高亮关系线/星星放大动效仍然保留
- `FriendCard` 增加 `pinned?: boolean` 与 `onClose?: () => void`，pinned 模式下右上角显示关闭按钮

### 2.2 新建好友表单重设计

- 顶部增加"快速添加 / 完整档案"模式切换（纯前端展示切换，不影响已填数据，切换只影响渲染哪些字段区块）
- **快速添加**（默认）：名字 *、备注（单行 input，写入 `notes`）、重要程度（"普通"/"重要 ✦" 两态按钮，写入新增的 `important: boolean`）
- **完整档案**：三个分区卡片——
  - 基本信息：名字、昵称、生日、重要程度
  - 性格与喜好（选填）：MBTI、喜欢、讨厌、兴趣爱好
  - 关系与备注：共同好友（`RelationshipEditor`，仅编辑已存在好友时显示，与现状一致）、备注（改为 textarea，同一个 `notes` 字段）
- 保存逻辑不变（`saveFriend` + `pushFriend`），两种模式共用同一个 `<form>` 和同一套 state，只是显示的字段区块不同

### 2.3 MBTI／生日改为选填

- `Friend.mbti`、`Friend.birthday`、`Friend.zodiac` 由必填改为可选（详见数据模型章节）
- `FriendForm` 提交校验只保留 `name` 必填；移除 `mbti`、`bday` 的 `required` 属性和校验判断
- `generateStarConfig` 与相关渲染代码对 `mbti`/`zodiac` 缺失做默认降级（见下）

### 2.4 下拉框对比度修复

`globals.css` 新增：

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

作用域仅限站内 `<select>`（当前只有 MBTI 一处），不影响其他原生控件。桌面端 Chrome/Edge/Firefox 均支持 `<option>` 的 `background-color`，覆盖系统默认白底问题。

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

`StarConfig` 本身不变（仍是 kind/coreColor/glowColor/size/twinkleSpeed/position）。成长阶段、守护环、生日环**不写入** `StarConfig`，理由见下节。

---

## 四、V0.2 关系状态功能

### 4.1 架构决定：运行时计算，而不是烘焙进 StarConfig

专家建议里把成长阶段/生日环等都塞进 `StarConfig` 持久化字段。这里改成运行时计算：`StarBuilder.buildStar(friend)` 本来就接收完整 `friend` 对象，可以直接在构建星星外观时调用下面几个纯函数得到当前状态。

原因：`StarConfig` 只在 `FriendForm` 提交时通过 `generateStarConfig()` 重新生成一次；而添加回忆走的是 `MemoryTimeline` → `handleMemoriesChange`，并不会重新生成 `starConfig`。如果把成长阶段焼进 `size` 里，用户加完第 3 条回忆、星星应该从"幼星"变成"恒星"，但实际不会变，除非用户回到编辑表单重新点一次保存——体验割裂。改为运行时计算后，任何数据变化（加回忆、标记重要、生日临近）都会在下次渲染时立刻反映在星星外观上。

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
- `updatedAt` 或最近一条 memory 的 `date` 在 30 天内 +3
- 每条 relationship 按 `closeness` 值加分（1~3）

等级：0-2 `low`，3-6 `medium`，7-12 `high`，13+ `legendary`。百分比显示用 `min(score/15, 1) * 100%` 做粗略换算（15 分封顶为 100%）。

**`lib/conversationHint.ts`**

```ts
export function generateConversationHint(friend: Friend): string
```

V0.2 用模板规则，不接 AI（真正的自然语言生成放到 V0.4 AI 图鉴）：
1. 有 memory → 用最近一条的标题："下次可以问问 TA 最近的『{title}』"
2. 否则有 hobbies → "可以聊聊 TA 的兴趣爱好：{hobbies[0]}"
3. 否则有 likes → "可以聊聊 TA 喜欢的：{likes[0]}"
4. 都没有 → "还不了解 TA，下次可以多问问喜好"

**`lib/birthdayStatus.ts`**

```ts
export function getBirthdayStatus(birthday?: string): {
  daysUntil: number | null
  label: string | null      // "3 天后生日" / "今天生日 🎂"
  isToday: boolean
  isSoon: boolean            // 0 < daysUntil <= 7
}
```

无 `birthday` 时全部返回 `null`/`false`。跨年按下一次生日计算天数差。

**`lib/profileCompletion.ts`**

```ts
export function calculateProfileCompletion(friend: Friend): {
  percent: number
  missing: string[]   // ["生日", "至少一条回忆"]
}
```

权重（与专家建议一致，合计 100）：生日 15 / MBTI 10 / 喜欢 15 / 讨厌 10 / 兴趣 10 / 备注 10 / 至少一条回忆 20 / 至少一张照片 10。

### 4.3 星星外观增强（`StarBuilder.ts`）

在 `buildStar(friend)` 内部，取 `cfg = friend.starConfig` 后：

```ts
const { stage } = getGrowthStage(friend)
const STAGE_SIZE: Record<GrowthStage, number> = {
  dust: 0.55, young: 0.75, bright: 1.0, stellar: 1.15, 'constellation-core': 1.3,
}
const size = cfg.size * STAGE_SIZE[stage]           // 替换函数体内所有 cfg.size 的使用
const twinkleSpeed = stage === 'dust' ? cfg.twinkleSpeed * 1.6 : cfg.twinkleSpeed
```

- 现有 6 个 `switch(cfg.kind)` 分支里的 `cfg.size` 全部替换为局部变量 `size`
- 追加：`friend.important === true` → 加一层静态金色守护环（复用 `ringTex`，缓慢旋转，透明度低于生日环）
- 追加：`getBirthdayStatus(friend.birthday).isSoon || isToday` → 加一层脉冲金色生日环（比守护环更亮/更快），两者可以同时出现，半径不同避免重叠

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
{mbti ? mbti+' · ' : ''}{zodiac ?? ''} · {growthStage.label}
{important && '✦ 重要'}  {birthdayStatus.label}

关系温度：{energy.level}（{percent}%）
{energy.lastActivityText}

下次可以聊：{conversationHint}

档案完整度：{completion.percent}%（仅 <100% 时显示）
建议补充：{completion.missing.join('、')}

[编辑]  [{atlasId ? '图鉴' : '生成图鉴'}]
```

字段全部做存在性判断，缺失的部分（无 mbti/zodiac 等）直接跳过对应片段，不显示占位符或"undefined"。

---

## 五、Supabase SQL

**无需迁移。** `supabase-schema.sql` 中 `friends.data` 列是 `jsonb`，本次所有改动（`mbti`/`birthday`/`zodiac` 变选填、新增 `important`）都只是 TypeScript 类型层面和 JSON 内容层面的变化，`jsonb` 列本身不做结构校验。已存在的记录（旧数据 mbti/birthday 必然有值）依然是新类型的合法子集；新建的轻量好友即使缺字段也能直接以合法 JSON 存入。不修改 `supabase-schema.sql`。

---

## 六、兼容性

- 旧 `Friend` 记录没有 `important` 字段 → `lib/store.ts` 的 `getFriends()` 读取时做兜底：`{ ...f, important: f.important ?? false }`，避免下游 `friend.important === true` 判断出错
- 旧记录的 `mbti`/`birthday`/`zodiac` 本来就是必填，不受影响，`getGrowthStage`/`profileCompletion` 等函数只是把这些字段当"更完整"处理
- 新建的轻量好友可能没有 `mbti`/`birthday`/`zodiac`，所有读取这些字段的地方（`FriendCard`、`StarBuilder`、`generateStarConfig`）都已按可选处理，不会因 `undefined` 崩溃

---

## 七、涉及文件

**修改**：
- `lib/types.ts` — Friend 字段可选化 + `important`
- `lib/store.ts` — `getFriends()` 兜底 `important`
- `lib/starGen.ts` — mbti/zodiac 缺失降级
- `lib/zodiac.test.ts`（如需要，补充边界用例，非必须改动）
- `components/FriendForm.tsx` — 快速/完整模式、分区布局、必填校验调整、重要程度字段
- `components/FriendCard.tsx` — pinned 模式重设计
- `components/StarMap/StarMap.tsx` — 点击钉住逻辑（drag/click 区分、Escape、blank-click 清除）
- `components/StarMap/StarBuilder.ts` — 成长阶段尺寸/光晕、守护环、生日环
- `app/globals.css` — select/option 深色样式

**新增**：
- `lib/growthStage.ts` + `lib/growthStage.test.ts`
- `lib/friendEnergy.ts` + `lib/friendEnergy.test.ts`
- `lib/conversationHint.ts` + `lib/conversationHint.test.ts`
- `lib/birthdayStatus.ts` + `lib/birthdayStatus.test.ts`
- `lib/profileCompletion.ts` + `lib/profileCompletion.test.ts`

**不改动**：`supabase-schema.sql`、`lib/supabase.ts`、`app/atlas/*`、`app/api/generate-atlas/*`、`components/MemoryTimeline.tsx`、`components/RelationshipEditor.tsx`、`components/StarMap/constellationLines.ts`、`components/StarMap/scene.ts`、`components/StarMap/starfield.ts`、`components/StarMap/mouseTrail.ts`、`components/StarMap/OrreryEntry.tsx`

---

## 八、测试计划

- 单元测试（vitest）：新增 5 个 lib 模块各自的边界用例（空数据/满分数据/临界值），`starGen.test.ts` 补充 mbti/zodiac 为 `undefined` 的用例，`store.test.ts` 补充旧数据缺 `important` 字段的读取用例
- 手动验证（`/run` 或本地 `npm run dev`）：
  1. 新建一个只填名字的好友 → 星星应该是"星尘"外观（小、暗），点击能打开、能看到"档案完整度"提示
  2. 标记为"重要" → 星星出现金色守护环
  3. 生日改成 3 天后 → 星星出现生日环，卡片显示"3 天后生日"
  4. 给好友加 3 条回忆 → 不重新编辑表单，直接回星图看，星星应变大（成长为恒星），无需手动"保存"触发
  5. 点击星星 → 卡片钉住，移动鼠标去点"编辑"按钮 → 能正常跳转（验证 bug 2.1 修复）
  6. 新建好友表单：切换快速/完整模式，MBTI 下拉框文字清晰可读
- `npm run lint` / `npm run typecheck`（如有）/ `npm run test` 全部通过

---

## 九、暂缓（不在本次范围）

今日星象面板、孤星标记、共同标签关系线、时间旅行模式、朋友宇宙统计页、AI 图鉴、关系趋势升温/变冷、image upload —— 均按专家建议留到 V0.3 及以后，单独立项设计。
