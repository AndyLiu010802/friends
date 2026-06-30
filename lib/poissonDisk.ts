export function findSafePosition(
  existing: [number, number, number][],
  minDist = 2.5,
  spread = 6,
  maxAttempts = 60
): [number, number, number] {
  for (let i = 0; i < maxAttempts; i++) {
    const radius = spread + Math.floor(i / 15) * 2
    const x = (Math.random() - 0.5) * radius * 2
    const y = (Math.random() - 0.5) * radius * 1.5
    const z = (Math.random() - 0.5) * 1.5
    const tooClose = existing.some(([ex, ey, ez]) => {
      const dx = x - ex, dy = y - ey, dz = z - ez
      return Math.sqrt(dx*dx + dy*dy + dz*dz) < minDist
    })
    if (!tooClose) return [x, y, z]
  }
  const angle = Math.random() * Math.PI * 2
  return [Math.cos(angle) * (spread + 4), Math.sin(angle) * (spread + 4), 0]
}
