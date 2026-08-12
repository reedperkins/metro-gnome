// Regenerates every logo surface from the single source grid below.
//   npm run icons
//
// Runs directly on Node's native type stripping — keep the syntax erasable
// (no enums, namespaces, or parameter properties).
//
// Surfaces, and why they differ:
//   src/assets/logo.svg  - in-app header. Transparent; always sits on --bg.
//   src/assets/logo-sheet.svg - the same header gnome plus a blinking frame,
//                          laid out horizontally as a CSS sprite sheet.
//   public/favicon.svg   - browser tab. Carries its own background, because a
//                          light tab bar would swallow the white beard.
//   AppIcon-512@2x.png   - iOS app icon. Opaque RGB; App Store validation
//                          rejects icons with an alpha channel.
//   splash-2732*.png     - iOS launch screen, on the app background so a cold
//                          launch can't flash white.
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

type Ink = 'B' | 'D' | 'R' | 'W' | 'G' | 'K' | 'S'
type Cell = Ink | '.'

const PAL: Record<Ink, string> = {
  B: '#3a7bfd', // hat, lit
  D: '#2b5ed4', // hat, shaded
  R: '#ff4433', // bobble
  W: '#f2f3f7', // beard, lit
  G: '#c2c7d4', // beard, shaded
  K: '#12141a', // eyes
  S: '#e8b596', // nose
}

// Pixel-art gnome, lit from the left. Edit here and re-run; everything
// downstream is generated.
const GNOME: string[] = [
  '.....RR.....',
  '.....BD.....',
  '....BBDD....',
  '....BBDD....',
  '...BBBBDD...',
  '...BBBBDD...',
  '..BBBBBBDD..',
  '..BBBBBBDD..',
  '.BBBBBBBBDD.',
  'BBBBBBBBBBDD',
  '.WWKWWWWKWG.',
  '.WWWWSSWWWG.',
  '.WWWWSSWWGG.',
  '.WWWWWWWWGG.',
  '..WWWWWWGG..',
  '...WWWWGG...',
]
// Eyes shut. At 1px per eye there's no room for a half-lidded frame, so the
// closed eye is the shaded beard ink rather than the lit one — dropping it to
// flat W would erase the eye entirely and read as a missing pixel.
const BLINK: string[] = GNOME.map((row) => row.replaceAll('K', 'G'))

// Frame order is the sprite sheet's column order; the CSS steps through it.
const FRAMES: string[][] = [GNOME, BLINK]

const GW = GNOME[0].length
const GH = GNOME.length
const BG = '#12141a' // matches .app background

for (const [i, row] of GNOME.entries()) {
  if (row.length !== GW) throw new Error(`row ${i} is ${row.length} wide, expected ${GW}`)
  for (const c of row) {
    if (c !== '.' && !(c in PAL)) throw new Error(`row ${i} uses unknown ink "${c}"`)
  }
}

function hex(h: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

function crcTable(): Int32Array {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
}
const CRC = crcTable()

function crc32(buf: Buffer): number {
  let c = -1
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

// Opaque RGB, colour type 2 — no alpha channel by design.
function encodePNG(w: number, h: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: RGB
  const stride = w * 3
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Centre the gnome on a square canvas at an integer cell size, so every block
// stays square and no edge lands on a fraction of a pixel.
function raster(size: number, coverage: number): { png: Buffer; cell: number } {
  const cell = Math.floor((size * coverage) / GH)
  const ox = Math.round((size - GW * cell) / 2)
  const oy = Math.round((size - GH * cell) / 2)
  const rgb = Buffer.alloc(size * size * 3)
  const [br, bgc, bb] = hex(BG)
  for (let i = 0; i < size * size; i++) {
    rgb[i * 3] = br
    rgb[i * 3 + 1] = bgc
    rgb[i * 3 + 2] = bb
  }
  GNOME.forEach((row, gy) => {
    for (let gx = 0; gx < GW; gx++) {
      const c = row[gx] as Cell
      if (c === '.') continue
      const [r, g, b] = hex(PAL[c])
      for (let dy = 0; dy < cell; dy++) {
        for (let dx = 0; dx < cell; dx++) {
          const px = ox + gx * cell + dx
          const py = oy + gy * cell + dy
          if (px < 0 || py < 0 || px >= size || py >= size) continue
          const o = (py * size + px) * 3
          rgb[o] = r
          rgb[o + 1] = g
          rgb[o + 2] = b
        }
      }
    }
  })
  return { png: encodePNG(size, size, rgb), cell }
}

// Merge horizontal runs of one colour into single rects to keep the SVG small.
function rects(indent: string, grid: string[] = GNOME, ox = 0): string {
  const out: string[] = []
  grid.forEach((row, y) => {
    let x = 0
    while (x < GW) {
      const c = row[x] as Cell
      if (c === '.') {
        x++
        continue
      }
      let run = 1
      while (x + run < GW && row[x + run] === c) run++
      out.push(`${indent}<rect x="${ox + x}" y="${y}" width="${run}" height="1" fill="${PAL[c]}"/>`)
      x += run
    }
  })
  return out.join('\n')
}

function write(rel: string, data: string | Buffer): void {
  const abs = path.join(ROOT, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, data)
  const n = typeof data === 'string' ? Buffer.byteLength(data) : data.length
  console.log(`  ${rel.padEnd(62)} ${String(n).padStart(7)} B`)
}

console.log(`gnome ${GW}x${GH}\n`)

// width/height give the <img> an intrinsic aspect ratio, so `height: 2rem;
// width: auto` resolves without the box collapsing.
write(
  'src/assets/logo.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="${GW}" height="${GH}" viewBox="0 0 ${GW} ${GH}" shape-rendering="crispEdges">
${rects('  ')}
</svg>
`,
)

// Frames sit edge to edge with no gutter, so the CSS can address frame i by
// stepping background-position-x in even fractions. Keep FRAMES.length in sync
// with --logo-frames in App.vue.
write(
  'src/assets/logo-sheet.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="${GW * FRAMES.length}" height="${GH}" viewBox="0 0 ${GW * FRAMES.length} ${GH}" shape-rendering="crispEdges">
${FRAMES.map((f, i) => rects('  ', f, i * GW)).join('\n')}
</svg>
`,
)

const fpad = (16 - GW) / 2
write(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="${-fpad} 0 16 ${GH}" shape-rendering="crispEdges">
  <rect x="${-fpad}" y="0" width="16" height="${GH}" rx="2" fill="${BG}"/>
${rects('  ')}
</svg>
`,
)

const icon = raster(1024, 0.7)
write('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', icon.png)

// All three scale slots are the same 2732 square, matching what Capacitor ships.
const splash = raster(2732, 0.22)
for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  write(`ios/App/App/Assets.xcassets/Splash.imageset/${f}`, splash.png)
}

console.log(`\napp icon ${icon.cell}px cells, splash ${splash.cell}px cells`)
console.log('run `npm run cap:sync` to push the web assets into the iOS project')
