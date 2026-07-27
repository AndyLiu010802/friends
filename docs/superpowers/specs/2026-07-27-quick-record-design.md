# 快速记录(第二期·记录更快捷)— 设计文档

日期:2026-07-27
来源:对话内头脑风暴,用户批准"表单简化 + 全局快记"范围与四块设计。

## 背景

四期路线的第二期。用户诉求:记录不要繁琐——不填标题、日期时间自动取当下、去掉
表情/发起人选择;由 AI 根据随手描述生成利于分析的结构化输入。关键约束:`title`/
`tags`/`valence`/`initiator` 是图鉴 AI(`prompts.ts`)、置信度(`atlasConfidence`)、
对话提示(`conversationHint`)的养料,**只能改采集方式,不能砍数据**。

## 总体形态

- 新记录 = 一个 textarea + 保存按钮。保存时调用 AI 提取结构化字段,一次性写入;
  提取失败静默降级,永不阻塞保存。
- 编辑已有记录 = 保留完整表单(日期/时间/标题/描述/标签/情绪/发起人),
  是修正 AI 结果的地方。
- 全局「✎ 记一笔」浮层:任意接入页 `Ctrl+J` 或导航按钮唤起,选人(复用第一期
  `friendSearch`)→ 打一句话 → 保存。

## 数据模型

`lib/types.ts` 的 `Memory` 新增可选字段:

```ts
time?: string // HH:mm,记录时刻;新记录自动生成,旧数据无此字段
```

`normalizeFriend` 对 `memories` 整组透传,无需改动(需回归测试确认:无 `time`
的旧记录读取/渲染不崩)。时间线展示 `date` 后跟 `time`(有才显示)。同日多条按
`date` 降序、同日内按 `time` 降序排(无 time 视为 '00:00')。

## AI 提取

**新路由 `app/api/ai/extract-memory/route.ts`**(模式复用 ask-atlas:
`isAuthorized` 鉴权、`generateWithAI`、`safeParseAIJson`):

- 请求:`{ text: string, friendName: string }`;text 为空或非法返回 400。
- Prompt 要点:输出纯 JSON `{ title, tags, valence?, initiator? }`;
  title ≤12 字、概括事件不带日期;tags 0-3 个短词;valence/initiator 仅在文本
  能明确推断时给出,否则省略(宁缺勿错);全部中文。
- `OUTPUT_LIMITS` 新增 `extract`(小额度,约 200 token)。
- 响应:`{ ok: true, title, tags, valence?, initiator? }`;AI 失败或解析失败
  返回 `{ ok: false }`(HTTP 200,客户端统一走降级,不区分失败原因)。

**客户端 `lib/quickMemory.ts`**(纯函数 + fetch 封装,配单测):

```ts
fallbackTitle(text: string): string
// 取首个句读(。!?!?\n)前的内容,截 12 字;全空白时返回「随手一记」

extractMemory(text: string, friendName: string): Promise<ExtractResult | null>
// POST /api/ai/extract-memory,AbortController 5s 超时;任何失败(网络/超时/
// ok:false/字段缺失)返回 null

buildQuickMemory(text: string, extract: ExtractResult | null, now: Date): Memory
// date/time 取 now;extract 为 null 时 title=fallbackTitle(text)、tags=[]、
// 无 valence/initiator;content 恒为原文
```

## 新记录表单(MemoryTimeline)

- 展开后仅:textarea(rows 3)+ 保存按钮。placeholder 从固定数组轮换
  (按展开次数取模):「发生了什么?随手一记,AI 会整理好标题、标签和心情」、
  「TA 今天说了什么让你在意的话?」、「记下 TA 的原话,比『他人很好』更有用」。
- 保存流程:内容为空不提交;按钮变「AI 整理中…」并禁用 → `extractMemory` →
  `buildQuickMemory` → `onChange` 保存 → 表单收起。
- 编辑表单在现有字段基础上补 `time` 输入(`type="time"`),其余不变。

## 全局快记浮层(QuickNoteOverlay)

新组件 `components/QuickNoteOverlay.tsx`,受控模式同 SearchOverlay:

- Props:`{ friends, open, onOpenChange, defaultFriendId?, onSaved }`。
- 快捷键 `Ctrl/Cmd+J`,捕获阶段监听,守卫与 SearchOverlay 一致(IME
  isComposing、关闭时输入框聚焦不劫持、Esc preventDefault 关闭)。
- 两步:①选人——搜索框 + `searchFriends` 结果列表(行样式同寻星浮层);
  `defaultFriendId` 存在时直接进入第二步(仍可返回换人)。②记录——顶部显示
  所选好友名(星色圆点),textarea + 保存按钮,保存流程同上(AI 整理中 → 写入)。
- 写入:`getFriends()` 找到好友 → 追加 memory 并按上述规则排序 → `saveFriend`
  → `pushFriend().catch(console.error)` → 调 `onSaved(friendId)` → 浮层内短暂
  显示「已记入 ✦ XX 的星尘」(1.2s)后自动关闭并重置。
- 空好友列表:显示「你的宇宙还空着」+「✦ 新纪录」链接(同寻星浮层)。

**页面接入**:

- 首页导航按钮组新增「✎ 记一笔」(寻星左侧,同款胶囊样式);`onSaved` 后
  `setFriends(getFriends())` 刷新星图数据。挂载于 entered 分支。
- 好友详情页头部行新增「✎ 记一笔」(寻星左侧,同款无边框样式);
  `defaultFriendId` 传当前好友;`onSaved` 后重读 `getFriends()` 刷新
  `friend`/`allFriends` 状态。
- 与 SearchOverlay 并存:两浮层互斥由各自 open 状态天然保证,不做联动。

## 错误处理

- AI 不可用/未配 key/离线:`extractMemory` 返回 null,走降级字段,保存照常。
- 好友在保存瞬间被删(极端):找不到 id 则丢弃本次输入并显示「好友不存在」。
- 空 textarea:保存按钮禁用。

## 测试

- `lib/quickMemory.test.ts`:fallbackTitle(句读/超长/空白)、buildQuickMemory
  (降级与非降级、date/time 生成)、extractMemory(mock fetch:成功/超时/
  ok:false → null)。
- `app/api/ai/extract-memory/route.test.ts`:400 参数校验、成功解析、AI 失败
  返回 ok:false(模式仿 ask-atlas 测试)。
- `components/QuickNoteOverlay.test.tsx`:两步流转、defaultFriendId 直达第二步、
  Ctrl+J/Esc/IME 守卫、保存回调与降级路径、空好友态。
- `MemoryTimeline` 测试更新:textarea 快速保存(mock extractMemory)、编辑表单
  含 time、旧数据无 time 渲染回归。
- E2E(verify 技能):首页 Ctrl+J 快记 → 好友页时间线出现该记录(mock AI 上游
  返回固定提取结果);断开 AI(不起 mock)再记一条 → 降级标题正确。
