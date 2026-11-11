// Platform-agnostic map math and drawing, shared by the browser and server renderers.

export const TILE_SIZE = 256
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors'

const MAX_LAT = 85.05112878

export interface TileProvider {
  tileUrl: string
  attribution: string
  maxZoom: number
}

const kartverket = (layer: string): TileProvider => ({
  // Note: Kartverket uses {z}/{y}/{x} order
  tileUrl: `https://cache.kartverket.no/v1/wmts/1.0.0/${layer}/default/webmercator/{z}/{y}/{x}.png`,
  attribution: '© Kartverket',
  maxZoom: 18,
})

/** Built-in tile sources. Kartverket maps cover Norway only (CC BY 4.0). */
export const PROVIDERS = {
  osm: { tileUrl: OSM_TILE_URL, attribution: OSM_ATTRIBUTION, maxZoom: 19 },
  /** Kartverket topographic map ("Topografisk norgeskart"). */
  kartverket: kartverket('topo'),
  /** Kartverket topographic map in grey tones. */
  'kartverket-grey': kartverket('topograatone'),
  /** Kartverket raster map (N50-style, good for hiking). */
  'kartverket-raster': kartverket('toporaster'),
  /** Kartverket nautical chart. */
  'kartverket-sea': kartverket('sjokartraster'),
} satisfies Record<string, TileProvider>

export type ProviderName = keyof typeof PROVIDERS

export interface LatLon {
  lat: number
  lon: number
}

export interface MarkerOptions {
  /** Position of the marker. Defaults to the map center. */
  lat?: number
  lon?: number
  /** Fill color of the pin. Default `#e11d48`. */
  color?: string
  /** Pin height in CSS pixels. Default `40`. */
  size?: number
}

export interface StaticMapOptions {
  /** Map center latitude. */
  lat: number
  /** Map center longitude. */
  lon: number
  /** Integer zoom level, 0–19. */
  zoom: number
  /** Image width in CSS pixels. */
  width: number
  /** Image height in CSS pixels. */
  height: number
  /**
   * Pixel density of the output. `2` renders a 2× image (the canvas becomes
   * `width*2 × height*2`). Default `1`.
   *
   * If `tileUrl` contains `{r}`, it is replaced with `@2x` and the source's
   * 512px retina tiles are used. Otherwise tiles from a deeper zoom level are
   * used, which is sharp but makes map labels appear smaller.
   */
  scale?: number
  /**
   * Built-in tile source: `osm` (default), `kartverket`, `kartverket-grey`,
   * `kartverket-raster` or `kartverket-sea`. Sets `tileUrl`, `attribution`
   * and `maxZoom`, each of which can still be overridden.
   */
  provider?: ProviderName
  /** Highest zoom level the tile source provides. Default from `provider`. */
  maxZoom?: number
  /** Draw a marker. `true` puts one at the center. Default `true`. */
  marker?: boolean | MarkerOptions
  /** Tile URL template with `{z}`, `{x}`, `{y}` and optional `{r}`. Default from `provider`. */
  tileUrl?: string
  /** Attribution text drawn bottom right, or `false` to omit. Default from `provider`. */
  attribution?: string | false
  /** Background color for areas without tiles. Default `#ddd`. */
  background?: string
}

/** Project lat/lon to global pixel coordinates (Web Mercator) at a zoom level. */
export function project({ lat, lon }: LatLon, zoom: number): { x: number; y: number } {
  const size = TILE_SIZE * 2 ** zoom
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat))
  const rad = (clamped * Math.PI) / 180
  const x = ((lon + 180) / 360) * size
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * size
  return { x, y }
}

export interface TilePlacement {
  /** Tile coordinates used in the URL (x wrapped around the antimeridian). */
  z: number
  x: number
  y: number
  /** Where to draw the tile on the canvas, in canvas pixels. */
  dx: number
  dy: number
  /** Drawn size of the tile in canvas pixels. */
  size: number
}

export interface TileGridOptions extends Pick<StaticMapOptions, 'lat' | 'lon' | 'zoom' | 'width' | 'height'> {
  scale?: number
  /** Zoom level of the tiles to fetch. Default: same as `zoom`. */
  tileZoom?: number
}

/** Compute which tiles cover the image and where each goes (canvas pixels). */
export function getTiles(opts: TileGridOptions): { tiles: TilePlacement[]; left: number; top: number } {
  const zoom = Math.round(opts.zoom)
  const scale = opts.scale ?? 1
  const tz = opts.tileZoom ?? zoom
  const n = 2 ** tz
  // Size of one tile on the canvas
  const size = TILE_SIZE * scale * 2 ** (zoom - tz)
  const w = Math.round(opts.width * scale)
  const h = Math.round(opts.height * scale)

  const center = project(opts, zoom)
  const left = Math.round(center.x * scale - w / 2)
  const top = Math.round(center.y * scale - h / 2)

  const tiles: TilePlacement[] = []
  const x0 = Math.floor(left / size)
  const x1 = Math.floor((left + w - 1) / size)
  const y0 = Math.floor(top / size)
  const y1 = Math.floor((top + h - 1) / size)

  for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= n) continue
    for (let tx = x0; tx <= x1; tx++) {
      tiles.push({
        z: tz,
        x: ((tx % n) + n) % n,
        y: ty,
        dx: tx * size - left,
        dy: ty * size - top,
        size,
      })
    }
  }
  return { tiles, left, top }
}

export function tileUrlFor(template: string, t: Pick<TilePlacement, 'z' | 'x' | 'y'>, retina = false): string {
  return template
    .replace('{z}', String(t.z))
    .replace('{x}', String(t.x))
    .replace('{y}', String(t.y))
    .replace('{r}', retina ? '@2x' : '')
}

/** Canvas size in device pixels for the given options. */
export function canvasSize(options: StaticMapOptions): { width: number; height: number } {
  const scale = options.scale ?? 1
  return { width: Math.round(options.width * scale), height: Math.round(options.height * scale) }
}

// Classic map pin in a 24×36 box, tip at (12, 36).
function pinPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.moveTo(12, 0)
  ctx.bezierCurveTo(5.37, 0, 0, 5.37, 0, 12)
  ctx.bezierCurveTo(0, 21, 12, 36, 12, 36)
  ctx.bezierCurveTo(12, 36, 24, 21, 24, 12)
  ctx.bezierCurveTo(24, 5.37, 18.63, 0, 12, 0)
  ctx.closePath()
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  size: number,
  deviceScale: number,
) {
  const s = size / 36
  ctx.save()
  ctx.translate(x - 12 * s, y - 36 * s)
  ctx.scale(s, s)
  // Shadow values are in device pixels, unaffected by the transform
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 4 * deviceScale
  ctx.shadowOffsetY = 1 * deviceScale
  ctx.fillStyle = color
  pinPath(ctx)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(12, 12, 4.5, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.restore()
}

function drawAttribution(ctx: CanvasRenderingContext2D, text: string, width: number, height: number, font: string) {
  ctx.save()
  ctx.font = `11px ${font}`
  const pad = 4
  const w = ctx.measureText(text).width + pad * 2
  const h = 16
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillRect(width - w, height - h, w, h)
  ctx.fillStyle = '#333'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width - w + pad, height - h / 2)
  ctx.restore()
}

export interface DrawPlatform {
  /** Load a tile image from a URL into something `ctx.drawImage` accepts. */
  loadImage: (url: string) => Promise<unknown>
  /** CSS font family for the attribution text. */
  fontFamily: string
}

/** Draw the full static map onto a 2D context sized with `canvasSize(options)`. */
export async function drawStaticMap(
  ctx: CanvasRenderingContext2D,
  options: StaticMapOptions,
  platform: DrawPlatform,
): Promise<void> {
  const preset = PROVIDERS[options.provider ?? 'osm']
  if (!preset) throw new Error(`Unknown provider: ${options.provider}`)
  const {
    width,
    height,
    scale = 1,
    maxZoom = preset.maxZoom,
    marker = true,
    tileUrl = preset.tileUrl,
    attribution = preset.attribution,
    background = '#ddd',
  } = options
  const zoom = Math.round(options.zoom)
  const size = canvasSize(options)

  ctx.fillStyle = background
  ctx.fillRect(0, 0, size.width, size.height)

  // Pick tile source for the requested density.
  // Beyond maxZoom, the deepest available tiles are upscaled.
  const retina = scale > 1 && tileUrl.includes('{r}')
  const tileZoom = Math.min(maxZoom, retina ? zoom : zoom + Math.max(0, Math.round(Math.log2(scale))))

  const { tiles, left, top } = getTiles({ ...options, scale, tileZoom })
  const images = await Promise.all(tiles.map((t) => platform.loadImage(tileUrlFor(tileUrl, t, retina))))
  ctx.imageSmoothingQuality = 'high'
  images.forEach((img, i) =>
    ctx.drawImage(img as CanvasImageSource, tiles[i].dx, tiles[i].dy, tiles[i].size, tiles[i].size),
  )

  // Draw overlays in CSS pixels
  ctx.scale(scale, scale)
  if (marker) {
    const m = marker === true ? {} : marker
    const p = project({ lat: m.lat ?? options.lat, lon: m.lon ?? options.lon }, zoom)
    drawMarker(ctx, p.x - left / scale, p.y - top / scale, m.color ?? '#e11d48', m.size ?? 40, scale)
  }
  if (attribution) drawAttribution(ctx, attribution, width, height, platform.fontFamily)
}
