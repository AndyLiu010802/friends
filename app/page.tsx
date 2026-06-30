'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import OrreryEntry from '@/components/StarMap/OrreryEntry'

const StarMap = dynamic(() => import('@/components/StarMap/StarMap'), { ssr: false })

export default function HomePage() {
  const [entered, setEntered] = useState(false)

  return (
    <>
      {/* Top nav */}
      {entered && (
        <nav style={{
          position:'fixed', top:0, left:0, right:0, zIndex:30,
          display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'18px 32px',
          background:'linear-gradient(to bottom, rgba(2,4,8,0.8), transparent)',
          pointerEvents:'none',
        }}>
          <span style={{ color:'#e2b96f', fontFamily:'Ma Shan Zheng, cursive',
            fontSize:16, letterSpacing:4 }}>✦ 友记</span>
          <a href="/friend/new" style={{
            color:'#e2b96f', fontSize:11, letterSpacing:2,
            border:'1px solid rgba(226,185,111,0.35)', borderRadius:20,
            padding:'6px 16px', textDecoration:'none', pointerEvents:'auto',
          }}>✦ 新纪录</a>
        </nav>
      )}

      {!entered && <OrreryEntry onEnter={() => setEntered(true)} />}
      {entered  && <StarMap />}
    </>
  )
}
