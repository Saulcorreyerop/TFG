import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Importamos componentes de la Landing Page
import Header from './components/Header'
import Hero from './components/Hero'
import Features from './components/Features'
import EventCarousel from './components/EventCarousel'
import Footer from './components/Footer'

// Importamos la nueva página del mapa
import MapPage from './pages/MapPage'

// Componente "Home" que agrupa la landing page
const Home = () => (
  <>
    <Header />
    <Hero />
    <EventCarousel />
    <Features />
    <Footer />
  </>
)

function App() {
  return (
    <BrowserRouter>
      <div className='app-container'>
        <Routes>
          {/* Ruta Principal */}
          <Route path='/' element={<Home />} />

          {/* Ruta del Mapa */}
          <Route path='/mapa' element={<MapPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
