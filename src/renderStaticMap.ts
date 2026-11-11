// Browser renderer.
import { canvasSize, drawStaticMap, type StaticMapOptions } from './core'

export * from './core'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Tile server must send CORS headers (OSM and Kartverket do) or the canvas becomes tainted.
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load tile: ${src}`))
    img.src = src
  })
}

/** Render a static map to a canvas of `width*scale × height*scale` pixels. */
export async function renderStaticMap(options: StaticMapOptions): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  Object.assign(canvas, canvasSize(options))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context not available')
  await drawStaticMap(ctx, options, { loadImage, fontFamily: 'system-ui, -apple-system, sans-serif' })
  return canvas
}

/** Render a static map and return it as an image Blob (PNG by default). */
export async function renderStaticMapBlob(
  options: StaticMapOptions,
  type: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png',
  quality?: number,
): Promise<Blob> {
  const canvas = await renderStaticMap(options)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))), type, quality),
  )
}
