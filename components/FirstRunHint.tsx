'use client'
import { useEffect, useState } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { fs, text, surface, border, radius, font } from '@/lib/ui/tokens'

const KEY = 'youji-hint-seen'
const SHOW_MS = 5000

/** 首次进入星图时的一次性交互提示，展示 5 秒后永久消失 */
export default function FirstRunHint() {
  const isMobile = useIsMobile()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(KEY)) return
    localStorage.setItem(KEY, '1')
    // 一次性 localStorage 门控，挂载时判定一次，没有渲染期替代方案
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true)
    const t = setTimeout(() => setVisible(false), SHOW_MS)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null
  return (
    <div style={{ position:'fixed', left:'50%', transform:'translateX(-50%)',
      bottom:'calc(72px + env(safe-area-inset-bottom))', zIndex:25,
      background: surface.card, border:`1px solid ${border.goldFaint}`,
      borderRadius: radius.pill, padding:'10px 22px', backdropFilter:'blur(12px)',
      color: text.dim, fontSize: fs.meta, fontFamily: font.serif, letterSpacing:1,
      pointerEvents:'none', whiteSpace:'nowrap' }}>
      {isMobile ? '拖动旋转 · 双指缩放 · 点一颗星' : '拖动旋转 · 滚轮缩放 · 点击一颗星'}
    </div>
  )
}
