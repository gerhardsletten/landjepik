import { getTiles, project, PROVIDERS, tileUrlFor, TILE_SIZE } from './renderStaticMap'

test('project maps 0,0 to the middle of the world', () => {
  const p = project({ lat: 0, lon: 0 }, 1)
  expect(p.x).toBeCloseTo(TILE_SIZE)
  expect(p.y).toBeCloseTo(TILE_SIZE)
})

test('getTiles covers the whole image', () => {
  const { tiles } = getTiles({ lat: 59.9139, lon: 10.7522, zoom: 14, width: 600, height: 400 })
  // 600px wide spans 3–4 tiles, 400px high spans 2–3 tiles
  expect(tiles.length).toBeGreaterThanOrEqual(6)
  for (const t of tiles) {
    expect(t.dx).toBeGreaterThan(-TILE_SIZE)
    expect(t.dx).toBeLessThan(600)
    expect(t.dy).toBeGreaterThan(-TILE_SIZE)
    expect(t.dy).toBeLessThan(400)
  }
  // Oslo at z14
  expect(tiles.some((t) => t.x === 8681 && t.y === 4764)).toBe(true)
})

test('getTiles wraps x around the antimeridian', () => {
  const { tiles } = getTiles({ lat: 0, lon: 179.99, zoom: 2, width: 512, height: 256 })
  const xs = tiles.map((t) => t.x)
  expect(xs).toContain(3)
  expect(xs).toContain(0)
})

test('tileUrlFor fills template', () => {
  expect(tileUrlFor('https://t/{z}/{x}/{y}.png', { z: 3, x: 4, y: 5 })).toBe('https://t/3/4/5.png')
})

test('scale 2 with deeper tiles: native-size tiles covering a 2× canvas', () => {
  const opts = { lat: 59.9139, lon: 10.7522, zoom: 14, width: 600, height: 400 }
  const { tiles, left, top } = getTiles({ ...opts, scale: 2, tileZoom: 15 })
  expect(tiles.every((t) => t.size === TILE_SIZE && t.z === 15)).toBe(true)
  // Same geographic origin as scale 1, in doubled pixels
  const base = getTiles(opts)
  expect(Math.abs(left - base.left * 2)).toBeLessThanOrEqual(1)
  expect(Math.abs(top - base.top * 2)).toBeLessThanOrEqual(1)
  // Every canvas pixel is covered
  const minX = Math.min(...tiles.map((t) => t.dx))
  const maxX = Math.max(...tiles.map((t) => t.dx + t.size))
  expect(minX).toBeLessThanOrEqual(0)
  expect(maxX).toBeGreaterThanOrEqual(1200)
})

test('scale 2 with retina tiles: 512px tiles at same zoom', () => {
  const { tiles } = getTiles({ lat: 0, lon: 0, zoom: 3, width: 300, height: 200, scale: 2 })
  expect(tiles.every((t) => t.size === 512 && t.z === 3)).toBe(true)
})

test('tileUrlFor fills {r} for retina', () => {
  expect(tileUrlFor('https://t/{z}/{x}/{y}{r}.png', { z: 1, x: 0, y: 0 }, true)).toBe('https://t/1/0/0@2x.png')
  expect(tileUrlFor('https://t/{z}/{x}/{y}{r}.png', { z: 1, x: 0, y: 0 })).toBe('https://t/1/0/0.png')
})

test('kartverket provider uses {z}/{y}/{x} order', () => {
  expect(tileUrlFor(PROVIDERS.kartverket.tileUrl, { z: 14, x: 8681, y: 4764 })).toBe(
    'https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/14/4764/8681.png',
  )
  expect(PROVIDERS.kartverket.maxZoom).toBe(18)
})
