import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'framer-motion'],
          leaflet: ['leaflet', 'react-leaflet'],
          prime: ['primereact', 'primeicons'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
