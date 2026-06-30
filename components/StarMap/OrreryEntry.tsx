'use client'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

interface Props { onEnter: () => void }

export default function OrreryEntry({ onEnter }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current!
    gsap.fromTo(el, { opacity:0, scale:.8 }, { opacity:1, scale:1, duration:1.5, ease:'power2.out' })
  }, [])

  function handleClick() {
    const el = ref.current!
    gsap.to(el, { opacity:0, scale:1.4, duration:.8, ease:'power2.in', onComplete: onEnter })
  }

  return (
    <div
      ref={ref}
      onClick={handleClick}
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

      <div style={{ color:'#e2b96f', fontFamily:'Ma Shan Zheng, cursive', fontSize:28, letterSpacing:8 }}>
        朋友笔记
      </div>
      <div style={{ color:'rgba(155,142,196,0.6)', fontSize:11, letterSpacing:3, marginTop:10 }}>
        点击打开星图
      </div>

      <style>{`
        @keyframes spin0 { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes spin1 { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
        @keyframes spin2 { from{transform:rotate(45deg)} to{transform:rotate(405deg)} }
      `}</style>
    </div>
  )
}
