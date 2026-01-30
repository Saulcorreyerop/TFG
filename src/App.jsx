import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

// --- 1. IMPORTACIONES GLOBALES (Leaflet y PrimeReact) ---
import { addLocale } from 'primereact/api'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

// Componentes
import Header from './components/Header'
import Hero from './components/Hero'
import HomeMap from './components/HomeMap'
import Features from './components/Features'
import EventCarousel from './components/EventCarousel'
import Footer from './components/Footer'

// Páginas
import MapPage from './pages/MapPage'
import AuthPage from './pages/AuthPage'
import EventsPage from './pages/EventsPage'

import { Helmet } from 'react-helmet-async'

// --- 2. CONFIGURACIÓN GLOBAL (Se ejecuta una sola vez) ---
// Configuración de Español para Calendarios
addLocale('es', {
  firstDayOfWeek: 1,
  dayNames: [
    'domingo',
    'lunes',
    'martes',
    'miércoles',
    'jueves',
    'viernes',
    'sábado',
  ],
  dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
  monthNames: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
  monthNamesShort: [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ],
  today: 'Hoy',
  clear: 'Limpiar',
})

// Configuración de Iconos por defecto de Leaflet
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})
L.Marker.prototype.options.icon = DefaultIcon
// ---------------------------------------------------------

const Home = () => (
  <>
    {/* AÑADIR ESTO PARA QUE GOOGLE LEA BIEN LA HOME */}
    <Helmet>
      <title>CarMeetESP | Concentraciones y Eventos de Coches en España</title>
      <meta
        name='description'
        content='La mayor comunidad de eventos de motor en España. Encuentra KDDs, rutas, trackdays y concentraciones de coches cerca de ti en nuestro mapa interactivo.'
      />
      <link rel='canonical' href='https://carmeetesp.netlify.app/' />
    </Helmet>
    {/* ------------------------------------------------ */}

    <Hero />
    <HomeMap />
    <EventCarousel />
    <Features />
  </>
)

function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <div className='flex flex-column min-h-screen'>
        <Header session={session} />
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/mapa' element={<MapPage session={session} />} />
          <Route path='/eventos' element={<EventsPage session={session} />} />
          <Route
            path='/login'
            element={!session ? <AuthPage /> : <Navigate to='/' />}
          />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  )
}

export default App
