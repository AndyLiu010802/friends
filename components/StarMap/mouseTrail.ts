type Particle = {
  x: number; y: number; vx: number; vy: number
  size: number; angle: number; spin: number
  shape: 'crescent' | 'shard' | 'diamond' | 'ring'
  hue: number; alpha: number; life: number; decay: number
}

const particles: Particle[] = []
let moving = false
let moveTimer: ReturnType<typeof setTimeout>

export function initTrail(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight
  })
  window.addEventListener('mousemove', e => {
    spawn(e.clientX, e.clientY)
    moving = true
    clearTimeout(moveTimer)
    moveTimer = setTimeout(() => { moving = false }, 80)
  })

  let last = 0
  function loop(ts: number) {
    requestAnimationFrame(loop)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (moving && ts - last > 28) { spawn(lastX, lastY); last = ts }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x += p.vx; p.y += p.vy; p.vy += 0.04; p.angle += p.spin
      p.life -= p.decay; p.size *= 0.985
      if (p.life <= 0) { particles.splice(i, 1); continue }
      draw(ctx, p)
    }
  }
  requestAnimationFrame(loop)
}

let lastX = 0, lastY = 0
function spawn(x: number, y: number) {
  lastX = x; lastY = y
  const shapes: Particle['shape'][] = ['crescent','shard','diamond','ring']
  particles.push({
    x: x + (Math.random()-.5)*6, y: y + (Math.random()-.5)*6,
    vx: (Math.random()-.5)*1.2, vy: -0.5 - Math.random()*1.5,
    size: 4 + Math.random()*10, angle: Math.random()*Math.PI*2,
    spin: (Math.random()-.5)*0.15,
    shape: shapes[Math.floor(Math.random()*4)],
    hue: 200 + Math.random()*50,
    alpha: 0.85 + Math.random()*0.15,
    life: 1, decay: 0.022 + Math.random()*0.025,
  })
}

function draw(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save()
  ctx.translate(p.x, p.y); ctx.rotate(p.angle)
  ctx.globalAlpha = p.alpha * p.life
  const g = ctx.createRadialGradient(0,0,0,0,0,p.size*2.5)
  g.addColorStop(0, `hsla(${p.hue},80%,92%,0.4)`)
  g.addColorStop(1, `hsla(${p.hue},80%,80%,0)`)
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(0,0,p.size*2.5,0,Math.PI*2); ctx.fill()
  ctx.fillStyle = `hsla(${p.hue},70%,88%,1)`
  ctx.strokeStyle = `hsla(${p.hue},90%,96%,0.9)`
  ctx.lineWidth = 0.8; ctx.shadowColor = `hsla(${p.hue},80%,90%,0.9)`; ctx.shadowBlur = 8
  if (p.shape==='crescent') {
    ctx.beginPath(); ctx.arc(0,0,p.size,0,Math.PI*2)
    ctx.arc(p.size*.42,-p.size*.1,p.size*.72,Math.PI*2,0,true); ctx.closePath()
  } else if (p.shape==='shard') {
    ctx.beginPath(); ctx.moveTo(0,-p.size*1.4); ctx.lineTo(p.size*.3,p.size*.5); ctx.lineTo(-p.size*.25,p.size*.7); ctx.closePath()
  } else if (p.shape==='diamond') {
    ctx.beginPath(); ctx.moveTo(0,-p.size); ctx.lineTo(p.size*.45,0); ctx.lineTo(0,p.size*.7); ctx.lineTo(-p.size*.45,0); ctx.closePath()
  } else {
    ctx.beginPath(); ctx.arc(0,0,p.size,0,Math.PI*2); ctx.arc(0,0,p.size*.55,Math.PI*2,0,true); ctx.closePath()
  }
  ctx.fill(); ctx.stroke(); ctx.restore()
}
