import './globals.css'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: '✦ 友记',
  description: '朋友星图',
}

export const viewport: Viewport = {
  themeColor: '#020408',
  viewportFit: 'cover', // 刘海屏下允许内容进入安全区，配合 env(safe-area-inset-*)
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  )
}
