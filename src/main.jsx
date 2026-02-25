import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrimeReactProvider } from 'primereact/api'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.jsx'
import 'leaflet/dist/leaflet.css'
import 'primereact/resources/themes/lara-light-blue/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
import './App.css'
// CÓDIGO PARA DESTRUIR SERVICE WORKERS ANTIGUOS
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let registration of registrations) {
      registration.unregister()
      console.log('Service Worker eliminado para evitar problemas de caché.')
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <PrimeReactProvider>
        <App />
      </PrimeReactProvider>
    </HelmetProvider>
  </React.StrictMode>,
)
