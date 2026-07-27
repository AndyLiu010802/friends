import * as THREE from 'three'
import type { Friend } from '@/lib/types'

export interface LineObject {
  line: THREE.Line
  friendAId: string
  friendBId: string
  closeness: 1 | 2 | 3
}

const OPACITY = { 1: 0.15, 2: 0.35, 3: 0.65 } as const
const WIDTH   = { 1: 1,    2: 2,    3: 3    } as const

export function buildConstellationLines(friends: Friend[]): LineObject[] {
  const objects: LineObject[] = []
  const seen = new Set<string>()

  for (const fA of friends) {
    for (const rel of fA.relationships) {
      const key = [fA.id, rel.friendId].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)

      const fB = friends.find(f => f.id === rel.friendId)
      if (!fB) continue

      const posA = new THREE.Vector3(...fA.starConfig.position)
      const posB = new THREE.Vector3(...fB.starConfig.position)

      const geo = new THREE.BufferGeometry().setFromPoints([posA, posB])
      const mat = new THREE.LineBasicMaterial({
        color: 0xe2b96f,
        transparent: true,
        opacity: OPACITY[rel.closeness],
        linewidth: WIDTH[rel.closeness],
      })
      objects.push({ line: new THREE.Line(geo, mat), friendAId: fA.id, friendBId: fB.id, closeness: rel.closeness })
    }
  }
  return objects
}

export function highlightLines(objects: LineObject[], activeFriendId: string | null) {
  for (const obj of objects) {
    const mat = obj.line.material as THREE.LineBasicMaterial
    const isActive = !activeFriendId || obj.friendAId === activeFriendId || obj.friendBId === activeFriendId
    mat.opacity = isActive ? OPACITY[obj.closeness] : 0.03
  }
}
