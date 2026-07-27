import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '友记',
    short_name: '友记',
    description: '朋友星图 — 每个朋友都是一颗星',
    start_url: '/',
    display: 'standalone',
    background_color: '#020408',
    theme_color: '#020408',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
