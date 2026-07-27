export function initTrail(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight
  })

  let x = -100, y = -100
  let visible = false
  window.addEventListener('mousemove', e => {
    x = e.clientX; y = e.clientY; visible = true
  })

  function loop() {
    requestAnimationFrame(loop)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!visible) return

    const glow = ctx.createRadialGradient(x, y, 0, x, y, 8)
    glow.addColorStop(0, 'rgba(226,240,255,0.55)')
    glow.addColorStop(1, 'rgba(226,240,255,0)')
    ctx.fillStyle = glow
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill()

    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill()
  }
  requestAnimationFrame(loop)
}
