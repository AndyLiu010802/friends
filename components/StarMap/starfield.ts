import * as THREE from 'three'

export function buildStarfield(): THREE.Points {
  const N = 1500
  const pos = new Float32Array(N * 3)
  const col = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const r = 45 + Math.random() * 80
    const t = Math.random() * Math.PI * 2
    const p = Math.acos(2 * Math.random() - 1)
    pos[i*3]   = r * Math.sin(p) * Math.cos(t)
    pos[i*3+1] = r * Math.sin(p) * Math.sin(t)
    pos[i*3+2] = r * Math.cos(p)
    const w = Math.random()
    col[i*3] = 0.7 + w * 0.3; col[i*3+1] = 0.72 + w * 0.2; col[i*3+2] = 0.88 + w * 0.12
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3))
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.05, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.45,
  }))
}
