import FriendForm from '@/components/FriendForm'
import Link from 'next/link'
import { fs, gold, font } from '@/lib/ui/tokens'

export default function NewFriendPage() {
  return (
    <main style={{
      height:'100vh', overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'flex-start', padding:'60px 24px 80px',
      background:'radial-gradient(ellipse at 30% 40%, #0d1b4b 0%, #020408 70%)',
    }}>
      <div style={{ width:'100%', maxWidth:560 }}>
        <Link href="/" style={{ color: gold.muted, fontSize: fs.meta, letterSpacing:2,
          textDecoration:'none', display:'block', marginBottom:32 }}>← 返回星图</Link>
        <h1 style={{ color: gold.base, fontFamily: font.hand,
          fontSize: fs.display, letterSpacing:4, marginBottom:32 }}>✦ 新纪录</h1>
        <FriendForm />
      </div>
    </main>
  )
}
