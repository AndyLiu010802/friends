import { describe, it, expect } from 'vitest'
import { extractStoragePath } from './mediaPath'

describe('extractStoragePath', () => {
  it('纯 storage 路径原样返回', () => {
    expect(extractStoragePath('friends/f1/portraits/123-a.jpg'))
      .toBe('friends/f1/portraits/123-a.jpg')
  })

  it('旧数据的 Supabase 公开 URL 提取出路径', () => {
    expect(extractStoragePath(
      'https://xxxx.supabase.co/storage/v1/object/public/friend-media/friends/f1/memories/m1/9-b.png'
    )).toBe('friends/f1/memories/m1/9-b.png')
  })

  it('公开 URL 中的百分号编码被还原', () => {
    expect(extractStoragePath(
      'https://xxxx.supabase.co/storage/v1/object/public/friend-media/friends/f1/portraits/1-%E7%85%A7.jpg'
    )).toBe('friends/f1/portraits/1-照.jpg')
  })

  it('外部 http(s) URL 返回 null（原样使用）', () => {
    expect(extractStoragePath('https://example.com/a.jpg')).toBeNull()
  })

  it('空字符串返回 null', () => {
    expect(extractStoragePath('')).toBeNull()
  })
})
