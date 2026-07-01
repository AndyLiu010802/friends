'use client'
import Link from 'next/link'
import BackupPanel from '@/components/BackupPanel'

export default function SettingsPage() {
  return (
    <main style={{
      minHeight: '100vh', padding: '60px 24px 80px',
      background: 'radial-gradient(ellipse at 20% 30%, #0d1b4b 0%, #020408 70%)',
    }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <Link href="/" style={{
          color: 'rgba(226,185,111,0.5)', fontSize: 11, letterSpacing: 2,
          textDecoration: 'none', display: 'block', marginBottom: 32,
        }}>← 返回星图</Link>

        <h1 style={{ color: '#e2b96f', fontFamily: 'Ma Shan Zheng, cursive', fontSize: 28, letterSpacing: 4, marginBottom: 32 }}>设置</h1>

        <section style={{
          background: 'rgba(226,185,111,0.04)', border: '1px solid rgba(226,185,111,0.15)',
          borderRadius: 14, padding: '20px 24px', marginBottom: 24,
        }}>
          <div style={{ color: 'rgba(226,185,111,0.6)', fontSize: 10, letterSpacing: 3, marginBottom: 16 }}>✦ 云端备份</div>
          <BackupPanel />
        </section>

        <section style={{
          background: 'rgba(226,185,111,0.04)', border: '1px solid rgba(226,185,111,0.15)',
          borderRadius: 14, padding: '20px 24px',
        }}>
          <div style={{ color: 'rgba(226,185,111,0.6)', fontSize: 10, letterSpacing: 3, marginBottom: 12 }}>✦ AI 使用成本参考</div>
          <p style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 2 }}>
            根据当前记录量：<br />
            生成一个普通好友图鉴预计约 $0.20–$0.50（最高级模式）<br />
            一次普通问答预计约 $0.10–$0.30（最高级模式）
          </p>
          <p style={{ color: 'rgba(226,185,111,0.4)', fontSize: 11, marginTop: 8 }}>
            该估算只是前端粗略估算，实际费用以模型后台账单为准。
          </p>
        </section>
      </div>
    </main>
  )
}
