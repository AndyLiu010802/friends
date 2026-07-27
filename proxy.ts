import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // 本地模式：未配置 Supabase 时无认证概念，全部放行。
  if (!url || !key) return NextResponse.next()

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => {}, // 门禁只读会话；token 刷新由浏览器端 client 负责
    },
  })
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isLogin = pathname === '/login'

  if (user) {
    return isLogin ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next()
  }
  if (isLogin) return NextResponse.next()
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: '未登录，请先登录。' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
