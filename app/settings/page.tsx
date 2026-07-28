'use client'
import Link from 'next/link'
import BackupPanel from '@/components/BackupPanel'
import AccountPanel from '@/components/AccountPanel'
import InstallPanel from '@/components/InstallPanel'
import { fs, text, gold, border, surface, radius, font } from '@/lib/ui/tokens'

const section: React.CSSProperties = {
  background: surface.section, border: `1px solid ${border.goldFaint}`,
  borderRadius: radius.lg, padding: '20px 24px', marginBottom: 24,
}
const sectionTitle: React.CSSProperties = {
  color: gold.muted, fontSize: fs.meta, letterSpacing: 3, marginBottom: 16,
}

export default function SettingsPage() {
  return (
    <main style={{
      minHeight: '100vh', padding: '60px 24px 80px',
      background: 'radial-gradient(ellipse at 20% 30%, #0d1b4b 0%, #020408 70%)',
    }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <Link href="/" style={{
          color: gold.muted, fontSize: fs.meta, letterSpacing: 2,
          textDecoration: 'none', display: 'block', marginBottom: 32,
        }}>← 返回星图</Link>

        <h1 style={{ color: gold.base, fontFamily: font.hand, fontSize: fs.display, letterSpacing: 4, marginBottom: 32 }}>设置</h1>

        <section style={section}>
          <div style={sectionTitle}>✦ 账号</div>
          <AccountPanel />
        </section>

        <section style={section}>
          <div style={sectionTitle}>✦ 云端备份</div>
          <BackupPanel />
        </section>

        <section style={section}>
          <div style={sectionTitle}>✦ 安装到主屏</div>
          <InstallPanel />
        </section>

        <section style={{ ...section, marginBottom: 0 }}>
          <div style={{ ...sectionTitle, marginBottom: 12 }}>✦ AI 使用成本参考</div>
          <p style={{ color: text.primary, fontSize: fs.sub, lineHeight: 2 }}>
            根据当前记录量：<br />
            生成一个普通好友图鉴预计约 $0.20–$0.50<br />
            一次普通问答预计约 $0.10–$0.30
          </p>
          <p style={{ color: text.faint, fontSize: fs.meta, marginTop: 8 }}>
            该估算只是前端粗略估算，实际费用以模型后台账单为准。
          </p>
        </section>
      </div>
    </main>
  )
}
