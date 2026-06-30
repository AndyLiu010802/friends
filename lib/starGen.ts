import type { StarConfig, StarKind } from './types'
import { getZodiacElement } from './zodiac'

const KIND_MAP: Record<string, StarKind> = {
  EN: 'radiant',
  IN: 'nebula',
  ES: 'blossom',
  IS: 'giant',
}

const ELEMENT_COLORS: Record<string, { core: string; glow: string }> = {
  fire:  { core: '#ef4444', glow: '#f59e0b' },
  earth: { core: '#d97706', glow: '#fbbf24' },
  air:   { core: '#38bdf8', glow: '#818cf8' },
  water: { core: '#7c3aed', glow: '#ec4899' },
}

export function generateStarConfig(
  mbti: string,
  zodiac: string,
  hobbies: string[],
  position: [number, number, number]
): StarConfig {
  const prefix = mbti.slice(0, 2).toUpperCase() as keyof typeof KIND_MAP
  const kind: StarKind = KIND_MAP[prefix] ?? 'radiant'
  const element = getZodiacElement(zodiac)
  const { core: coreColor, glow: glowColor } = ELEMENT_COLORS[element]

  const hasArt     = hobbies.some(h => /音乐|艺术|绘画|摄影/.test(h))
  const hasSport   = hobbies.some(h => /运动|健身|户外|爬山/.test(h))
  const isIntrovert = mbti[0].toUpperCase() === 'I'

  const size = kind === 'giant' ? 1.3
    : isIntrovert ? 0.75
    : 1.0

  const twinkleSpeed = hasArt   ? 1.2
    : hasSport  ? 0.8
    : isIntrovert ? 3.5
    : 2.0

  return { kind, coreColor, glowColor, size, twinkleSpeed, position }
}
