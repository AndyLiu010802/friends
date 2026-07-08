// 一次性生成 app/apple-icon.png（180×180）。iOS 不认 manifest 里的 SVG，
// 需要位图 apple-icon。纯 Node 实现（zlib + 手写 PNG chunk），零新依赖。
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const SIZE = 180
const CX = SIZE / 2, CY = SIZE / 2

// 四芒星亮度场：菱形主体 + 中心高光 + 微光晕
function pixel(x, y) {
  const dx = x - CX, dy = y - CY
  // astroid 曲线 |x|^(2/3)+|y|^(2/3) ≤ R^(2/3)：内凹的四芒星形
  const star = Math.cbrt(dx * dx) + Math.cbrt(dy * dy)
  const r = Math.hypot(dx, dy)
  const bg = [2, 4, 8]                                  // #020408
  const gold = [226, 185, 111]                          // #e2b96f
  const bright = [245, 227, 189]                        // #f5e3bd
  if (star < Math.cbrt(68 * 68)) {
    const t = Math.max(0, 1 - r / 20)                   // 中心高光
    return gold.map((c, i) => Math.round(c + (bright[i] - c) * t))
  }
  const halo = Math.max(0, 1 - r / 80) * 0.25           // 淡金光晕
  return bg.map((c, i) => Math.round(c + gold[i] * halo))
}

// RGBA 原始扫描线（每行前置 filter byte 0）
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE * 4 + 1)
  raw[row] = 0
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b] = pixel(x, y)
    const o = row + 1 + x * 4
    raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(body))
  return Buffer.concat([len, body, c])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0 // 8bit RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])

writeFileSync(new URL('../app/apple-icon.png', import.meta.url), png)
console.log(`app/apple-icon.png written (${png.length} bytes)`)
