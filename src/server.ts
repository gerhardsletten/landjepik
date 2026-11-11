// Node renderer (e.g. Vercel serverless functions). Requires the optional peer `@napi-rs/canvas`.
import { createCanvas, GlobalFonts, loadImage, type Image } from '@napi-rs/canvas'
import fontDataUrl from './fonts/inter-latin-400-normal.woff2?inline'
import { canvasSize, drawStaticMap, PROVIDERS, type ProviderName, type StaticMapOptions } from './core'

export * from './core'

export type ImageFormat = 'png' | 'jpeg' | 'webp'

export interface ServerRenderOptions {
  /** Output format. Default `png`. */
  format?: ImageFormat
  /** JPEG/WebP quality, 0–100. Default `85`. */
  quality?: number
  /**
   * User-Agent sent to the tile server. OSM's tile policy requires an
   * identifying User-Agent, so set this to your app name + contact URL.
   */
  userAgent?: string
}

const FONT_FAMILY = 'LandjepikInter'
let fontRegistered = false
function ensureFont() {
  if (fontRegistered) return
  // Serverless environments have no system fonts, so we bundle one.
  const base64 = fontDataUrl.slice(fontDataUrl.indexOf(',') + 1)
  GlobalFonts.register(Buffer.from(base64, 'base64'), FONT_FAMILY)
  fontRegistered = true
}

// Small in-memory tile cache, reused across warm invocations.
const TILE_CACHE_LIMIT = 256
const tileCache = new Map<string, Promise<Image>>()

function fetchTile(url: string, userAgent: string): Promise<Image> {
  const hit = tileCache.get(url)
  if (hit) {
    tileCache.delete(url)
    tileCache.set(url, hit)
    return hit
  }
  const promise = (async () => {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent } })
    if (!res.ok) throw new Error(`Failed to load tile (${res.status}): ${url}`)
    return loadImage(Buffer.from(await res.arrayBuffer()))
  })()
  promise.catch(() => tileCache.delete(url))
  tileCache.set(url, promise)
  if (tileCache.size > TILE_CACHE_LIMIT) tileCache.delete(tileCache.keys().next().value!)
  return promise
}

/** Render a static map to an image Buffer in Node. */
export async function renderStaticMapImage(
  options: StaticMapOptions,
  { format = 'png', quality = 85, userAgent = 'landjepik-static-map' }: ServerRenderOptions = {},
): Promise<Buffer> {
  ensureFont()
  const { width, height } = canvasSize(options)
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  await drawStaticMap(ctx as unknown as CanvasRenderingContext2D, options, {
    loadImage: (url) => fetchTile(url, userAgent),
    fontFamily: FONT_FAMILY,
  })
  if (format === 'png') return canvas.encode('png')
  return canvas.encode(format, quality)
}

export class StaticMapParamError extends Error {}

export interface ParseOptions {
  /** Max width/height in CSS pixels. Default `1280`. */
  maxSize?: number
  /** Providers allowed via `?provider=`. Default: all built-in. */
  providers?: ProviderName[]
}

/**
 * Parse query parameters into render options.
 *
 * `lat`, `lon`, `zoom` (required), `width`, `height` (default 600×400),
 * `scale` (1–3), `provider`, `marker` (`false`/`0`/`none` to hide),
 * `color`, `markerSize`, `markerLat`, `markerLon`, `format` (png|jpeg|webp), `quality`.
 */
export function parseStaticMapParams(
  params: URLSearchParams,
  { maxSize = 1280, providers = Object.keys(PROVIDERS) as ProviderName[] }: ParseOptions = {},
): { options: StaticMapOptions; render: ServerRenderOptions } {
  const num = (name: string, def: number | undefined, min: number, max: number, int = false): number => {
    const raw = params.get(name)
    if (raw === null || raw === '') {
      if (def === undefined) throw new StaticMapParamError(`Missing parameter: ${name}`)
      return def
    }
    const v = Number(raw)
    if (!Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v))) {
      throw new StaticMapParamError(`Invalid ${name}: must be ${int ? 'an integer' : 'a number'} between ${min} and ${max}`)
    }
    return v
  }

  const provider = (params.get('provider') ?? 'osm') as ProviderName
  if (!providers.includes(provider)) {
    throw new StaticMapParamError(`Invalid provider: must be one of ${providers.join(', ')}`)
  }
  const maxZoom = PROVIDERS[provider].maxZoom + 1

  let color = params.get('color') ?? undefined
  if (color !== undefined) {
    if (/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color)) color = `#${color}`
    if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color)) {
      throw new StaticMapParamError('Invalid color: use a hex color like e11d48')
    }
  }

  const markerParam = params.get('marker')
  const marker = ['false', '0', 'none', 'no'].includes(markerParam ?? '')
    ? false
    : {
        color,
        size: num('markerSize', 40, 8, 128),
        lat: params.has('markerLat') ? num('markerLat', undefined, -90, 90) : undefined,
        lon: params.has('markerLon') ? num('markerLon', undefined, -180, 180) : undefined,
      }

  const formatParam = (params.get('format') ?? 'png').toLowerCase()
  const format = formatParam === 'jpg' ? 'jpeg' : formatParam
  if (format !== 'png' && format !== 'jpeg' && format !== 'webp') {
    throw new StaticMapParamError('Invalid format: must be png, jpeg or webp')
  }

  return {
    options: {
      lat: num('lat', undefined, -90, 90),
      lon: num('lon', undefined, -180, 180),
      zoom: num('zoom', undefined, 0, maxZoom, true),
      width: num('width', 600, 16, maxSize, true),
      height: num('height', 400, 16, maxSize, true),
      scale: num('scale', 1, 1, 3, true),
      provider,
      marker,
    },
    render: { format, quality: num('quality', 85, 1, 100, true) },
  }
}

export interface StaticMapHandlerOptions extends ParseOptions {
  /** User-Agent sent to the tile server, see `ServerRenderOptions.userAgent`. */
  userAgent?: string
  /** Cache-Control header for successful responses. Default: 1 day in browsers, 30 days on the CDN. */
  cacheControl?: string
}

const CONTENT_TYPES: Record<ImageFormat, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }

/**
 * Web-standard request handler: `GET ?lat=..&lon=..&zoom=..` → image.
 * Works as a Vercel function (Node.js runtime): `export const GET = (req: Request) => staticMapHandler(req)`.
 */
export async function staticMapHandler(request: Request, handlerOptions: StaticMapHandlerOptions = {}): Promise<Response> {
  const {
    userAgent,
    cacheControl = 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400',
  } = handlerOptions
  let parsed: ReturnType<typeof parseStaticMapParams>
  try {
    parsed = parseStaticMapParams(new URL(request.url).searchParams, handlerOptions)
  } catch (err) {
    if (err instanceof StaticMapParamError) return text(400, err.message)
    throw err
  }
  try {
    const image = await renderStaticMapImage(parsed.options, { ...parsed.render, userAgent })
    return new Response(new Uint8Array(image), {
      headers: {
        'Content-Type': CONTENT_TYPES[parsed.render.format ?? 'png'],
        'Cache-Control': cacheControl,
      },
    })
  } catch (err) {
    return text(502, err instanceof Error ? err.message : 'Failed to render map')
  }
}

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
}
