import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      },
      // WebSocket dell'hotel (vedi src/hotel/useHotelSocket.js).
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true
      }
    }
  }
})
