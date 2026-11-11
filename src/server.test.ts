// @vitest-environment node
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { parseStaticMapParams, staticMapHandler } from './server'

const q = (s: string) => new URLSearchParams(s)

test('parses query params with defaults', () => {
  const { options, render } = parseStaticMapParams(q('lat=59.9&lon=10.75&zoom=14'))
  expect(options).toMatchObject({ lat: 59.9, lon: 10.75, zoom: 14, width: 600, height: 400, scale: 1, provider: 'osm' })
  expect(render.format).toBe('png')
})

test('parses marker, provider and format', () => {
  const { options, render } = parseStaticMapParams(
    q('lat=60&lon=5&zoom=12&provider=kartverket&color=2563eb&markerSize=30&format=jpg'),
  )
  expect(options.provider).toBe('kartverket')
  expect(options.marker).toMatchObject({ color: '#2563eb', size: 30 })
  expect(render.format).toBe('jpeg')
  expect(parseStaticMapParams(q('lat=60&lon=5&zoom=12&marker=false')).options.marker).toBe(false)
})

test('rejects invalid params', () => {
  expect(() => parseStaticMapParams(q('lon=5&zoom=12'))).toThrow(/Missing parameter: lat/)
  expect(() => parseStaticMapParams(q('lat=60&lon=5&zoom=12&width=5000'))).toThrow(/width/)
  expect(() => parseStaticMapParams(q('lat=60&lon=5&zoom=12&provider=evil'))).toThrow(/provider/)
  expect(() => parseStaticMapParams(q('lat=60&lon=5&zoom=12&color=red;x'))).toThrow(/color/)
})

describe('staticMapHandler', () => {
  const realFetch = globalThis.fetch
  const requested: string[] = []

  beforeAll(async () => {
    const tile = createCanvas(256, 256)
    const ctx = tile.getContext('2d')
    ctx.fillStyle = '#9fd3a0'
    ctx.fillRect(0, 0, 256, 256)
    const png = await tile.encode('png')
    globalThis.fetch = (async (url: string) => {
      requested.push(String(url))
      return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } })
    }) as typeof fetch
  })
  afterAll(() => {
    globalThis.fetch = realFetch
  })

  test('returns an image of the requested size', async () => {
    const res = await staticMapHandler(new Request('https://x/api/staticmap?lat=59.91&lon=10.75&zoom=14&width=300&height=200'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toMatch(/s-maxage/)
    const img = await loadImage(Buffer.from(await res.arrayBuffer()))
    expect([img.width, img.height]).toEqual([300, 200])
    expect(requested.every((u) => u.startsWith('https://tile.openstreetmap.org/14/'))).toBe(true)
  })

  test('scale=2 doubles the pixel size', async () => {
    const res = await staticMapHandler(new Request('https://x/?lat=59.91&lon=10.75&zoom=14&width=300&height=200&scale=2&format=webp'))
    expect(res.headers.get('content-type')).toBe('image/webp')
    const img = await loadImage(Buffer.from(await res.arrayBuffer()))
    expect([img.width, img.height]).toEqual([600, 400])
  })

  test('returns 400 on bad input', async () => {
    const res = await staticMapHandler(new Request('https://x/?lat=abc&lon=10&zoom=3'))
    expect(res.status).toBe(400)
    expect(await res.text()).toMatch(/lat/)
  })
})
