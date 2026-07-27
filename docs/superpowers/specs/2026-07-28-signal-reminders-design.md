# 星语提醒(第三期·主动提醒)— 设计文档

日期:2026-07-28
来源:对话内头脑风暴,用户批准整体设计。

## 背景

四期路线的第三期。现有「今日星象」(`lib/insights.ts` + `components/InsightPanel.tsx`)
已覆盖生日(7 天)、超 60 天未记录、无记录、档案不全、重要好友 30 天无记录、孤星,
但有三个痛点:信号无法忽略(永远重复)、不可直接行动(只能飞星)、
`relationshipGoal`/valence/initiator 数据完全未被提醒层利用。

目标:把"提示"升级为**可行动、可忽略的提醒系统**,全部纯客户端,不引入系统通知
(Service Worker 归第四期 PWA)。

## 信号层(`lib/insights.ts` 扩展)

`FriendInsightType` 新增三类,`FriendInsight` 增加字段:

```ts
export type FriendInsightType =
  | 'birthday' | 'inactive' | 'incomplete' | 'recent-memory' | 'important' | 'lonely'
  | 'goal-drift'      // 关系目标偏离
  | 'one-sided'       // 单向发起
export interface FriendInsight {
  id: string
  type: FriendInsightType
  friendId: string
  friendName: string
  text: string
  priority: 1 | 2 | 3
  fingerprint: string   // 触发条件指纹,见「忽略」节
  dismissible: boolean  // 生日当天为 false,其余 true
}
```

新信号规则(全部纯函数,`now` 注入):

- **goal-drift·加深停滞**:`relationshipGoal === 'deepen'` 且最近记录距今 >30 天
  (或无记录)→「你想和{name}更近一步,最近却安静了」,priority 2。
- **goal-drift·修复受挫**:`relationshipGoal === 'repair'` 且最新一条记录
  `valence === 'negative'` →「修复中的关系,最近一次互动不太顺,也许该缓和一下」,
  priority 3。
- **one-sided**:记录 ≥5 条,且按日期最近的 5 条 `initiator` 全部为 `'me'`
  (缺 initiator 的记录不计入这 5 条的选取)→
  「最近都是你主动找{name},留意一下平衡」,priority 2。
- **生日三档**:`birthdayStatus.isSoon` 窗口从 7 天扩到 14 天:今天(priority 3,
  `dismissible: false`)/ 7 天内(priority 3)/ 8-14 天(priority 2)。
  `getBirthdayStatus` 增加 `isWithin14` 支持,原 `isSoon`(≤7)语义不变,
  其他调用方(FriendCard 等)不受影响。

现有六类信号保留,补上 `fingerprint`/`dismissible` 字段。总排序:priority 降序 →
生日优先 → 其余稳定;上限从 5 条放宽到 **8 条**(忽略某条后自然补位)。

## 忽略/暂缓(`lib/signalDismissals.ts` 新模块)

- 存储键 `yj_dismissed_signals`,内容 `Record<insightId, fingerprint>`。
- `fingerprint` 是触发条件的状态指纹,**状态变化即重新触发**:
  - birthday:`${下一个生日的 ISO 日期}-${档位}`(明年生日、进入更近档位都会重现)
  - inactive/important/goal-drift(加深):最近记录日期(或 'none')——新增记录后
    条件消失,再次超期是新指纹
  - goal-drift(修复):触发它的那条 negative 记录 id
  - one-sided:构成"最近 5 条"的记录 id 拼接
  - incomplete:completion.percent 所处十位档(如 '40')
  - lonely / recent-memory:最近记录日期(或 'none')
- API:
  ```ts
  getDismissals(): Record<string, string>
  dismissSignal(id: string, fingerprint: string): void
  filterDismissed(insights: FriendInsight[]): FriendInsight[]
  // 同 id 且指纹相同 → 滤掉;指纹不同 → 保留并清掉旧记录(状态已变化)
  ```
- 生日当天(`dismissible: false`)UI 不提供忽略按钮。
- 忽略记录为**设备本地状态,不进云备份**(丢失的代价只是再点一次「知道了」,
  不值得为此扩展备份通道)。

## 展示层(InsightPanel 升级为「星语提醒」)

- 标题「今日星象」→「星语提醒」;分组渲染:priority 3 →「今天必看」、
  priority 2 →「值得留意」、priority 1 →「顺手补全」;空组不显示组标题;
  全空时保留现有安静文案。
- 每条信号行:文本 + 行动区:
  - 「✎ 记一笔」→ 调 `onQuickNote(friendId)`(父页打开 QuickNoteOverlay 并预选
    该好友;QuickNoteOverlay 的 `defaultFriendId` 已支持,首页需把 noteOpen 与
    预选 id 状态化:`noteFriendId`)
  - 「去看看」→ 现有 `onSelectFriend`(飞星+卡片)
  - 「知道了」→ `dismissSignal` 并从列表即时移除(`dismissible: false` 不渲染)
- Props 变化:`InsightPanel({ friends, onSelectFriend, onQuickNote })`。
- **导航未读点**:存在 priority 3 且未被忽略的信号时,首页导航「✦ 友记」文字右上
  加金色小圆点(纯 CSS);移动端同样生效。计算复用同一份过滤后信号,由
  HomePage 计算后传入(避免 InsightPanel 未展开时不渲染导致不计算——信号计算
  提升到 HomePage,一次计算两处使用)。
- 好友页不加提醒入口(提醒是全局视角,首页承载)。

## 数据流

HomePage:`friends` → `generateFriendInsights(friends)` → `filterDismissed` →
传给 InsightPanel(渲染)与导航(未读点)。忽略操作由 InsightPanel 调
`dismissSignal` 后通过 `onDismissed()` 回调让 HomePage 重算(或 HomePage 持有
dismissals 状态传下,实现计划里定夺,倾向后者:`useState` 持有,回调更新)。

## 错误处理

- localStorage 读写全部 try/catch,失败静默(与 `lib/store.ts` 一致)。
- 无好友/无信号:面板安静文案不变;未读点不显示。
- 旧数据无 relationshipGoal/valence/initiator:对应信号自然不触发,无兼容问题。

## 测试

- `lib/insights.test.ts` 扩展:goal-drift 两条规则(含边界:无记录、非 repair、
  最新记录非 negative)、one-sided(不足 5 条不触发、混合 initiator 不触发、
  缺 initiator 的选取逻辑)、生日三档与 dismissible、fingerprint 各类型取值、
  8 条上限与排序。
- `lib/signalDismissals.test.ts`:dismiss/filter 往返、指纹变化重现并清旧、
  损坏 JSON 静默降级。
- `components/InsightPanel.test.tsx` 更新:分组渲染、知道了→即时消失+落库、
  不可忽略无按钮、记一笔/去看看回调。
- 首页接入的未读点:HomePage 层逻辑简单,由 E2E 覆盖。
- E2E(verify 技能):种子数据触发生日+goal-drift → 面板分组可见 → 知道了 →
  消失且刷新后仍消失 → 加一条记录(状态变化)→ 相关信号重现;未读点显隐;
  记一笔按钮直达 QuickNoteOverlay 预选好友。
