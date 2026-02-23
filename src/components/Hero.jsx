import React, { useState, useEffect } from 'react'
import { Button } from 'primereact/button'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { motion } from 'framer-motion'
import { Rocket, Map, CalendarPlus } from 'lucide-react'
import './Home.css' // <-- Importamos los nuevos estilos

const MotionDiv = motion.div
const MotionH1 = motion.h1
const MotionP = motion.p

const Hero = () => {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSession(session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <main
      className='flex flex-column align-items-center justify-content-center text-center relative overflow-hidden'
      style={{
        minHeight: '85vh',
        borderBottomLeftRadius: '48px',
        borderBottomRightRadius: '48px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
      }}
    >
      {/* IMAGEN DE FONDO RESPONSIVE CON MÁSCARA */}
      <div className='absolute top-0 left-0 w-full h-full z-0'>
        <img
          src='https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80'
          alt='Fondo CarMeet'
          className='w-full h-full'
          style={{ objectFit: 'cover', filter: 'brightness(0.7)' }}
          fetchPriority='high'
          loading='eager'
          decoding='async'
        />
        {/* Degradado oscuro inferior para integrar mejor con la página */}
        <div
          className='absolute inset-0'
          style={{
            background:
              'linear-gradient(to bottom, rgba(15, 23, 42, 0.4) 0%, #0f172a 100%)',
          }}
        ></div>
      </div>

      {/* CONTENIDO FLOTANTE */}
      <div
        className='hero-content z-1 p-4 w-full relative flex flex-column align-items-center'
        style={{ maxWidth: '1000px' }}
      >
        <MotionDiv
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className='hero-badge'>
            <Rocket size={18} />
            <span>La plataforma Nº1 en España</span>
          </div>
        </MotionDiv>

        <MotionH1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className='text-6xl md:text-8xl font-black mb-4 text-white tracking-tighter line-height-1'
          style={{ textShadow: '0 10px 30px rgba(0,0,0,0.8)' }}
        >
          Encuentra tu próxima <span style={{ color: '#60a5fa' }}>ruta.</span>
        </MotionH1>

        <MotionP
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className='text-xl md:text-2xl text-white-alpha-90 mb-6 line-height-3 font-medium max-w-4xl mx-auto'
        >
          Únete a la mayor comunidad de motor. Localiza concentraciones,
          gestiona tu proyecto en el garaje virtual y conecta con miles de
          apasionados.
        </MotionP>

        <MotionDiv
          className='flex flex-column md:flex-row justify-content-center gap-4 w-full md:w-auto px-4'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            label={session ? 'Explorar Mapa' : 'Unirse a la Comunidad'}
            icon={
              session ? (
                <Map size={20} className='mr-2' />
              ) : (
                <Rocket size={20} className='mr-2' />
              )
            }
            className='btn-fichar-primary w-full md:w-auto'
            onClick={() => navigate(session ? '/mapa' : '/login')}
          />

          <Button
            label='Crear Evento'
            icon={<CalendarPlus size={20} className='mr-2' />}
            className='btn-fichar-outline w-full md:w-auto'
            onClick={() => navigate(session ? '/eventos' : '/login')}
          />
        </MotionDiv>
      </div>
    </main>
  )
}

export default Hero
