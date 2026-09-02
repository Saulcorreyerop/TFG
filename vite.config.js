import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/*.rar', '**/*.zip']
    }
  },
  build: {
    rollupOptions: {
      output: {
        /*
         * No se agrupa 'primereact' aquí. Nombrar el paquete obliga a
         * Rollup a resolver su entrada principal (primereact.all.esm.js),
         * que importa TODA la librería, incluido el componente Chart y con
         * él chart.js/auto. Eso es lo que hacía falta el external de
         * chart.js/auto en la configuración anterior: no era una
         * optimización, era un parche para un import que no se usa.
         *
         * Los componentes se importan uno a uno (primereact/button, etc.),
         * así que Rollup ya los reparte solo y sin arrastrar el resto.
         */
        manualChunks: {
          vendor: ['react', 'react-dom', 'framer-motion'],
          leaflet: ['leaflet', 'react-leaflet'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
