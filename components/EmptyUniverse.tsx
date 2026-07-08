'use client'
import Link from 'next/link'
import { fs, text, gold, border, radius, font } from '@/lib/ui/tokens'

/** 星图零好友时的首次引导覆盖层（不拦截星图交互，只有 CTA 可点） */
export default function EmptyUniverse() {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:15, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:24, pointerEvents:'none' }}>
      <div style={{ width:28, height:28, borderRadius:'50%',
        background:'radial-gradient(circle, #fff 0%, #e2b96f 40%, transparent 70%)',
        boxShadow:'0 0 24px #e2b96f, 0 0 72px rgba(226,185,111,0.4)',
        animation:'youji-breathe 4.5s ease-in-out infinite' }} />
      <div style={{ color: text.primary, fontSize: fs.title, fontFamily: font.serif }}>
        你的宇宙还空着
      </div>
      <Link href="/friend/new" style={{ pointerEvents:'auto', color: gold.base,
        fontSize: fs.sub, letterSpacing:2, textDecoration:'none',
        border:`1px solid ${border.gold}`, borderRadius: radius.pill, padding:'12px 28px' }}>
        ✦ 点亮第一位朋友
      </Link>
    </div>
  )
}
