import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        // three.js (carta 3D e apertura 3D dei pacchetti) in un file suo: si scarica solo lì
        // e resta nella cache del browser fra un aggiornamento e l'altro dell'app.
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
          return undefined;
        }
      }
    },
    // three.js da solo supera i 500 kB e non si puo' dividere: si alza la soglia dell'avviso.
    chunkSizeWarningLimit: 1000
  },
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
