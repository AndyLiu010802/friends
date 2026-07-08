'use client'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { fs, gold, purple, font } from '@/lib/ui/tokens'

interface Props {
  /** 数据是否已就绪；就绪后满足最短展示时长即自动进入 */
  ready: boolean
  onEnter: () => void
}

const MIN_SPLASH_MS = 1600
const AUTO_ENTER_EXTRA_MS = 400

export default function OrreryEntry({ ready, onEnter }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const leavingRef = useRef(false)
  const mountedAtRef = useRef(Date.now())

  useEffect(() => {
    const el = ref.current!
    gsap.fromTo(el, { opacity:0, scale:.8 }, { opacity:1, scale:1, duration:1.5, ease:'power2.out' })
  }, [])

  function leave() {
    if (leavingRef.current) return
    leavingRef.current = true
    gsap.to(ref.current!, { opacity:0, scale:1.4, duration:.8, ease:'power2.in', onComplete: onEnter })
  }

  // 兼职加载屏：数据就绪后自动进入；点击可随时跳过（数据未到也放行，星图先用本地数据渲染）
  useEffect(() => {
    if (!ready) return
    const elapsed = Date.now() - mountedAtRef.current
    const wait = Math.max(0, MIN_SPLASH_MS - elapsed) + AUTO_ENTER_EXTRA_MS
    const t = setTimeout(leave, wait)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  return (
    <div
      ref={ref}
      onClick={leave}
      style={{ position:'fixed', inset:0, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', cursor:'pointer', zIndex:50 }}
    >
      {/* Orrery dial — concentric rotating rings */}
      <div style={{ position:'relative', width:220, height:220, marginBottom:32 }}>
        {[100,76,54].map((size,i) => (
          <div key={i} style={{
            position:'absolute', top:'50%', left:'50%',
            width:size, height:size,
            marginTop:-size/2, marginLeft:-size/2,
            border:`${2-i*.5}px solid rgba(226,185,111,${.5-i*.1})`,
            borderRadius:'50%',
            animation:`spin${i} ${8+i*6}s linear infinite`,
          }}/>
        ))}
        <div style={{
          position:'absolute', top:'50%', left:'50%',
          transform:'translate(-50%,-50%)',
          width:20, height:20, borderRadius:'50%',
          background:'radial-gradient(circle, #fff 0%, #e2b96f 40%, transparent 70%)',
          boxShadow:'0 0 20px #e2b96f, 0 0 60px rgba(226,185,111,0.4)',
        }}/>
      </div>

      <div style={{ color: gold.base, fontFamily: font.hand, fontSize: fs.display, letterSpacing:8 }}>
        友记
      </div>
      <div style={{ color: purple.muted, fontSize: fs.meta, letterSpacing:3, marginTop:10 }}>
        {ready ? '点击进入' : '正在校准星轨…'}
      </div>

      <style>{`
        @keyframes spin0 { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes spin1 { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
        @keyframes spin2 { from{transform:rotate(45deg)} to{transform:rotate(405deg)} }
      `}</style>
    </div>
  )
}
