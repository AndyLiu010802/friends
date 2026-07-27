// 全站视觉 token 唯一事实源。app/globals.css 的 @theme / :root 需与此同步。
//
// 排版规则：
// - 中文正文最小 fs.sub(13)，中文辅助信息最小 fs.meta(12)
// - fs.eyebrow(10) 仅限纯拉丁 eyebrow（如 "FRIEND ATLAS"）
// - 中文正文不加 letterSpacing；字距只用于标题/按钮/eyebrow

export const fs = {
  hero: 36,      // 图鉴页主标题（Ma Shan Zheng），全站仅一处
  display: 28,   // 页面大标题（Ma Shan Zheng）
  title: 16,     // 卡片标题/人名
  body: 14,      // 正文
  sub: 13,       // 次级正文（卡片内容、按钮文字）
  meta: 12,      // 辅助信息（日期、标签、完整度）
  eyebrow: 10,   // 仅拉丁 eyebrow
} as const

export const text = {
  primary: '#ece7db', // 主文（暖白）
  dim: '#b3ab9b',     // 次文，对黑底对比度 ≈9:1
  faint: '#847d6f',   // 弱文 ≈4.7:1，只用于 fs.meta 及以上字号
} as const

export const gold = { base: '#e2b96f', muted: '#a98f5e' } as const
export const purple = { base: '#a99dd1', muted: '#847aa8' } as const
export const danger = {
  text: '#f8a5a5',
  border: 'rgba(239,68,68,0.3)',
  borderFaint: 'rgba(239,68,68,0.15)',
  bg: 'rgba(239,68,68,0.04)',
} as const

export const border = {
  gold: 'rgba(226,185,111,0.3)',
  goldFaint: 'rgba(226,185,111,0.15)',
  goldStrong: 'rgba(226,185,111,0.4)',
  purple: 'rgba(155,142,196,0.3)',
} as const

export const surface = {
  card: 'rgba(4,7,20,0.94)',         // 浮层卡片底
  section: 'rgba(226,185,111,0.04)', // 页面区块底
  input: 'rgba(255,255,255,0.04)',
  chip: 'rgba(226,185,111,0.12)',
  raise: 'rgba(255,255,255,0.03)',   // 列表项/洞察按钮底
} as const

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const

export const font = {
  serif: "'Noto Serif SC', serif",
  hand: "'Ma Shan Zheng', cursive",
} as const
