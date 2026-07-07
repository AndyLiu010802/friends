const PUBLIC_URL_MARKER = '/storage/v1/object/public/friend-media/'

// 把 Media.url / thumbnailUrl 字段的历史取值统一解析为 friend-media 桶内路径。
// 返回 null 表示该值不属于我们的桶（外部 URL 或空值），应原样使用。
export function extractStoragePath(raw: string): string | null {
  if (!raw) return null
  const idx = raw.indexOf(PUBLIC_URL_MARKER)
  if (idx !== -1) return decodeURIComponent(raw.slice(idx + PUBLIC_URL_MARKER.length))
  if (/^https?:\/\//.test(raw)) return null
  return raw
}
