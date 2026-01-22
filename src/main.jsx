import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrimeReactProvider } from 'primereact/api'
import App from './App.jsx'

// 1. Tema (Colores y formas)
import 'primereact/resources/themes/lara-dark-blue/theme.css'
// 2. Core (Funcionalidad básica)
import 'primereact/resources/primereact.min.css'
// 3. Iconos
import 'primeicons/primeicons.css'
// 4. PrimeFlex (¡IMPORTANTE! Esto arregla los espaciados y alineaciones)
import 'primeflex/primeflex.css'

import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrimeReactProvider>
      <App />
    </PrimeReactProvider>
  </React.StrictMode>,
)
