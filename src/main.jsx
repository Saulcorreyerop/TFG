import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrimeReactProvider } from 'primereact/api'
import App from './App.jsx'
import 'leaflet/dist/leaflet.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
import './styles/tokens.css'
import './styles/primereact.css'
import './styles/utilities.css'
import './App.css'
import { ThemeProvider } from './hooks/ThemeContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrimeReactProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </PrimeReactProvider>
  </React.StrictMode>,
)