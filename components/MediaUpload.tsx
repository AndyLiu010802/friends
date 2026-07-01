'use client'
import { useRef } from 'react'
import { uploadMedia } from '@/lib/supabase'
import type { Media } from '@/lib/types'

interface Props {
  friendId: string
  folder: string
  onUploaded: (media: Media) => void
}

export default function MediaUpload({ friendId, folder, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const isVideo = file.type.startsWith('video/')
    try {
      const { url, thumbnailUrl } = await uploadMedia(friendId, folder, file)
      const media: Media = {
        id: crypto.randomUUID(), type: isVideo ? 'video' : 'photo',
        url, thumbnailUrl, size: file.size,
        caption: '', takenAt: new Date().toISOString(),
        duration: undefined,
      }
      onUploaded(media)
    } catch (err) {
      console.error('media upload failed', err)
    }
    e.target.value = ''
  }

  return (
    <div>
      <button type="button" onClick={() => inputRef.current?.click()}
        style={{ padding:'6px 14px', background:'rgba(255,255,255,0.04)',
          border:'1px solid rgba(226,185,111,0.2)', borderRadius:8,
          color:'rgba(226,185,111,0.7)', fontSize:11, letterSpacing:1, cursor:'pointer' }}>
        + 上传照片/视频
      </button>
      <input ref={inputRef} type="file" accept="image/*,video/*"
        onChange={handleFile} style={{ display:'none' }} />
    </div>
  )
}
