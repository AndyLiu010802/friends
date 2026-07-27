# UI/UX 三大件整改 — 设计文档

日期：2026-07-08
来源：UI/UX 评审（对话内完成），用户批准"三大件"范围。

## 背景

评审结论：概念（朋友=星星）与配色纪律很强，但排版可读性差（10–11px 中文衬线 + 透明度堆层级）、
首次体验缺失（入场页是过路费、空状态一片黑、3D 交互零提示）、动效未服务于空间叙事
（卡片瞬移而非相机飞行）。本次修三件事，分三批提交。

## 批次一：设计 token 整顿

**新模块 `lib/ui/tokens.ts`**（TS 常量，因全站为内联样式；`app/globals.css` 的 `@theme`/`:root` 同步更新，注释指明 tokens.ts 为唯一事实源）：

- **字阶（px）**：`display: 28`（Ma Shan Zheng 大标题）、`title: 16`、`body: 14`、`sub: 13`、
  `meta: 12`、`eyebrow: 10`。规则：中文正文最小 13，中文辅助信息最小 12；10px 仅限纯拉丁
  eyebrow（如 "FRIEND ATLAS"）；中文正文不加 letterSpacing，字距只用于标题/按钮。
- **文字三档（实色，不再用透明度造层级）**：
  - `text: '#ece7db'`（主文）
  - `textDim: '#b3ab9b'`（次文，对比度 ≈9:1）
  - `textFaint: '#847d6f'`（弱文，≈4.7:1，仅用于 12px 及以上）
  - 强调色文字：`gold: '#e2b96f'`、`goldMuted: '#a98f5e'`、`purple: '#a99dd1'`、`purpleMuted: '#847aa8'`
- **边框/表面（允许 alpha）**：`borderGold: rgba(226,185,111,0.3)`、`borderGoldFaint: rgba(226,185,111,0.15)`、
  `borderPurple: rgba(155,142,196,0.3)`、`cardBg: rgba(4,7,20,0.94)`、`inputBg: rgba(255,255,255,0.04)`、
  `chipBg: rgba(226,185,111,0.12)`
- **圆角四档**：`sm: 8`（输入框/小按钮）、`md: 12`（卡片）、`lg: 16`（bottom sheet）、`pill: 999`（胶囊按钮）。
  现有 6/10/14/20/22 全部归并到最近档位。
- **字体**：`fontSerif` / `fontHand` 常量。
- `globals.css` 补 `color-scheme: dark`（修暗色下日期选择器/滚动条/自动填充）。

**替换范围**：components/ 与 app/ 下全部界面文件（约 15 个）。视觉意图不变，只收敛数值。

## 批次二：入场兼职加载 + 空状态 + 首次提示

**数据所有权上移**：`HomePage` 挂载即开始 `pullAll()`（不等点击），持有 `friends` 与
`dataReady` 状态；`StarMap` 改为接收 `friends` prop，删除其内部 `pullAll`。

**OrreryEntry 改造**：

- 新增 `ready: boolean` prop。未就绪时副标题显示"正在校准星轨…"；就绪后显示"点击进入"，
  并在满足最短展示时长（1.6s）后自动进入；点击可随时跳过等待直接进入
  （数据未到也放行——星图用本地 store 数据先渲染）。
- 品牌统一：入场页"朋友笔记"改为"友记"（与导航/标题一致）。

**空状态**：`dataReady && friends.length === 0` 时，星图上方居中覆盖层——一颗呼吸的幽灵星
（复用入场页恒星样式）+「你的宇宙还空着——点亮第一位朋友」+ CTA 按钮 → `/friend/new`。

**首次操作提示**：`dataReady && friends.length > 0 && !localStorage['youji-hint-seen']` 时，
底部居中淡入一行提示（桌面："拖动旋转 · 滚轮缩放 · 点击一颗星"；移动："拖动旋转 · 双指缩放 ·
点一颗星"），5s 后淡出并写入标记，不再出现。

**错误处理**：`pullAll` 失败不阻塞进入——`dataReady` 仍置 true，用本地 localStorage 数据渲染，
行为与现状一致（console.error）。

## 批次三：星星 stagger 入场 + 相机飞行

- **stagger**：`buildStar(friend, appearDelay)` 增加延迟参数；StarMap 按索引传
  `min(i * 0.06, 2)` 秒。连线材质 opacity 从 0 淡入至目标值，整体延迟 ~1s（星星大半出现后）。
- **入场推镜**：经入场页进入时（`hasEnteredThisPageLoad` 为 false 的那一次），相机 z 从 26
  dolly-in 到 9（1.8s，power3.out），与 stagger 同时进行；从编辑页返回等二次进入不重播。
- **相机飞向选中星**：从 InsightPanel 选中朋友时，不再把卡片硬钉屏幕中央——
  用 quaternion slerp 补间 pivot 旋转，使目标星转到镜头正前方，同时相机 z 拉近；
  到位后 FriendCard 在星星的**投影屏幕坐标**处淡入。用户开始拖拽即取消飞行补间。
- **视口夹取**：新增 `clampToViewport(x, y, cardW, cardH)` 工具，hover 卡与 pinned 卡共用，
  修复卡片在屏幕边缘溢出。

## 不做的事（YAGNI）

- 不引入 Tailwind 类重写（token 先以 TS 常量收敛，样式架构迁移另议）。
- 不做 ConfirmDialog / 自动保存模型 / next/font / bottom sheet 把手（属"全部修"范围，后续批次）。
- 连线不做 dash 描画动画，只做透明度淡入（静谧优先）。

## 测试与验收

- 每批提交前：`vitest` 全绿 + `next build` 通过。
- 批次二新逻辑（首提示 localStorage 门控、空状态条件）补组件测试；
  StarMap prop 化后更新受影响测试。
- 手动验收：桌面 + 移动视口各过一遍入场 → 空状态 → 添加朋友 → 选中/飞行 → 编辑返回。
