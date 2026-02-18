import React, { useState, useEffect, lazy, Suspense } from 'react' // <--- AÑADIDO Suspense
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
import { Helmet } from 'react-helmet-async'
import { AnimatePresence } from 'framer-motion'

// Componentes CRÍTICOS (Se cargan al instante)
import Header from './components/Header'
import Hero from './components/Hero'
import Footer from './components/Footer'
import AnimatedPage from './components/AnimatedPage'

// Componentes NO CRÍTICOS (Lazy Loading - Se cargan después)
const HomeMap = lazy(() => import('./components/HomeMap'))
const Features = lazy(() => import('./components/Features'))
const EventCarousel = lazy(() => import('./components/EventCarousel'))

// Páginas (Las mantenemos importadas normal para evitar parpadeos en navegación simple,
// o podrías hacerlas lazy también si pesan mucho, pero por ahora está bien así)
import MapPage from './pages/MapPage'
import AuthPage from './pages/AuthPage'
import EventsPage from './pages/EventsPage'
import GaragePage from './pages/GaragePage'
import ProfilePage from './pages/ProfilePage'
import PublicProfile from './pages/PublicProfile'
import CommunityPage from './pages/CommunityPage'
import EventDetailPage from './pages/EventDetailPage'

// --- CONFIGURACIÓN ---
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

// --- HOME OPTIMIZADA ---
const Home = ({ session }) => (
  <AnimatedPage>
    <Helmet>
      <title>CarMeet ESP | Eventos y Rutas de Coches en España</title>
      <meta
        name='description'
        content='La mayor comunidad de coches en España. Encuentra eventos, rutas en tiempo real y concentraciones de coches cerca de ti.'
      />
      <link rel='canonical' href='https://carmeetesp.netlify.app/' />
    </Helmet>

    {/* El Hero es Crítico: Se carga normal sin espera */}
    <Hero session={session} />

    {/* El Mapa es Pesado: Lo cargamos con Suspense */}
    <Suspense
      fallback={
        <div className='w-full h-30rem bg-gray-100 flex align-items-center justify-content-center text-gray-500'>
          <i className='pi pi-map mr-2'></i> Cargando mapa...
        </div>
      }
    >
      <HomeMap />
    </Suspense>

    {/* El Carrusel espera su turno */}
    <Suspense fallback={<div className='w-full h-20rem bg-white'></div>}>
      <EventCarousel />
    </Suspense>

    {/* Las Features al final */}
    <Suspense fallback={null}>
      <Features />
    </Suspense>
  </AnimatedPage>
)

// --- RUTAS ANIMADAS ---
const AnimatedRoutes = ({ session }) => {
  const location = useLocation()

  return (
    <AnimatePresence mode='wait'>
      <Routes location={location} key={location.pathname}>
        <Route path='/' element={<Home session={session} />} />
        <Route
          path='/mapa'
          element={
            <AnimatedPage>
              <MapPage session={session} />
            </AnimatedPage>
          }
        />
        <Route
          path='/eventos'
          element={
            <AnimatedPage>
              <EventsPage session={session} />
            </AnimatedPage>
          }
        />
        <Route
          path='/comunidad'
          element={
            <AnimatedPage>
              <CommunityPage />
            </AnimatedPage>
          }
        />
        <Route
          path='/garaje'
          element={
            session ? (
              <AnimatedPage>
                <GaragePage session={session} />
              </AnimatedPage>
            ) : (
              <Navigate to='/login' />
            )
          }
        />
        <Route
          path='/perfil'
          element={
            session ? (
              <AnimatedPage>
                <ProfilePage session={session} />
              </AnimatedPage>
            ) : (
              <Navigate to='/login' />
            )
          }
        />
        <Route
          path='/usuario/:userId'
          element={
            <AnimatedPage>
              <PublicProfile />
            </AnimatedPage>
          }
        />
        <Route
          path='/login'
          element={
            !session ? (
              <AnimatedPage>
                <AuthPage />
              </AnimatedPage>
            ) : (
              <Navigate to='/' />
            )
          }
        />
        <Route
          path='/evento/:id'
          element={
            <AnimatedPage>
              <EventDetailPage session={session} />
            </AnimatedPage>
          }
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
