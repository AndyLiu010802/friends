import * as THREE from 'three'
import { gsap } from 'gsap'

/** 补间 pivot 旋转使目标星转到镜头正前方，同时拉近相机。返回取消函数。 */
export function flyToStar(
  pivot: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  localPos: THREE.Vector3,
  onArrive: () => void,
): () => void {
  const dist = localPos.length()
  const from = pivot.quaternion.clone()
  const to = dist < 0.001
    ? from.clone() // 星在原点：无从对准方向，只拉近
    : new THREE.Quaternion().setFromUnitVectors(
        localPos.clone().normalize(), new THREE.Vector3(0, 0, 1))
  const state = { t: 0, z: camera.position.z }
  const targetZ = Math.max(dist + 3.5, 6)
  const tween = gsap.to(state, {
    t: 1, z: targetZ, duration: 1.4, ease: 'power2.inOut',
    onUpdate() {
      pivot.quaternion.slerpQuaternions(from, to, state.t)
      camera.position.z = state.z
    },
    onComplete: onArrive,
  })
  return () => tween.kill()
}
