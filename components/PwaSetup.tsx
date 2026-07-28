'use client'
import { useEffect } from 'react'

// beforeinstallprompt 是 Chromium 专有事件,lib.dom 无类型
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let installPrompt: BeforeInstallPromptEvent | null = null

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return installPrompt
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const evt = installPrompt
  if (!evt) return 'unavailable'
  await evt.prompt()
  const { outcome } = await evt.userChoice
  installPrompt = null
  window.dispatchEvent(new Event('youji:install-ready')) // 状态变化,面板重查
  return outcome
}

export function _resetForTest(): void {
  installPrompt = null
}

export default function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    } else if ('serviceWorker' in navigator) {
      // 开发环境:清掉本机之前生产验证时注册的 SW,避免其缓存毒化 next dev 的非哈希资源
      navigator.serviceWorker.getRegistrations?.()
        .then(rs => rs.forEach(r => { void r.unregister() }))
        .catch(() => {})
    }
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      installPrompt = e as BeforeInstallPromptEvent
      window.dispatchEvent(new Event('youji:install-ready'))
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])
  return null
}
