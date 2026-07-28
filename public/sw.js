// 友记 Service Worker:应用外壳离线缓存。数据在 localStorage,不经过这里。
// 改动本文件时递增版本号,activate 会清掉旧缓存。
const CACHE = 'youji-v2'
const SHELL_KEY = '/'

self.addEventListener('install', () => {
  // 不预缓存清单:运行时缓存足够;立即接管,避免旧 SW 滞留
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return   // 跨域(Supabase 等)不拦
  if (url.pathname.startsWith('/api/')) return       // AI 路由永远走网络

  // 页面导航:网络优先;只有访问 '/' 本身时才更新外壳缓存——App Router 每个路由的
  // HTML 内嵌各自的 RSC 数据,缓存任意页面会让离线启动渲染错页(如登录页困死本地数据)。
  // manifest start_url 为 '/',每次 PWA 启动都会刷新外壳。断网时任何导航回退到外壳。
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok && url.pathname === SHELL_KEY) {
            const copy = res.clone()
            event.waitUntil(caches.open(CACHE).then(c => c.put(SHELL_KEY, copy)).catch(() => {}))
          }
          return res
        })
        .catch(() => caches.match(SHELL_KEY).then(hit => hit ?? Response.error()))
    )
    return
  }

  // 内容哈希静态资源:缓存优先
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then(hit => hit ?? fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone()
          event.waitUntil(caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}))
        }
        return res
      }))
    )
    return
  }

  // 其余同源 GET(图标、字体等):stale-while-revalidate
  event.respondWith(
    caches.match(req).then(hit => {
      const refresh = fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone()
          event.waitUntil(caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}))
        }
        return res
      }).catch(() => hit ?? Response.error())
      return hit ?? refresh
    })
  )
})
