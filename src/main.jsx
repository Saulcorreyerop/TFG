import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrimeReactProvider } from 'primereact/api'
import App from './App.jsx'

// --- 1. ESTILOS DEL MAPA ---
import 'leaflet/dist/leaflet.css'

// --- 2. CAMBIO DE TEMA A CLARO (LIGHT) ---
import 'primereact/resources/themes/lara-light-blue/theme.css' // <--- CAMBIO AQUÍ
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'

import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrimeReactProvider>
      <App />
    </PrimeReactProvider>
  </React.StrictMode>,
)
