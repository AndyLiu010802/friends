import { describe, it, expect } from 'vitest'
import manifest from './manifest'

describe('manifest', () => {
  const m = manifest()
  it('可安装的最小字段齐全', () => {
    expect(m.name).toBe('友记')
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe('/')
    expect(m.theme_color).toBe('#020408')
    expect(m.background_color).toBe('#020408')
  })
  it('提供 SVG 与 PNG 图标', () => {
    const srcs = (m.icons ?? []).map(i => i.src)
    expect(srcs).toContain('/icon.svg')
    expect(srcs).toContain('/apple-icon.png')
  })
})
