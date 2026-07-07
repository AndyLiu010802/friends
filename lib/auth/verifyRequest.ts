import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// API 路由内层守卫：proxy 之外的第二道防线（matcher 疏漏时兜底）。
export async function isAuthorized(req: NextRequest): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return true // 本地模式

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: () => {},
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  return user !== null
}
