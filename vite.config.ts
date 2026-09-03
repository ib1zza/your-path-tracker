import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['maplibre-gl'],
    exclude: ['maplibre-gl/dist/maplibre-gl-worker.mjs'],
  },
})
