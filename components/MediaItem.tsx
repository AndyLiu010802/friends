'use client'
import { useEffect, useState } from 'react'
import { getMediaDisplayUrl } from '@/lib/supabase'
import type { Media } from '@/lib/types'

export default function MediaItem({ media }: { media: Media }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let cancelled = false
    const raw = media.type === 'photo' ? media.thumbnailUrl : media.url
    getMediaDisplayUrl(raw).then(u => { if (!cancelled) setSrc(u) })
    return () => { cancelled = true }
  }, [media])

  if (!src) return <div style={{ width:'100%', height:'100%' }} />
  return media.type === 'photo'
    ? <img src={src} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt={media.caption}/>
    : <video src={src} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted/>
}
