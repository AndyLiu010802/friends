# 朋友星图 · 设计文档

**日期**：2026-06-30  
**项目名**：友记（Friend Star Map）  
**状态**：已确认，待实现

---

## 一、产品概述

一个私人朋友录网站。每个朋友是星空中一颗独一无二的星星，外观由其 MBTI、星座、喜好标签自动生成。网站深蓝金动漫风格，使用 Three.js + GSAP 实现沉浸式星空体验。

---

## 二、视觉风格

- **主色调**：深夜蓝（`#020408` 背景）+ 金色（`#e2b96f` 强调）+ 星云紫（`#9b8ec4` 辅助）
- **风格**：动漫风，不追求写实，偏向魔法典籍/星图仪器美学
- **字体**：Noto Serif SC（正文）+ 手写风格字体（标题/装饰）
- **鼠标特效**：移动时产生月亮碎片拖尾（弦月、尖刃、菱形、空心环四种形状，蓝银色系，向上飘散消失）；静止时无特效

---

## 三、技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 14（App Router） |
| 3D / 动画 | Three.js r134 + GSAP 3 |
| 样式 | Tailwind CSS + CSS 变量 |
| 数据库 | Supabase（PostgreSQL + Storage） |
| 本地缓存 | localStorage |
| 部署 | Vercel（可选） |

---

## 四、页面结构

```
/                    封面入口 → 星图主界面
/friend/new          新建好友记录
/friend/[friendId]   编辑好友记录
/atlas/[friendId]    查看该好友的图鉴报告（按 friendId 路由）
```

### 顶部菜单（星图界面常驻）

```
✦ 友记          [✦ 新纪录]   [搜索好友]
```

- **✦ 友记**：Logo，点击回到星图中心
- **✦ 新纪录**：跳转 `/friend/new`
- **搜索好友**：按名字搜索，摄像机飞行到对应星星

### 入口流程

1. 打开网站 → 看到**旋转星盘封面**（星象仪/orrery 风格，发光旋转）
2. 点击封面 → 星盘缩小消失，星图从中心展开放大
3. 进入**星图主界面**

---

## 五、星图主界面

### 导航

| 操作 | 效果 |
|------|------|
| 左键拖拽 | 平移摄像机，探索星图 |
| 滚轮 | 缩放 |
| 双击星星 | 摄像机飞行动画移动到该星星 |
| 悬停星星 | 弹出好友预览卡片 |
| 点击星星 | 进入编辑/详情 |

### 无限星空

- 星图不限于一屏，好友多时需拖拽探索
- 屏幕边缘有隐约星光提示"该方向还有好友"
- 每颗星有**排他保护圈**（最小间距 2.5 单位），放置时用 Poisson Disk Sampling 避免重叠

### 关系连线

- 互相认识的好友之间显示星座连线
- `closeness 1`：细虚线低透明度；`2`：实线；`3`：亮线 + 金色光晕
- 悬停星星时相关连线高亮，其余淡出
- 点击连线弹出关系卡片，显示共同好友

---

## 六、数据模型

### Friend

```ts
{
  id: string
  name: string
  nickname?: string
  birthday: string              // YYYY-MM-DD
  zodiac: string                // 由生日自动推算
  mbti: string
  likes: string[]
  dislikes: string[]
  hobbies: string[]
  portraits: Media[]            // 人物照片（多张）
  memories: Memory[]            // 行动记录
  relationships: Relationship[] // 与其他好友的关系
  notes?: string
  starConfig: StarConfig
  atlasId?: string
  createdAt: string
  updatedAt: string
}
```

### Memory（行动记录）

```ts
{
  id: string
  date: string
  title: string
  content: string
  tags: string[]
  media: Media[]               // 照片 + 视频混合
}
```

### Media（统一媒体对象）

```ts
{
  id: string
  type: 'photo' | 'video'
  url: string                  // Supabase Storage URL
  thumbnailUrl: string         // 图片压缩版 / 视频首帧截图
  caption?: string
  duration?: number            // 视频时长（秒）
  takenAt?: string
  size: number                 // bytes
}
```

### Relationship（好友关系）

```ts
{
  friendId: string             // 对方 ID
  label: string                // "高中同学" / "一起打球的"
  closeness: 1 | 2 | 3
}
```

### StarConfig（星星外观）

```ts
{
  kind: 'radiant' | 'nebula' | 'blossom' | 'pulsar' | 'giant' | 'twin'
  coreColor: string            // hex
  glowColor: string            // hex
  size: number                 // 0.5 ~ 1.5
  twinkleSpeed: number
  position: [number, number, number]  // 星图坐标，固定不变
}
```

### Atlas（图鉴报告）

```ts
{
  id: string
  friendId: string
  generatedAt: string
  summary: string
  personality: string
  predictions: string
  giftIdeas: string[]
  warnings: string[]
  rawInput: object             // 生成时的好友数据快照
}
```

### 存储策略

- **localStorage**：存全量 `friends[]` 和 `atlas[]`，打开即可用
- **Supabase**：`friends` 表 + `atlas` 表 + Storage bucket（图片/视频）
- **图片路径**：`friends/{friendId}/portraits/` 和 `friends/{friendId}/memories/{memoryId}/`
- **同步时机**：每次保存/新建/删除后推送；页面打开时拉取最新覆盖本地

---

## 七、星星外观生成规则

### 第一层：MBTI → 种类

优先级：**E/I + N/S 组合**优先，第三/四字母作微调。

| MBTI 前两位 | 种类 | 特征 |
|-------------|------|------|
| EN（外向直觉） | `radiant` | 射线光芒，最亮；F 型光晕更柔，T 型射线更锐 |
| IN（内向直觉） | `nebula` | 多层光晕；F 型偏紫粉，T 型偏冷蓝 |
| ES（外向实感） | `blossom` | 轨道粒子环绕；F 型粒子密，T 型粒子少但快 |
| IS（内向实感） | `giant` | 体积最大，带土星环；J 型环规则，P 型环略歪 |

### 第二层：星座元素 → 色调

| 元素 | 星座 | 核心色 | 光晕色 |
|------|------|--------|--------|
| 火 | 白羊/狮子/射手 | `#ef4444` | `#f59e0b` |
| 土 | 金牛/处女/摩羯 | `#d97706` | `#fbbf24` |
| 风 | 双子/天秤/水瓶 | `#38bdf8` | `#818cf8` |
| 水 | 巨蟹/天蝎/双鱼 | `#7c3aed` | `#ec4899` |

### 第三层：喜好标签 → 微调

- 音乐/艺术 → 闪烁加快，光晕更柔
- 运动/户外 → 轨道粒子速度加快
- 读书/独处 → 尺寸略小，脉冲更慢
- MBTI P 型 → 轨道微椭圆
- MBTI J 型 → 轨道完美圆形

---

## 八、四大功能流程

### 1. 新纪录 `/friend/new`

- 星尘汇聚动画进入表单
- 填写：名字、昵称、生日（自动推算星座）、MBTI、portraits、喜欢/讨厌/兴趣爱好标签、关系、备注
- 保存 → 生成 StarConfig → 星星闪现进入星图 → 摄像机飞行到新星星

### 2. 编辑 `/friend/[id]`

- 点星星 → 预览卡片 → 「编辑」→ 预填表单
- 行动记录（Memory）在底部时间线管理：填日期/标题/内容/上传 Media
- 关系管理：添加/删除与其他好友的连接

### 3. 生成图鉴

- 好友页底部「✦ 生成图鉴」按钮（需已填基本信息）
- 确认 → 调用 AI API（Claude，接口预留，具体后续确认）
- 生成中：星尘旋转加载动画
- 完成 → 跳转图鉴页

### 4. 查看图鉴 `/atlas/[friendId]`

- 卷轴展开动画，深蓝金羊皮纸风格
- 内容：人物总结、性格分析、喜好预测、礼物建议、相处注意事项
- 左右箭头翻看其他好友图鉴
- 底部可重新生成

---

## 九、暂缓事项

- AI 图鉴生成的具体 prompt 设计和 API 选型（后续单独讨论）
- 视频上传的大小限制和压缩策略（Supabase 免费版 50MB/文件）
- `.superpowers/` 需加入 `.gitignore`
