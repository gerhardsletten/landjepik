import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import './StaticMap.css'
import { renderStaticMapBlob, type StaticMapOptions } from './renderStaticMap'

export interface StaticMapProps
  extends StaticMapOptions,
    Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height' | 'onError'> {
  /** Image format. Default `image/png`. */
  format?: 'image/png' | 'image/jpeg' | 'image/webp'
  /** Called when the image has been generated. */
  onRender?: (blob: Blob) => void
  onError?: (error: Error) => void
}

/**
 * Renders an OpenStreetMap static map image with a single marker.
 */
export function StaticMap({
  lat,
  lon,
  zoom,
  width,
  height,
  scale,
  provider,
  maxZoom,
  marker,
  tileUrl,
  attribution,
  background,
  format = 'image/png',
  onRender,
  onError,
  alt = 'Map',
  ...imgProps
}: StaticMapProps) {
  const [src, setSrc] = useState<string>()
  const markerKey = JSON.stringify(marker ?? null)

  useEffect(() => {
    let cancelled = false
    let url: string | undefined
    renderStaticMapBlob(
      { lat, lon, zoom, width, height, scale, provider, maxZoom, marker, tileUrl, attribution, background },
      format,
    ).then(
      (blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setSrc(url)
        onRender?.(blob)
      },
      (err: Error) => {
        if (!cancelled) onError?.(err)
      },
    )
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, zoom, width, height, scale, provider, maxZoom, markerKey, tileUrl, attribution, background, format])

  if (!src) {
    return <div className="landjepik-static-map" style={{ width, height, background: background ?? '#ddd' }} />
  }
  return <img className="landjepik-static-map" src={src} width={width} height={height} alt={alt} {...imgProps} />
}
