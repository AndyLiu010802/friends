import * as THREE from 'three'
import { gsap } from 'gsap'
import type { Friend } from '@/lib/types'

function radialTex(size: number, stops: [number,string][]): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size
  const ctx = c.getContext('2d')!, r = size/2
  const g = ctx.createRadialGradient(r,r,0,r,r,r)
  stops.forEach(([t,col]) => g.addColorStop(t,col))
  ctx.fillStyle = g; ctx.fillRect(0,0,size,size)
  return new THREE.CanvasTexture(c)
}

function burstTex(size: number, color: string, rays=8): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size
  const ctx = c.getContext('2d')!, r = size/2
  const g = ctx.createRadialGradient(r,r,0,r,r,r)
  g.addColorStop(0,'rgba(255,255,255,1)')
  g.addColorStop(0.08,color.replace(')',',0.95)').replace('rgb','rgba'))
  g.addColorStop(0.35,color.replace(')',',0.4)').replace('rgb','rgba'))
  g.addColorStop(0.75,color.replace(')',',0.08)').replace('rgb','rgba'))
  g.addColorStop(1,'rgba(0,0,0,0)')
  ctx.fillStyle = g; ctx.fillRect(0,0,size,size)
  ctx.save(); ctx.translate(r,r); ctx.globalCompositeOperation='screen'
  for (let i=0;i<rays;i++) {
    const ang=(i/rays)*Math.PI*2
    const lg=ctx.createLinearGradient(0,0,Math.cos(ang)*r*.88,Math.sin(ang)*r*.88)
    lg.addColorStop(0,'rgba(255,255,255,0.85)'); lg.addColorStop(.35,'rgba(255,255,255,0.2)'); lg.addColorStop(1,'rgba(255,255,255,0)')
    ctx.fillStyle=lg; ctx.save(); ctx.rotate(ang)
    ctx.beginPath(); ctx.moveTo(-1,0); ctx.lineTo(1,0); ctx.lineTo(0,r*.84); ctx.closePath()
    ctx.fill(); ctx.restore()
  }
  ctx.restore()
  return new THREE.CanvasTexture(c)
}

function ringTex(size: number, color: string, w=0.1): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size
  const ctx = c.getContext('2d')!, r = size/2, inner=r*(1-w*2.2), outer=r*(1-w*.3)
  const g = ctx.createRadialGradient(r,r,inner,r,r,outer)
  g.addColorStop(0,'rgba(0,0,0,0)')
  g.addColorStop(.35,color.replace(')',',0.65)').replace('rgb','rgba'))
  g.addColorStop(.7,color.replace(')',',0.3)').replace('rgb','rgba'))
  g.addColorStop(1,'rgba(0,0,0,0)')
  ctx.fillStyle=g; ctx.fillRect(0,0,size,size)
  return new THREE.CanvasTexture(c)
}

function sp(tex: THREE.Texture, scale: number, op=1.0): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false }))
  s.scale.set(scale,scale,1); return s
}

export interface StarObject {
  root: THREE.Group
  hitMesh: THREE.Mesh
  friendId: string
}

export function buildStar(friend: Friend): StarObject {
  const { starConfig: cfg } = friend
  const root = new THREE.Group()
  root.position.set(...cfg.position)

  const hex = (h: string) => `rgb(${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)})`
  const coreRgb = hex(cfg.coreColor)
  const glowRgb = hex(cfg.glowColor)

  switch (cfg.kind) {
    case 'radiant': {
      const core = sp(burstTex(256,coreRgb,8), cfg.size*.82)
      root.add(core)
      root.add(sp(radialTex(128,[[0,`rgba(0,0,0,0)`],[.3,`${cfg.glowColor}28`],[.72,`${cfg.glowColor}10`],[1,'rgba(0,0,0,0)']]),cfg.size*1.8))
      const rot = sp(burstTex(256,glowRgb,4), cfg.size*.76, .35); root.add(rot)
      gsap.to(rot.material,{rotation:Math.PI*2, duration:18, repeat:-1, ease:'none'})
      const dg=new THREE.Group(); root.add(dg)
      const dot=sp(radialTex(64,[[0,'rgba(255,255,200,1)'],[.4,'rgba(255,200,80,0.6)'],[1,'rgba(0,0,0,0)']]),cfg.size*.16)
      dot.position.set(cfg.size*.48,0,0); dg.add(dot)
      gsap.to(dg.rotation,{z:-Math.PI*2, duration:7, repeat:-1, ease:'none'})
      gsap.to(core.material,{opacity:.72, duration:cfg.twinkleSpeed*.7, repeat:-1, yoyo:true, ease:'sine.inOut'})
      break
    }
    case 'nebula': {
      const core=sp(radialTex(256,[[0,'rgba(255,255,255,1)'],[.06,`${cfg.coreColor}f2`],[.25,`${cfg.glowColor}80`],[.55,`${cfg.coreColor}2d`],[.82,`${cfg.coreColor}0f`],[1,'rgba(0,0,0,0)']]),cfg.size*.76); root.add(core)
      const h1=sp(ringTex(256,glowRgb,.11),cfg.size*1.35,.48); root.add(h1)
      gsap.to(h1.material,{rotation:Math.PI*2, duration:22, repeat:-1, ease:'none'})
      const h2=sp(ringTex(256,coreRgb,.07),cfg.size*2.0,.28); root.add(h2)
      gsap.to(h2.material,{rotation:-Math.PI*2, duration:36, repeat:-1, ease:'none'})
      gsap.to(core.material,{opacity:.65, duration:cfg.twinkleSpeed, repeat:-1, yoyo:true, ease:'sine.inOut', delay:.8})
      break
    }
    case 'blossom': {
      const core=sp(burstTex(256,coreRgb,6),cfg.size*.70); root.add(core)
      root.add(sp(radialTex(128,[[0,'rgba(253,164,175,0)'],[.4,'rgba(253,164,175,0.18)'],[.76,'rgba(251,113,133,0.07)'],[1,'rgba(0,0,0,0)']]),cfg.size*1.65))
      for(let i=0;i<5;i++){
        const ang=(i/5)*Math.PI*2, pg=new THREE.Group(); root.add(pg)
        const p=sp(radialTex(64,[[0,'rgba(255,200,210,1)'],[.4,'rgba(253,164,175,0.6)'],[1,'rgba(0,0,0,0)']]),cfg.size*.14+Math.random()*.07,.75)
        p.position.set(Math.cos(ang)*cfg.size*.42,Math.sin(ang)*cfg.size*.42,0); pg.add(p)
        gsap.to(pg.rotation,{z:-Math.PI*2, duration:8+i*1.5, repeat:-1, ease:'none'})
        gsap.to(p.material,{opacity:.18, duration:(8+i*1.5)/5, repeat:-1, yoyo:true, ease:'sine.inOut', delay:i*.3})
      }
      gsap.to(core.material,{opacity:.68, duration:cfg.twinkleSpeed, repeat:-1, yoyo:true, ease:'sine.inOut'})
      break
    }
    case 'giant': {
      const core=sp(radialTex(256,[[0,'rgba(255,255,220,1)'],[.08,`${cfg.coreColor}f2`],[.28,`${cfg.coreColor}ad`],[.55,`${cfg.coreColor}47`],[.82,`${cfg.coreColor}17`],[1,'rgba(0,0,0,0)']]),cfg.size*.98); root.add(core)
      ;[[1.05,1.55,.26],[1.2,1.75,.15],[1.35,1.95,.09]].forEach(([i,o,op])=>{
        const rg=new THREE.RingGeometry(i*.75*cfg.size,o*.75*cfg.size,96)
        const rm=new THREE.MeshBasicMaterial({color:0xe2b96f,side:THREE.DoubleSide,transparent:true,opacity:op,blending:THREE.AdditiveBlending})
        const ring=new THREE.Mesh(rg,rm); ring.rotation.x=1.1; ring.rotation.z=.25; root.add(ring)
        gsap.to(ring.rotation,{z:ring.rotation.z+Math.PI*2, duration:28, repeat:-1, ease:'none'})
      })
      gsap.to(core.material,{opacity:.72, duration:cfg.twinkleSpeed, repeat:-1, yoyo:true, ease:'sine.inOut'})
      break
    }
    case 'pulsar': {
      const core=sp(burstTex(256,coreRgb,4),cfg.size*.54); root.add(core)
      root.add(sp(radialTex(128,[[0,'rgba(0,0,0,0)'],[.5,`${cfg.coreColor}1a`],[.82,`${cfg.coreColor}0a`],[1,'rgba(0,0,0,0)']]),cfg.size*1.5))
      for(let p=0;p<3;p++){
        const ring=sp(ringTex(128,glowRgb,.15),cfg.size*.45,.5); root.add(ring)
        const tl=gsap.timeline({repeat:-1,delay:p*.38})
        tl.fromTo(ring.scale,{x:.3,y:.3},{x:1.8,y:1.8,duration:1.1,ease:'power1.out'})
          .fromTo(ring.material,{opacity:.55},{opacity:0,duration:1.1,ease:'power1.out'},'<')
      }
      gsap.to(core.material,{opacity:.38, duration:cfg.twinkleSpeed*.3, repeat:-1, yoyo:true, ease:'sine.inOut'})
      break
    }
    case 'twin': {
      ;[{col:coreRgb,r:.30,spd:4.5,sz:.44},{col:glowRgb,r:.30,spd:4.5,sz:.33}].forEach((p,pi)=>{
        const og=new THREE.Group(); root.add(og)
        const star=sp(burstTex(128,p.col,6),p.sz*cfg.size)
        star.position.set(p.r*(pi===0?1:-1)*cfg.size,0,0); og.add(star)
        const gh=sp(radialTex(64,[[0,'rgba(0,0,0,0)'],[.45,'rgba(180,170,255,0.22)'],[1,'rgba(0,0,0,0)']]),p.sz*2.0*cfg.size)
        gh.position.copy(star.position); og.add(gh)
        gsap.to(og.rotation,{z:(pi===0?-1:1)*Math.PI*2, duration:p.spd*(pi===0?1:1.1), repeat:-1, ease:'none'})
        gsap.to(star.material,{opacity:.62, duration:cfg.twinkleSpeed, repeat:-1, yoyo:true, ease:'sine.inOut', delay:pi*.8})
      })
      root.add(sp(radialTex(128,[[0,'rgba(200,190,255,0.55)'],[.38,'rgba(167,139,250,0.12)'],[1,'rgba(0,0,0,0)']]),cfg.size*.75))
      break
    }
  }

  root.scale.setScalar(0)
  gsap.to(root.scale,{x:1,y:1,z:1, duration:1.4, ease:'back.out(2)'})

  const hitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(cfg.size*.55,8,8),
    new THREE.MeshBasicMaterial({visible:false})
  )
  root.add(hitMesh)

  return { root, hitMesh, friendId: friend.id }
}
