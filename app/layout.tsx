import './globals.css'
import type { ReactNode } from 'react'

export const metadata = {
  title: '✦ 友记',
  description: '朋友星图',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  )
}
