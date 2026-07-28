# PWA 完全体(第四期·移动端体验)— 设计文档

日期:2026-07-28
来源:对话内头脑风暴,用户批准整体设计。

## 背景

四期路线的最后一期。2026-07-08 的移动端适配已完成触控手势、底部抽屉、性能降级、
manifest、图标、防缩放,当时明确推迟的缺口是 Service Worker/离线与安装引导。
数据本就以 localStorage 为事实源,补上应用外壳缓存即可让已安装的 PWA 断网全功能可用。

**明确不做**:Web Push 远程推送(需推送服务器与订阅管理,依赖重;本地 Badging +
打开即见的星语提醒已覆盖核心诉求)。

## 1. Service Worker(`public/sw.js`,手写零依赖)

经典脚本(非 module),自带版本常量 `const CACHE = 'youji-v1'`(后续改动递增)。

**fetch 策略**:
- 仅处理同源 GET;其余(POST、跨域如 Supabase)直接放行不拦截。
- `/api/` 前缀:不拦截(AI 路由永远走网络,失败由客户端降级逻辑处理)。
- 路径以 `/_next/static/` 开头:**缓存优先**(内容哈希不可变),未命中则网络并写缓存。
- `request.mode === 'navigate'`(页面导航):**网络优先**,成功后把响应写入缓存
  (以 `/` 为 key 统一存外壳——App Router 各路由 HTML 外壳等价,断网时任何导航都
  回退到缓存的 `/`);网络失败回退 `caches.match('/')`。
- 其余同源 GET(如 `/icon.svg`、字体等):**stale-while-revalidate**(先回缓存,
  后台刷新)。

**生命周期**:`install` 时 `skipWaiting`(不预缓存清单——运行时缓存足够,避免维护
预缓存列表);`activate` 时删除非当前 `CACHE` 的旧缓存并 `clients.claim()`。

## 2. 注册与安装状态(`components/PwaSetup.tsx`)

Client 组件,挂在 `app/layout.tsx`(children 旁,渲染 null):

- `useEffect` 中:`process.env.NODE_ENV === 'production'` 且
  `'serviceWorker' in navigator` 时 `navigator.serviceWorker.register('/sw.js')`,
  失败 `console.error` 静默。
- 捕获 `beforeinstallprompt`:`preventDefault` 后把事件存入模块级变量,并派发
  自定义事件 `youji:install-ready`(设置页安装面板监听它切换可安装状态)。
  模块导出:
  ```ts
  getInstallPrompt(): BeforeInstallPromptEvent | null
  promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'>
  ```
  (类型自定义声明;prompt 用后置空并再派发事件。)

## 3. 安装引导面板(`components/InstallPanel.tsx`,设置页新区块)

设置页(`app/settings/page.tsx`)在现有面板之后新增「安装到主屏」区块,三态:

- **已安装**:`matchMedia('(display-mode: standalone)').matches` 为真 →
  「已安装,正以独立应用运行 ✓」。
- **可一键安装**:`getInstallPrompt()` 非空(含挂载后监听 `youji:install-ready`)→
  「⊕ 安装友记」按钮 → `promptInstall()`;accepted 后显示「已安装」。
- **iOS Safari**(`/iphone|ipad|ipod/i.test(navigator.userAgent)` 且非 standalone):
  两步说明文字:「1. 点浏览器底部 分享 按钮 2. 选择『添加到主屏幕』」。
- 其余(桌面 Firefox 等不支持安装):显示「当前浏览器不支持安装,可直接收藏本页」。

判定顺序:standalone > 可安装 > iOS > 不支持。样式沿用设置页现有面板 token。

## 4. 应用角标(`lib/appBadge.ts`)

```ts
updateAppBadge(count: number): void
// 特性检测 navigator.setAppBadge/clearAppBadge;count>0 → setAppBadge(count),
// 否则 clearAppBadge;不支持或抛错一律静默。
```

接线:HomePage 已计算 `insights`——`useEffect` 中
`updateAppBadge(insights.filter(i => i.priority === 3).length)`,依赖 insights 长度
相关值(实现计划定夺依赖形式)。

## 5. 触觉反馈

`QuickNoteOverlay` 保存成功(进入 done 态处)`navigator.vibrate?.(10)`,
特性检测,失败静默。

## 错误处理

- SW 注册失败、缓存 API 抛错:静默(应用完全不依赖 SW 才能工作)。
- Badging/vibrate 不支持:静默跳过。
- 开发模式不注册 SW,避免缓存干扰开发。

## 测试

- `lib/appBadge.test.ts`:支持时 set/clear 调用正确、不支持时不抛错。
- `components/PwaSetup.test.tsx`:生产环境注册被调用(mock navigator.serviceWorker
  与 NODE_ENV)、开发环境不注册、beforeinstallprompt 被捕获后 getInstallPrompt 非空
  且 promptInstall 走 accepted 流程。
- `components/InstallPanel.test.tsx`:四态渲染(standalone / 可安装点击走
  promptInstall / iOS 文案 / 不支持文案)。
- `public/sw.js` 本体:不做 jsdom 单测;E2E 验收:
  1. 生产构建启动 → 首次访问注册 SW → 二次访问后 `context.setOffline(true)` →
     reload → 应用外壳加载、localStorage 好友数据照常渲染星图。
  2. 断网状态下快记一条(AI 降级标题)成功落库。
  3. `/api/` 请求确认未被缓存(断网时 fetch 失败而非返回缓存)。
- E2E 注意:Playwright 需 `serviceWorkers: 'allow'`(默认允许)且用生产 `next start`。
