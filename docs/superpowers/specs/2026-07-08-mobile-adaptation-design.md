# 友记 · 手机端适配 设计文档

**日期**：2026-07-08
**状态**：已确认（卡片=底部抽屉；星象面板=胶囊收起；PWA=本次一起做）

## 一、目标

手机浏览器（及添加到主屏后的 PWA 全屏形态）上可以完成全部日常操作：逛星图、看好友卡片、录入/编辑好友与回忆、看图鉴、问答。桌面端行为保持不变。

## 二、现状问题（摸底结论）

| 问题 | 位置 | 后果 |
|------|------|------|
| 星图只监听 mouse 事件 | `components/StarMap/StarMap.tsx` | 手机无法拖拽旋转、无法缩放 |
| 好友卡片跟随指针坐标定位 | 同上 + `FriendCard.tsx` | 小屏溢出、不可用 |
| 今日星象面板固定 280px 右下常驻 | `components/InsightPanel.tsx` | 小屏遮挡星图 |
| `body { overflow: hidden }` 全局禁滚 | `app/globals.css` | 表单/设置/图鉴页在小屏内容超屏后无法滚动 |
| 输入框字号 13px | 各表单 | iOS 聚焦时强制放大整页 |
| 渲染像素比上限 2、星场 1500 粒子 | `components/StarMap/scene.ts` / `starfield.ts` | 手机掉帧、耗电 |
| 鼠标拖尾画布在触屏上照跑 | `components/StarMap/mouseTrail.ts` | 无意义开销 |
| 无 manifest | — | 无法安装到主屏 |

## 三、设计

### 1. 触屏手势（Pointer Events 统一）

`StarMap.tsx` 的 mousedown/mousemove/mouseup/wheel 全部改为 pointerdown/pointermove/pointerup（保留 wheel 给桌面滚轮）。canvas 样式加 `touchAction: 'none'`。

- **单指拖拽** = 旋转 pivot（沿用现有系数）。
- **双指捏合** = 缩放：两指间距变化映射到 `camera.position.z`，clamp [3.5, 16]（与滚轮一致）。捏合期间不旋转、不触发轻点。
- **轻点**（按下到抬起位移 < 5px 且非捏合）= 命中星星则弹卡片；空白处关闭卡片。
- **悬停预览**仅 `pointerType === 'mouse'` 时启用。
- 手势数学抽到 `lib/gestures.ts` 纯函数模块，单元测试覆盖：
  - `createPinchTracker()`：输入两指坐标流，输出缩放增量；单指/两指切换时状态正确复位。
  - `isTap(down, up)`：位移阈值判定。
  - `applyZoom(currentZ, delta)`：clamp 逻辑。

### 2. 设备判定

`lib/useIsMobile.ts`：`matchMedia('(max-width: 640px)')` 的 React hook，监听变化。jsdom 测试用 matchMedia mock。鼠标拖尾的启用判定用 `matchMedia('(pointer: fine)')`（在 StarMap 挂载时判断一次）。

### 3. 小屏布局

- **FriendCard** 加 `variant?: 'floating' | 'sheet'`（默认 floating，桌面现状不变）。`sheet`：`position:fixed; left:0; right:0; bottom:0`，全宽、顶部圆角、`maxHeight:60vh; overflow-y:auto`、滑入动画（CSS transition 即可）、内部按钮加大到 ≥44px 触达高度、底部留 `env(safe-area-inset-bottom)`。StarMap 内由 `useIsMobile` 决定 variant；手机上跳过 hover 卡片，pinned 卡片忽略指针坐标。
- **InsightPanel** 加移动形态：手机上默认渲染胶囊按钮（左下角 `✦ 今日星象 · N`，N=洞察条数；N=0 时不渲染），点击展开为底部列表（同 sheet 样式），点击洞察或收起按钮关闭。桌面现状不变。
- **顶部导航**（`app/page.tsx`）：手机上 padding 收紧为 `14px 16px`，「✦ 新纪录」链接触达区 ≥44px 高；顶部加 `env(safe-area-inset-top)`。
- **滚动修复**（`app/globals.css`）：去掉 `body { overflow: hidden }`，改为 `html, body { overscroll-behavior: none }`；星图首页本身没有常规流内容，不产生滚动条，其余页面恢复正常滚动。
- **输入防缩放**（`app/globals.css`）：`@media (max-width: 640px) { input, textarea, select { font-size: 16px !important; } }`（inline style 需要 !important 压制）。

### 4. 性能降级

`initScene(canvas, opts?)` 增加可选 `coarsePointer` 标志（由调用方用 `matchMedia('(pointer: coarse)')` 判定）：像素比上限 2 → 1.5。`buildStarfield(count = 1500)` 参数化，触屏传 750。

### 5. PWA

- `app/manifest.ts`（`MetadataRoute.Manifest`）：name/short_name「友记」、`display: 'standalone'`、`start_url: '/'`、`background_color/theme_color: '#020408'`、icons 指向 `/icon.svg`（any + maskable）与 `/apple-icon.png`。
- `app/icon.svg`：深夜蓝圆角方底 + 金色四芒星（手绘 SVG，与站内 ✦ 风格一致）。
- `app/apple-icon.png`：180×180 PNG（iOS 不认 SVG）。由 `scripts/generate-apple-icon.mjs`（纯 Node zlib 手写 PNG 编码，无新依赖）一次性生成后提交。
- `app/layout.tsx`：`export const viewport: Viewport = { themeColor: '#020408', viewportFit: 'cover' }`。
- Service Worker / 离线缓存：**本次不做**（应用 localStorage 优先，收益低）。

### 6. 测试策略

- 纯逻辑（gestures、useIsMobile、manifest 内容）与组件形态（FriendCard sheet、InsightPanel 胶囊/展开）：Vitest 先红后绿。
- StarMap 事件接线、scene 降级：类型检查 + 全量回归 + `npm run build` 兜底（Three.js/WebGL 在 jsdom 不可渲染）。
- 每任务一提交；收尾全量测试 + 构建。

## 四、不做的事（YAGNI）

Service Worker、快速记录悬浮球（属"录入摩擦"阶段）、星图力导向布局（属星图语义阶段）、平板专门断点（640px 一刀切）。
