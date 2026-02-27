import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { addLocale } from 'primereact/api'
import { ProgressSpinner } from 'primereact/progressspinner'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { AnimatePresence } from 'framer-motion'

import Header from './components/Header'
import Footer from './components/Footer'

import HomePage from './pages/HomePage'
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
import AdminPage from './pages/AdminPage'

import OneSignal from 'react-onesignal'

addLocale('es', {
  firstDayOfWeek: 1,
  dayNames: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
  monthNames: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  monthNamesShort: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
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
        <Route path='/' element={<HomePage />} />
        <Route path='/mapa' element={<MapPage session={session} />} />
        <Route path='/eventos' element={<EventsPage session={session} />} />
        <Route path='/eventos/:provincia' element={<EventsPage session={session} />} />
        <Route path='/comunidad' element={<CommunityPage />} />
        <Route path='/contacto' element={<ContactPage />} />

        <Route path='/garaje' element={session ? <GaragePage session={session} /> : <Navigate to='/login' state={{ returnUrl: '/garaje' }} />} />
        <Route path='/perfil' element={session ? <ProfilePage session={session} /> : <Navigate to='/login' state={{ returnUrl: '/perfil' }} />} />
        <Route path='/usuario/:username' element={<PublicProfile />} />
        <Route path='/login' element={<AuthPage session={session} />} />
        <Route path='/evento/:id' element={<EventDetailPage session={session} />} />
        <Route path='/crew/:crewName' element={<CrewDetailPage session={session} />} />
        <Route path='/admin' element={session ? <AdminPage session={session} /> : <Navigate to='/login' state={{ returnUrl: '/admin' }} />} />
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isInitialized = false

    const setupApp = async () => {
      try {
        // 1. Cargamos sesión de Supabase
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        setSession(currentSession)

        // 2. Inicializamos OneSignal SIN bloquear la carga de la app si falla
        if (!isInitialized && !OneSignal.initialized) {
          try {
            await OneSignal.init({
              appId: "47ff2ef2-cd67-40c7-9c3c-ba31d7c86f22",
              allowLocalhostAsSecureOrigin: true,
              notifyButton: { enable: false },
            })
            isInitialized = true
            
            if (currentSession?.user?.id) {
              await OneSignal.login(currentSession.user.id)
            }
          } catch (osError) {
            console.warn("OneSignal Warning:", osError.message)
          }
        }
      } catch (err) {
        console.error("Error cargando la aplicación:", err)
      } finally {
        // MUY IMPORTANTE: Siempre quitamos la pantalla de carga, pase lo que pase
        setLoading(false)
      }
    }

    setupApp()

    // Escuchador de cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user?.id && OneSignal.initialized) {
        OneSignal.login(session.user.id)
      } else if (!session && OneSignal.initialized) {
        OneSignal.logout()
      }
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
