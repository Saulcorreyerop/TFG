import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: ['chart.js/auto'],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'framer-motion'],
          leaflet: ['leaflet', 'react-leaflet'],
          prime: ['primereact'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
