/** 把一个 w×h 的浮层坐标夹取到视口内（保留边距），修卡片在屏幕边缘溢出 */
export function clampToViewport(
  x: number, y: number, w: number, h: number,
  vw: number, vh: number, margin = 12,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, margin), Math.max(margin, vw - w - margin)),
    y: Math.min(Math.max(y, margin), Math.max(margin, vh - h - margin)),
  }
}
