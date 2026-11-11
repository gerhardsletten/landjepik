# landjepik

Generates static map images from OpenStreetMap or Kartverket tiles, with a single marker.
In the browser as a React component (composed on a canvas), or on the server as a Vercel function.

## Install

```sh
npm install landjepik
```

```tsx
import { StaticMap } from 'landjepik'
import 'landjepik/style.css'

<StaticMap lat={59.9139} lon={10.7522} zoom={14} width={600} height={400} />

<StaticMap
  lat={60.3913}
  lon={5.3221}
  zoom={12}
  width={300}
  height={200}
  marker={{ color: '#2563eb', size: 32 }}
  format="image/jpeg"
  onRender={(blob) => console.log(blob)}
/>
```

Without React:

```ts
import { renderStaticMap, renderStaticMapBlob } from 'landjepik'

const blob = await renderStaticMapBlob({ lat: 59.9139, lon: 10.7522, zoom: 14, width: 600, height: 400 })
const canvas = await renderStaticMap({ lat: 59.9139, lon: 10.7522, zoom: 14, width: 600, height: 400 })
```

### Options

| Option        | Default                                         | Description                                           |
| ------------- | ----------------------------------------------- | ----------------------------------------------------- |
| `lat`, `lon`  | –                                               | Map center                                            |
| `zoom`        | –                                               | Integer zoom level, 0–19                              |
| `width`, `height` | –                                           | Image size in pixels                                  |
| `scale`       | `1`                                             | Pixel density. `2` = 2× image, displayed at `width × height` |
| `provider`    | `osm`                                           | Built-in tile source, see below                       |
| `maxZoom`     | from `provider`                                 | Highest zoom the tile source offers                   |
| `marker`      | `true`                                          | `true` = at center, `false` = none, or `{ lat, lon, color, size }` |
| `tileUrl`     | from `provider`                                 | Tile URL template (server must send CORS headers)    |
| `attribution` | from `provider`                                 | Text drawn bottom right, or `false`                   |
| `background`  | `#ddd`                                          | Fill where no tiles exist                             |
| `format`      | `image/png`                                     | Component only: output image type                     |

### Tile providers

| `provider`          | Map                                    | Coverage | Max zoom | Attribution                    |
| ------------------- | -------------------------------------- | -------- | -------- | ------------------------------ |
| `osm`               | OpenStreetMap standard                 | World    | 19       | © OpenStreetMap contributors   |
| `kartverket`        | Kartverket topographic (norgeskart)    | Norway   | 18       | © Kartverket                   |
| `kartverket-grey`   | Kartverket topographic, grey tones     | Norway   | 18       | © Kartverket                   |
| `kartverket-raster` | Kartverket raster (N50 style)          | Norway   | 18       | © Kartverket                   |
| `kartverket-sea`    | Kartverket nautical chart              | Norway   | 18       | © Kartverket                   |

```tsx
<StaticMap provider="kartverket" lat={59.9139} lon={10.7522} zoom={14} width={600} height={400} />
```

Kartverket data is open (CC BY 4.0) and free to use, also commercially, with attribution.
`tileUrl`, `attribution` and `maxZoom` override the provider's values. Zoom above `maxZoom` upscales the deepest tiles.

### Sharp images on retina screens

Opt-in. With `scale: 2` the canvas is rendered at double resolution. For tile sources without retina tiles (like OSM)
tiles from one zoom level deeper are used: sharp, but map labels look smaller. If your tile source has `@2x`
tiles, put `{r}` in `tileUrl` and it is used instead, e.g.
`https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` (Carto has its own terms and attribution).

Note: the public OSM tile server has a [usage policy](https://operations.osmfoundation.org/policies/tiles/) — use your own tile source via `tileUrl` for heavy traffic.

## Server / Vercel function

`landjepik/server` renders the same image in Node, e.g. as a Vercel serverless function — like a
self-hosted static map API. It needs the optional peer dependency `@napi-rs/canvas`:

```sh
npm install landjepik @napi-rs/canvas
```

```ts
// api/staticmap.ts
import { staticMapHandler } from 'landjepik/server'

export const GET = (request: Request) =>
  staticMapHandler(request, {
    // OSM's tile policy requires an identifying User-Agent
    userAgent: 'my-app/1.0 (+https://example.com)',
  })
```

```html
<img src="/api/staticmap?lat=59.9139&lon=10.7522&zoom=14&width=600&height=400" width="600" height="400" alt="Map" />
```

Use the Node.js runtime (not Edge — `@napi-rs/canvas` is a native module).

| Query param            | Default | Description                                         |
| ---------------------- | ------- | --------------------------------------------------- |
| `lat`, `lon`, `zoom`   | –       | Required                                            |
| `width`, `height`      | 600×400 | Max 1280 (`maxSize` handler option)                 |
| `scale`                | `1`     | 1–3                                                 |
| `provider`             | `osm`   | See tile providers above                            |
| `marker`               | on      | `false`/`0`/`none` hides it                         |
| `color`, `markerSize`  | `e11d48`, `40` | Hex color without `#`                        |
| `markerLat`, `markerLon` | center | Marker position                                    |
| `format`, `quality`    | `png`, `85` | `png`, `jpeg` or `webp`                         |

Responses get `Cache-Control: public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400`,
so Vercel's CDN serves repeated requests without re-rendering (override with `cacheControl`).
Tile URLs can't be set from the query string. Restrict providers with `providers: ['kartverket']`.
Lower-level building blocks: `renderStaticMapImage(options, { format })` returns a `Buffer`,
and `parseStaticMapParams(searchParams)` parses the query.

## Development

```sh
npm install
npm run dev        # playground at http://localhost:5173 (dev/main.tsx), with HMR
npm test           # vitest
npm run typecheck
npm run build      # outputs ESM + .d.ts + CSS to dist/
npm publish        # runs typecheck, tests and build first
```

The bundled Inter font (used for attribution text on the server) is licensed under the SIL Open Font License 1.1, see `src/fonts/Inter-LICENSE.txt`.
