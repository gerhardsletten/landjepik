import { staticMapHandler } from 'landjepik/server'

// GET /api/staticmap?lat=59.9139&lon=10.7522&zoom=14&width=600&height=400
export function GET(request: Request) {
  return staticMapHandler(request, {
    // OSM's tile policy requires an identifying User-Agent: set your app name and a contact URL
    userAgent: process.env.TILE_USER_AGENT ?? 'landjepik-vercel-example',
  })
}
