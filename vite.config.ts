import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // `npm run dev` serves the playground in ./dev
  root: 'dev',
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        server: resolve(import.meta.dirname, 'src/server.ts'),
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
      cssFileName: 'landjepik',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', '@napi-rs/canvas', /^node:/],
    },
  },
  test: {
    root: import.meta.dirname,
    environment: 'jsdom',
    globals: true,
  },
})
