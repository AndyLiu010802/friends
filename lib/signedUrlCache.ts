import { extractStoragePath } from './mediaPath'

const CACHE_TTL_MS = 55 * 60 * 1000 // 签名有效期 60 分钟，留 5 分钟余量

// sign 与 now 可注入，便于测试；生产装配见 lib/supabase.ts 的 getMediaDisplayUrl。
export function createSignedUrlResolver(
  sign: (path: string) => Promise<string | null>,
  now: () => number = Date.now
): (raw: string) => Promise<string> {
  const cache = new Map<string, { url: string; expiresAt: number }>()
  return async function resolve(raw: string): Promise<string> {
    const path = extractStoragePath(raw)
    if (!path) return raw
    const hit = cache.get(path)
    if (hit && hit.expiresAt > now()) return hit.url
    const url = await sign(path)
    if (!url) return raw
    cache.set(path, { url, expiresAt: now() + CACHE_TTL_MS })
    return url
  }
}
