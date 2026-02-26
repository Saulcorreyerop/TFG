import React, { useState, useEffect } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'
import { supabase } from './supabaseClient'
import { addLocale } from 'primereact/api'
import { ProgressSpinner } from 'primereact/progressspinner'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { AnimatePresence } from 'framer-motion'

import Header from './components/Header'
import Footer from './components/Footer'

// Importamos nuestra nueva Landing Page unificada
import HomePage from './pages/HomePage'

// Importamos el resto de páginas
import MapPage from './pages/MapPage'
import AuthPage from './pages/AuthPage'
import EventsPage from './pages/EventsPage'
import GaragePage from './pages/GaragePage'
import ProfilePage from './pages/ProfilePage'
import PublicProfile from './pages/PublicProfile'
import CommunityPage from './pages/CommunityPage'
import EventDetailPage from './pages/EventDetailPage'
import ContactPage from './pages/ContactPage'
import CrewDetailPage from './pages/CrewDetailPage'

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

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})
L.Marker.prototype.options.icon = DefaultIcon

const AnimatedRoutes = ({ session }) => {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <AnimatePresence mode='wait'>
      <Routes location={location} key={location.pathname}>
        {/* Aquí conectamos la ruta raíz (/) a tu nuevo HomePage */}
        <Route path='/' element={<HomePage />} />

        <Route path='/mapa' element={<MapPage session={session} />} />
        <Route path='/eventos' element={<EventsPage session={session} />} />
        <Route
          path='/eventos/:provincia'
          element={<EventsPage session={session} />}
        />
        <Route path='/comunidad' element={<CommunityPage />} />
        <Route path='/contacto' element={<ContactPage />} />

        <Route
          path='/garaje'
          element={
            session ? (
              <GaragePage session={session} />
            ) : (
              <Navigate to='/login' />
            )
          }
        />
        <Route
          path='/perfil'
          element={
            session ? (
              <ProfilePage session={session} />
            ) : (
              <Navigate to='/login' />
            )
          }
        />
        <Route path='/usuario/:username' element={<PublicProfile />} />

        <Route
          path='/login'
          element={!session ? <AuthPage /> : <Navigate to='/' />}
        />

        <Route
          path='/evento/:id'
          element={<EventDetailPage session={session} />}
        />
        <Route
          path='/crew/:crewName'
          element={<CrewDetailPage session={session} />}
        />
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className='flex align-items-center justify-content-center min-h-screen surface-ground'>
        <ProgressSpinner strokeWidth='4' />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className='flex flex-column min-h-screen'>
        <Header session={session} />
        <AnimatedRoutes session={session} />
        <Footer />
      </div>
    </BrowserRouter>
  )
}

export default App
