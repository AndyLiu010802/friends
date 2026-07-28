// 已安装 PWA 的图标角标:显示「今天必看」级信号数。特性检测,不支持/出错一律静默。
export function updateAppBadge(count: number): void {
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    if (count > 0) {
      void nav.setAppBadge?.(count)?.catch?.(() => {})
    } else {
      void nav.clearAppBadge?.()?.catch?.(() => {})
    }
  } catch { /* 静默 */ }
}
