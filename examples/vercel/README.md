# landjepik – Vercel example

A Vercel serverless function that returns a static map image, plus a small demo page.

```
GET /api/staticmap?lat=59.9139&lon=10.7522&zoom=14&width=600&height=400&provider=kartverket
```

See the main README for all query parameters.

## Files

- `api/staticmap.ts` – the function (Node.js runtime)
- `public/index.html` – demo page with a form for the parameters
- `vercel.json` – builds the library from the repo root, region `arn1` (Stockholm, close to the tile servers)

## Run locally

```sh
npm --prefix ../.. install && npm --prefix ../.. run build   # build landjepik
npm install
npx vercel dev
```

## Deploy

1. Push the repo to GitHub and import it in Vercel.
2. Set **Root Directory** to `examples/vercel` and keep "Include files outside the root directory" enabled
   (the install step builds the library from `../..`).
3. Optional: set the env var `TILE_USER_AGENT` to `your-app/1.0 (+https://your-site)` — OSM's tile policy
   requires an identifying User-Agent.

Or from the CLI in this folder: `npx vercel deploy`.

Once `landjepik` is published to npm, replace `"landjepik": "file:../.."` with a version and remove
`installCommand` from `vercel.json`.
