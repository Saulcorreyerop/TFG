import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrimeReactProvider } from 'primereact/api'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.jsx'
import 'leaflet/dist/leaflet.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
import './styles/tokens.css'
import './styles/utilities.css'
import './App.css'
import { ThemeProvider } from './hooks/ThemeContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <PrimeReactProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </PrimeReactProvider>
    </HelmetProvider>
  </React.StrictMode>,
)