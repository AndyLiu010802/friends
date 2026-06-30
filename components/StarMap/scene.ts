import * as THREE from 'three'

let _renderer: THREE.WebGLRenderer | null = null
let _scene:    THREE.Scene | null = null
let _camera:   THREE.PerspectiveCamera | null = null
let _pivot:    THREE.Group | null = null

export function initScene(canvas: HTMLCanvasElement) {
  _renderer = new THREE.WebGLRenderer({ antialias: true, canvas })
  _renderer.setSize(window.innerWidth, window.innerHeight)
  _renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  _renderer.toneMapping = THREE.ACESFilmicToneMapping
  _renderer.toneMappingExposure = 1.3

  _scene = new THREE.Scene()
  _scene.fog = new THREE.FogExp2(0x020408, 0.018)

  _camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.01, 300)
  _camera.position.z = 9

  _pivot = new THREE.Group()
  _scene.add(_pivot)
  _scene.add(new THREE.AmbientLight(0x080820, 4))

  window.addEventListener('resize', onResize)
  return { renderer: _renderer, scene: _scene, camera: _camera, pivot: _pivot }
}

export function getScene() {
  return { renderer: _renderer!, scene: _scene!, camera: _camera!, pivot: _pivot! }
}

export function disposeScene() {
  window.removeEventListener('resize', onResize)
  _renderer?.dispose()
  _renderer = _scene = _camera = _pivot = null
}

function onResize() {
  if (!_renderer || !_camera) return
  _camera.aspect = window.innerWidth / window.innerHeight
  _camera.updateProjectionMatrix()
  _renderer.setSize(window.innerWidth, window.innerHeight)
}
