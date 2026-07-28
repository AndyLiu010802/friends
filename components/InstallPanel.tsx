'use client'
import { useEffect, useState } from 'react'
import { getInstallPrompt, promptInstall } from './PwaSetup'
import { fs, text, gold, border, radius, purple } from '@/lib/ui/tokens'

type InstallState = 'standalone' | 'installable' | 'ios' | 'unsupported'

function detectState(): InstallState {
  if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone'
  if (getInstallPrompt()) return 'installable'
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios'
  return 'unsupported'
}

export default function InstallPanel() {
  const [state, setState] = useState<InstallState>('unsupported')

  useEffect(() => {
    // 安装状态是 client-only 环境探测,SSR 期无法得知
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(detectState())
    const onReady = () => setState(detectState())
    window.addEventListener('youji:install-ready', onReady)
    return () => window.removeEventListener('youji:install-ready', onReady)
  }, [])

  async function install() {
    const outcome = await promptInstall()
    if (outcome === 'accepted') setState('standalone')
  }

  if (state === 'standalone') {
    return <p style={{ color: text.primary, fontSize: fs.sub, lineHeight: 2 }}>已安装,正以独立应用运行 ✓</p>
  }
  if (state === 'installable') {
    return (
      <button type="button" onClick={install} style={{
        color: gold.base, fontSize: fs.sub, letterSpacing: 2,
        border: `1px solid ${border.gold}`, borderRadius: radius.pill,
        padding: '10px 18px', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
      }}>⊕ 安装友记</button>
    )
  }
  if (state === 'ios') {
    return (
      <p style={{ color: text.primary, fontSize: fs.sub, lineHeight: 2 }}>
        1. 点浏览器底部 分享 按钮<br />2. 选择「添加到主屏幕」
      </p>
    )
  }
  return <p style={{ color: purple.muted, fontSize: fs.sub, lineHeight: 2 }}>当前浏览器不支持安装,可直接收藏本页。</p>
}
