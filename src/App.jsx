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

// Configuración de Idioma PrimeReact
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

// Configuración Iconos Leaflet
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
    let isMounted = true

    // 1. CARGAMOS SUPABASE (Esto es rápido y no falla nunca)
    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        if (isMounted) setSession(currentSession)
      } catch (error) {
        console.error("Error de sesión:", error)
      } finally {
        // 🚨 AQUÍ ESTÁ LA MAGIA: Quitamos el spinner INMEDIATAMENTE sin esperar a OneSignal
        if (isMounted) setLoading(false)
      }
    }

    initAuth()

    // 2. CARGAMOS ONESIGNAL EN SEGUNDO PLANO (Silenciosamente)
    const initOneSignalInBackground = async () => {
      if (!OneSignal.initialized) {
        try {
          await OneSignal.init({
            appId: "47ff2ef2-cd67-40c7-9c3c-ba31d7c86f22",
            allowLocalhostAsSecureOrigin: true,
            notifyButton: { enable: false },
          })
          
          // Si el usuario ya estaba logueado, lo vinculamos
          const { data: { session: checkSession } } = await supabase.auth.getSession()
          if (checkSession?.user?.id) {
            OneSignal.login(checkSession.user.id)
          }
        } catch (err) {
          console.warn("OneSignal ignorado en este móvil:", err.message)
        }
      }
    }

    initOneSignalInBackground()

    // 3. ESCUCHADOR DE SESIONES
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (isMounted) setSession(session)
      
      if (OneSignal.initialized) {
        if (session?.user?.id) {
          OneSignal.login(session.user.id)
        } else {
          OneSignal.logout()
        }
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
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

/*import React from 'react'

// ==========================================
// PANTALLA DE MANTENIMIENTO
// ==========================================
function App() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '3rem', color: '#1e293b', margin: '0 0 10px 0' }}>
        🛠️ En Desarrollo
      </h1>
      <p style={{ fontSize: '1.5rem', color: '#64748b', margin: '0' }}>
        CarMeet ESP - Proyecto de Saúl Correyero Pañero.
      </p>
    </div>
  )
}

export default App*/

