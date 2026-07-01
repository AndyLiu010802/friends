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
import type { Friend } from '@/lib/types'
import * as THREE from 'three'

export default function StarMap() {
  const threeRef = useRef<HTMLCanvasElement>(null)
  const trailRef = useRef<HTMLCanvasElement>(null)
  const [hoveredFriend, setHoveredFriend] = useState<Friend | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const starsRef  = useRef<StarObject[]>([])
  const linesRef  = useRef<LineObject[]>([])

  useEffect(() => {
    const { renderer, scene, camera, pivot } = initScene(threeRef.current!)
    initTrail(trailRef.current!)

    // Background
    scene.add(buildStarfield())

    // Load friends
    pullAll().then(() => {
      const friends = getFriends()
      const stars   = friends.map(f => buildStar(f))
      starsRef.current = stars
      stars.forEach(s => pivot.add(s.root))

      const lines = buildConstellationLines(friends)
      linesRef.current = lines
      lines.forEach(l => pivot.add(l.line))
    }).catch(console.error)

    // Raycaster for hover
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2(-99, -99)
    let isDrag = false, lx = 0, ly = 0

    const canvas = threeRef.current!
    const onMouseMove = (e: MouseEvent) => {
      mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
      if (isDrag) {
        pivot.rotation.y += (e.clientX - lx) * 0.006
        pivot.rotation.x += (e.clientY - ly) * 0.004
        lx = e.clientX; ly = e.clientY; return
      }
      // Hover
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(starsRef.current.map(s => s.hitMesh))
      if (hits.length) {
        const star = starsRef.current.find(s => s.hitMesh === hits[0].object)!
        const friend = getFriends().find(f => f.id === star.friendId) ?? null
        setHoveredFriend(friend)
        setTooltipPos({ x: e.clientX + 22, y: e.clientY - 12 })
        highlightLines(linesRef.current, star.friendId)
        gsap.to(star.root.scale, { x:1.22, y:1.22, z:1.22, duration:.3, ease:'back.out(2)' })
      } else {
        setHoveredFriend(null)
        highlightLines(linesRef.current, null)
        starsRef.current.forEach(s => gsap.to(s.root.scale, { x:1, y:1, z:1, duration:.3 }))
      }
    }
    const onMouseDown = (e: MouseEvent) => { isDrag = true; lx = e.clientX; ly = e.clientY }
    const onMouseUp = () => { isDrag = false }
    const onWheel = (e: WheelEvent) => {
      camera.position.z = Math.max(3.5, Math.min(16, camera.position.z + e.deltaY * .007))
    }
    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('wheel', onWheel, { passive: true })

    // Render loop
    let raf: number
    const loop = () => { raf = requestAnimationFrame(loop); renderer.render(scene, camera) }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('wheel', onWheel)
      disposeScene()
    }
  }, [])

  return (
    <>
      <canvas ref={threeRef} style={{ position:'fixed', inset:0, cursor:'none' }} />
      <canvas ref={trailRef} style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:5 }} />
      {hoveredFriend && (
        <FriendCard
          friend={hoveredFriend}
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        />
      )}
    </>
  )
}
