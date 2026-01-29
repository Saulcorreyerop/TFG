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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <PrimeReactProvider>
        <App />
      </PrimeReactProvider>
    </HelmetProvider>
  </React.StrictMode>,
)
