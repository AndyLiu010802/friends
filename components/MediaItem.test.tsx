import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MediaItem from './MediaItem'
import type { Media } from '@/lib/types'

vi.mock('@/lib/supabase', () => ({
  getMediaDisplayUrl: vi.fn(async (raw: string) => `https://signed/${raw}`),
}))

const photo: Media = {
  id: 'm1', type: 'photo', url: 'p/full.jpg', thumbnailUrl: 'p/thumb.jpg',
  caption: '合照', size: 100,
}
const video: Media = {
  id: 'm2', type: 'video', url: 'p/clip.mp4', thumbnailUrl: 'p/clip.jpg',
  caption: '', size: 100,
}

describe('MediaItem', () => {
  it('照片用缩略图路径换签名 URL 渲染 img', async () => {
    render(<MediaItem media={photo} />)
    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', 'https://signed/p/thumb.jpg')
    expect(img).toHaveAttribute('alt', '合照')
  })

  it('视频用完整路径换签名 URL 渲染 video', async () => {
    const { container } = render(<MediaItem media={video} />)
    await vi.waitFor(() => {
      const v = container.querySelector('video')
      expect(v).not.toBeNull()
      expect(v).toHaveAttribute('src', 'https://signed/p/clip.mp4')
    })
  })
})
