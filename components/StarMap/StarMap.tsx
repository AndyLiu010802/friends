'use client'
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { initScene, disposeScene } from './scene'
import { buildStarfield } from './starfield'
import { initTrail } from './mouseTrail'
import { buildStar, type StarObject } from './StarBuilder'
import { buildConstellationLines, highlightLines, type LineObject } from './constellationLines'
import FriendCard from '@/components/FriendCard'
import { getFriends } from '@/lib/store'
import { pullAll } from '@/lib/supabase'
import { isTap, applyZoom, createPinchTracker } from '@/lib/gestures'
import { useIsMobile } from '@/lib/useIsMobile'
import type { Friend } from '@/lib/types'
import * as THREE from 'three'

interface Props {
  selectedFriendId?: string | null
  onDeselect?: () => void
}

// 捏合像素距离 → 相机 z 轴距离的换算系数
const PINCH_ZOOM_FACTOR = 0.02

export default function StarMap({ selectedFriendId = null, onDeselect }: Props) {
  const threeRef = useRef<HTMLCanvasElement>(null)
  const trailRef = useRef<HTMLCanvasElement>(null)
  const [hoveredFriend, setHoveredFriend] = useState<Friend | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const [pinnedFriend, setPinnedFriend] = useState<Friend | null>(null)
  const [pinnedPos, setPinnedPos] = useState<{ x: number; y: number } | null>(null)
  const [friendsLoaded, setFriendsLoaded] = useState(false)
  // 鼠标等精确指针才有拖尾与 hover；挂载时判定一次（SSR 关闭，window 必存在）
  const [finePointer] = useState(() => window.matchMedia('(pointer: fine)').matches)
  const isMobile = useIsMobile()
  const starsRef  = useRef<StarObject[]>([])
  const linesRef  = useRef<LineObject[]>([])
  const pinnedFriendIdRef = useRef<string | null>(null)
  const friendsRef = useRef<Friend[]>([])

  useEffect(() => {
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    const { renderer, scene, camera, pivot } = initScene(threeRef.current!, { coarsePointer })
    if (trailRef.current) initTrail(trailRef.current)

    // Background
    scene.add(buildStarfield(coarsePointer ? 750 : 1500))

    // Load friends
    pullAll().then(() => {
      const friends = getFriends()
      friendsRef.current = friends
      setFriendsLoaded(true)
      const stars   = friends.map(f => buildStar(f))
      starsRef.current = stars
      stars.forEach(s => pivot.add(s.root))

      const lines = buildConstellationLines(friends)
      linesRef.current = lines
      lines.forEach(l => pivot.add(l.line))
    }).catch(console.error)

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
      return getFriends().find(f => f.id === star.friendId) ?? null
    }

    const onPointerDown = (e: PointerEvent) => {
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
        setHoverPos({ x: e.clientX + 22, y: e.clientY - 12 })
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
        pinnedFriendIdRef.current = friend.id
        setPinnedFriend(friend)
        setPinnedPos({ x: e.clientX + 22, y: e.clientY - 12 })
        highlightLines(linesRef.current, friend.id)
      } else {
        pinnedFriendIdRef.current = null
        setPinnedFriend(null)
        setPinnedPos(null)
        highlightLines(linesRef.current, null)
        onDeselect?.()
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        pinnedFriendIdRef.current = null
        setPinnedFriend(null)
        setPinnedPos(null)
        highlightLines(linesRef.current, null)
        onDeselect?.()
      }
    }

    const onWheel = (e: WheelEvent) => {
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
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onWindowPointerUp)
      window.removeEventListener('pointercancel', onWindowPointerUp)
      window.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onCanvasPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      disposeScene()
    }
  }, [])

  useEffect(() => {
    if (!selectedFriendId) return
    const friend = friendsRef.current.find(f => f.id === selectedFriendId)
    if (!friend) return
    pinnedFriendIdRef.current = friend.id
    setPinnedFriend(friend)
    setPinnedPos({ x: window.innerWidth / 2 - 130, y: window.innerHeight / 2 - 80 })
    highlightLines(linesRef.current, friend.id)
  }, [selectedFriendId, friendsLoaded])

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
