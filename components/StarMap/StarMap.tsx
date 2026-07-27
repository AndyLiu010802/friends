'use client'
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { initScene, disposeScene } from './scene'
import { buildStarfield } from './starfield'
import { initTrail } from './mouseTrail'
import { buildStar, type StarObject } from './StarBuilder'
import { buildConstellationLines, highlightLines, type LineObject } from './constellationLines'
import { flyToStar } from './cameraFly'
import FriendCard from '@/components/FriendCard'
import { isTap, applyZoom, createPinchTracker } from '@/lib/gestures'
import { clampToViewport } from '@/lib/ui/viewport'
import { useIsMobile } from '@/lib/useIsMobile'
import type { Friend } from '@/lib/types'
import * as THREE from 'three'

interface Props {
  friends: Friend[]
  cinematic?: boolean
  selectedFriendId?: string | null
  /** 桌面端点选星星时通知父级（用于聚焦模式下隐藏洞察面板） */
  onSelect?: (friendId: string) => void
  onDeselect?: () => void
}

// 捏合像素距离 → 相机 z 轴距离的换算系数
const PINCH_ZOOM_FACTOR = 0.02
// 浮层卡片的估算尺寸，用于视口夹取
const CARD_W = 260, CARD_H = 300
// 飞行到位后卡片停靠在屏幕右侧（星星居中、信息在右的聚焦布局）
const RIGHT_DOCK_MARGIN = 24

function rightDockPos() {
  return clampToViewport(
    window.innerWidth - CARD_W - RIGHT_DOCK_MARGIN,
    (window.innerHeight - CARD_H) / 2,
    CARD_W, CARD_H, window.innerWidth, window.innerHeight,
  )
}

export default function StarMap({ friends, cinematic = false, selectedFriendId = null, onSelect, onDeselect }: Props) {
  const threeRef = useRef<HTMLCanvasElement>(null)
  const trailRef = useRef<HTMLCanvasElement>(null)
  const [hoveredFriend, setHoveredFriend] = useState<Friend | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const [pinnedFriend, setPinnedFriend] = useState<Friend | null>(null)
  const [pinnedPos, setPinnedPos] = useState<{ x: number; y: number } | null>(null)
  // 鼠标等精确指针才有拖尾与 hover；挂载时判定一次（SSR 关闭，window 必存在）
  const [finePointer] = useState(() => window.matchMedia('(pointer: fine)').matches)
  const isMobile = useIsMobile()
  const starsRef  = useRef<StarObject[]>([])
  const linesRef  = useRef<LineObject[]>([])
  const pinnedFriendIdRef = useRef<string | null>(null)
  const friendsRef = useRef<Friend[]>([])
  const sceneRef = useRef<ReturnType<typeof initScene> | null>(null)
  // 首次经入场页进入时播一次 stagger/推镜；编辑页返回等二次挂载不重播慢动画
  const cinematicPendingRef = useRef(cinematic)
  const cancelFlyRef = useRef<(() => void) | null>(null)
  const isMobileRef = useRef(isMobile)
  useEffect(() => { isMobileRef.current = isMobile }, [isMobile])

  // 只读 refs 与稳定 setter，挂载 effect 里的闭包引用它也不会过期
  function flyAndDock(friend: Friend) {
    const sceneCtx = sceneRef.current
    if (!sceneCtx) return
    const { camera, pivot } = sceneCtx
    cancelFlyRef.current?.()
    // 飞行期间先收起旧卡片，到位后在右侧停靠位弹出新卡片
    setPinnedFriend(null)
    setPinnedPos(null)
    pinnedFriendIdRef.current = friend.id
    highlightLines(linesRef.current, friend.id)
    cancelFlyRef.current = flyToStar(pivot, camera,
      new THREE.Vector3(...friend.starConfig.position), () => {
        cancelFlyRef.current = null
        setPinnedFriend(friend)
        setPinnedPos(rightDockPos())
      })
  }

  useEffect(() => {
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    const sceneCtx = initScene(threeRef.current!, { coarsePointer })
    sceneRef.current = sceneCtx
    const { renderer, scene, camera, pivot } = sceneCtx
    if (trailRef.current) initTrail(trailRef.current)

    // Background
    scene.add(buildStarfield(coarsePointer ? 750 : 1500))

    // 首次经入场页进入：相机从远处推进，与星星 stagger 同步；用户一操作缩放/拖拽即接管
    let dolly: gsap.core.Tween | null = null
    if (cinematic) {
      camera.position.z = 26
      dolly = gsap.to(camera.position, { z: 9, duration: 1.8, ease: 'power3.out' })
    }
    const killDolly = () => { dolly?.kill(); dolly = null }

    // Raycaster for hover + tap
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2(-99, -99)
    const pinch = createPinchTracker()
    let isDrag = false, lx = 0, ly = 0
    let pointerDown: { x: number; y: number } | null = null

    const canvas = threeRef.current!

    const setNdc = (clientX: number, clientY: number) => {
      ndc.x =  (clientX / window.innerWidth)  * 2 - 1
      ndc.y = -(clientY / window.innerHeight) * 2 + 1
    }

    const pickFriend = (): Friend | null => {
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObjects(starsRef.current.map(s => s.hitMesh))
      if (!hits.length) return null
      const star = starsRef.current.find(s => s.hitMesh === hits[0].object)!
      return friendsRef.current.find(f => f.id === star.friendId) ?? null
    }

    const onPointerDown = (e: PointerEvent) => {
      killDolly()
      cancelFlyRef.current?.()
      cancelFlyRef.current = null
      pinch.down(e.pointerId, e.clientX, e.clientY)
      if (pinch.isPinching) {
        // 进入捏合：取消拖拽与轻点
        isDrag = false
        pointerDown = null
        return
      }
      pointerDown = { x: e.clientX, y: e.clientY }
      isDrag = true; lx = e.clientX; ly = e.clientY
    }

    const onPointerMove = (e: PointerEvent) => {
      const zoomDelta = pinch.move(e.pointerId, e.clientX, e.clientY)
      if (pinch.isPinching) {
        // 两指靠近（delta>0）= 拉远；张开 = 拉近
        camera.position.z = applyZoom(camera.position.z, zoomDelta * PINCH_ZOOM_FACTOR)
        return
      }
      setNdc(e.clientX, e.clientY)
      if (isDrag) {
        pivot.rotation.y += (e.clientX - lx) * 0.006
        pivot.rotation.x += (e.clientY - ly) * 0.004
        lx = e.clientX; ly = e.clientY; return
      }
      if (e.pointerType !== 'mouse') return // 触屏无 hover
      // Hover
      const friend = pickFriend()
      if (friend) {
        const star = starsRef.current.find(s => s.friendId === friend.id)!
        setHoveredFriend(friend)
        setHoverPos(clampToViewport(e.clientX + 22, e.clientY - 12, CARD_W, CARD_H,
          window.innerWidth, window.innerHeight))
        highlightLines(linesRef.current, pinnedFriendIdRef.current ?? friend.id)
        gsap.to(star.root.scale, { x:1.22, y:1.22, z:1.22, duration:.3, ease:'back.out(2)' })
      } else {
        setHoveredFriend(null)
        highlightLines(linesRef.current, pinnedFriendIdRef.current)
        starsRef.current.forEach(s => gsap.to(s.root.scale, { x:1, y:1, z:1, duration:.3 }))
      }
    }

    // Always resets drag state, even if the pointer is released over the FriendCard overlay.
    const onWindowPointerUp = (e: PointerEvent) => {
      pinch.up(e.pointerId)
      if (!pinch.isPinching) isDrag = false
    }

    // Only fires when the pointerup target is the canvas itself — clicks on the FriendCard
    // (higher z-index, pointerEvents:auto) never reach this handler, so its buttons work.
    const onCanvasPointerUp = (e: PointerEvent) => {
      const start = pointerDown
      pointerDown = null
      if (!start) return
      if (pinch.wasPinch) return // 捏合结束的抬指不算轻点
      if (!isTap(start, { x: e.clientX, y: e.clientY })) return

      setNdc(e.clientX, e.clientY) // 触屏没有 move 预热，用抬起坐标现算
      const friend = pickFriend()
      if (friend) {
        if (isMobileRef.current) {
          // 移动端保持轻点即出 bottom sheet，不做运镜
          pinnedFriendIdRef.current = friend.id
          setPinnedFriend(friend)
          setPinnedPos(clampToViewport(e.clientX + 22, e.clientY - 12, CARD_W, CARD_H,
            window.innerWidth, window.innerHeight))
          highlightLines(linesRef.current, friend.id)
        } else {
          onSelect?.(friend.id)
          flyAndDock(friend)
        }
      } else {
        pinnedFriendIdRef.current = null
        setPinnedFriend(null)
        setPinnedPos(null)
        highlightLines(linesRef.current, null)
        onDeselect?.()
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return
      if (e.key === 'Escape') {
        pinnedFriendIdRef.current = null
        setPinnedFriend(null)
        setPinnedPos(null)
        highlightLines(linesRef.current, null)
        onDeselect?.()
      }
    }

    const onWheel = (e: WheelEvent) => {
      killDolly()
      camera.position.z = applyZoom(camera.position.z, e.deltaY * .007)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onCanvasPointerUp)
    window.addEventListener('pointerup', onWindowPointerUp)
    window.addEventListener('pointercancel', onWindowPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('keydown', onKeyDown)
    canvas.addEventListener('wheel', onWheel, { passive: true })

    // Render loop
    let raf: number
    const loop = () => { raf = requestAnimationFrame(loop); renderer.render(scene, camera) }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      killDolly()
      cancelFlyRef.current?.()
      cancelFlyRef.current = null
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onWindowPointerUp)
      window.removeEventListener('pointercancel', onWindowPointerUp)
      window.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onCanvasPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      sceneRef.current = null
      disposeScene()
    }
  }, [])

  // 星与连线由 friends prop 驱动（数据所有权在 HomePage）
  useEffect(() => {
    const sceneCtx = sceneRef.current
    if (!sceneCtx) return
    const { pivot } = sceneCtx
    friendsRef.current = friends

    starsRef.current.forEach(s => pivot.remove(s.root))
    linesRef.current.forEach(l => pivot.remove(l.line))
    if (friends.length === 0) {
      starsRef.current = []
      linesRef.current = []
      return
    }

    const useStagger = cinematicPendingRef.current
    cinematicPendingRef.current = false

    const stars = friends.map((f, i) => buildStar(f, useStagger ? Math.min(i * 0.06, 2) : 0))
    starsRef.current = stars
    stars.forEach(s => pivot.add(s.root))

    const lines = buildConstellationLines(friends)
    linesRef.current = lines
    lines.forEach((l, i) => {
      pivot.add(l.line)
      const mat = l.line.material as THREE.LineBasicMaterial
      const target = mat.opacity
      mat.opacity = 0
      gsap.to(mat, { opacity: target, ease: 'power1.out',
        duration: useStagger ? 1.2 : 0.4, delay: useStagger ? 1 + i * 0.05 : 0 })
    })
  }, [friends])

  // 从洞察面板选中：与点星同一套运镜——飞向那颗星，卡片停靠右侧
  useEffect(() => {
    if (!selectedFriendId) return
    const friend = friendsRef.current.find(f => f.id === selectedFriendId)
    if (!friend) return
    flyAndDock(friend)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFriendId])

  return (
    <>
      <canvas ref={threeRef} style={{
        position:'fixed', inset:0, touchAction:'none',
        cursor: finePointer ? 'none' : 'auto',
      }} />
      {finePointer && (
        <canvas ref={trailRef} style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:5 }} />
      )}
      {!isMobile && !pinnedFriend && hoveredFriend && (
        <FriendCard
          friend={hoveredFriend}
          style={{ left: hoverPos.x, top: hoverPos.y }}
        />
      )}
      {pinnedFriend && (isMobile || pinnedPos) && (
        <FriendCard
          friend={pinnedFriend}
          pinned
          variant={isMobile ? 'sheet' : 'floating'}
          onClose={() => {
            pinnedFriendIdRef.current = null
            setPinnedFriend(null)
            setPinnedPos(null)
            highlightLines(linesRef.current, null)
            onDeselect?.()
          }}
          style={!isMobile && pinnedPos ? { left: pinnedPos.x, top: pinnedPos.y } : undefined}
        />
      )}
    </>
  )
}
