import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

// Componentes
import Header from './components/Header'
import Hero from './components/Hero'
import Features from './components/Features'
import EventCarousel from './components/EventCarousel'
import Footer from './components/Footer'

// Páginas
import MapPage from './pages/MapPage'
import AuthPage from './pages/AuthPage'

const Home = () => (
  <>
    <Hero />
    <EventCarousel /> {/* Aquí deben salir las cartas, NO el mapa */}
    <Features />
  </>
)

function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    // Verificamos sesión al cargar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Escuchamos cambios (login/logout)
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
        {/* Pasamos la sesión al Header para cambiar los botones */}
        <Header session={session} />

        <Routes>
          <Route path='/' element={<Home />} />

          {/* ESTA LÍNEA ES LA CLAVE: Pasamos 'session' al Mapa */}
          <Route path='/mapa' element={<MapPage session={session} />} />

          {/* Rutas de autenticación */}
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
