import { describe, it, expect, vi } from 'vitest'
import { createSignedUrlResolver } from './signedUrlCache'

describe('createSignedUrlResolver', () => {
  it('storage 路径换取签名 URL', async () => {
    const sign = vi.fn().mockResolvedValue('https://signed/a.jpg')
    const resolve = createSignedUrlResolver(sign)
    expect(await resolve('friends/f1/portraits/a.jpg')).toBe('https://signed/a.jpg')
    expect(sign).toHaveBeenCalledWith('friends/f1/portraits/a.jpg')
  })

  it('外部 URL 不签名，原样返回', async () => {
    const sign = vi.fn()
    const resolve = createSignedUrlResolver(sign)
    expect(await resolve('https://example.com/a.jpg')).toBe('https://example.com/a.jpg')
    expect(sign).not.toHaveBeenCalled()
  })

  it('旧公开 URL 提取路径后签名', async () => {
    const sign = vi.fn().mockResolvedValue('https://signed/b.png')
    const resolve = createSignedUrlResolver(sign)
    expect(await resolve(
      'https://xxxx.supabase.co/storage/v1/object/public/friend-media/friends/f1/b.png'
    )).toBe('https://signed/b.png')
    expect(sign).toHaveBeenCalledWith('friends/f1/b.png')
  })

  it('缓存未过期时不重复签名', async () => {
    const sign = vi.fn().mockResolvedValue('https://signed/a.jpg')
    let clock = 0
    const resolve = createSignedUrlResolver(sign, () => clock)
    await resolve('p/a.jpg')
    clock = 54 * 60 * 1000 // 54 分钟后，仍在 55 分钟有效期内
    await resolve('p/a.jpg')
    expect(sign).toHaveBeenCalledTimes(1)
  })

  it('缓存过期后重新签名', async () => {
    const sign = vi.fn().mockResolvedValue('https://signed/a.jpg')
    let clock = 0
    const resolve = createSignedUrlResolver(sign, () => clock)
    await resolve('p/a.jpg')
    clock = 56 * 60 * 1000
    await resolve('p/a.jpg')
    expect(sign).toHaveBeenCalledTimes(2)
  })

  it('签名失败（返回 null）时回退原值且不写缓存', async () => {
    const sign = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('https://signed/a.jpg')
    const resolve = createSignedUrlResolver(sign)
    expect(await resolve('p/a.jpg')).toBe('p/a.jpg')
    expect(await resolve('p/a.jpg')).toBe('https://signed/a.jpg')
  })
})
