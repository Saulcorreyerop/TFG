import React, { useState, useEffect } from 'react'
import { Button } from 'primereact/button'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'

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
    // Quitamos la clase 'hero-bg' y aseguramos 'relative' y 'overflow-hidden'
    <main
      className='flex flex-column align-items-center justify-content-center text-center relative overflow-hidden'
      style={{ minHeight: '85vh' }}
    >
      {/* --- 1. IMAGEN DE FONDO RESPONSIVE --- */}
      <div className='absolute top-0 left-0 w-full h-full z-0'>
        <img
          src='https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80'
          srcSet='
      https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=60 600w,
      https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?ixlib=rb-1.2.1&auto=format&fit=crop&w=1200&q=80 1200w,
      https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80 1950w
    '
          sizes='(max-width: 768px) 100vw, 100vw'
          alt='Fondo CarMeet'
          className='w-full h-full'
          style={{ objectFit: 'cover' }}
          fetchPriority='high'
          loading='eager'
          decoding='async'
        />
        <div className='absolute top-0 left-0 w-full h-full bg-black-alpha-60'></div>
      </div>

      {/* --- 2. CONTENIDO (TEXTO Y BOTONES) --- */}
      {/* Añadimos z-1 para que el texto flote ENCIMA de la imagen */}
      <div
        className='hero-content z-1 p-4 w-full relative'
        style={{ maxWidth: '900px' }}
      >
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className='text-5xl md:text-6xl font-bold mb-3 text-white'
          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
        >
          LA CARRETERA TE LLAMA
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className='text-xl text-white mb-6 line-height-3 font-medium'
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
        >
          Únete a la mayor comunidad de motor en España. Localiza KDDs, gestiona
          tu garaje y conecta con otros apasionados.
        </motion.p>

        <motion.div
          className='flex flex-column md:flex-row justify-content-center gap-3 w-full md:w-auto'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button
            label={session ? 'Explorar Mapa' : 'Unirse a la Comunidad'}
            icon={session ? 'pi pi-map' : 'pi pi-user-plus'}
            size='large'
            onClick={() => navigate(session ? '/mapa' : '/login')}
            className='p-button-raised p-button-text bg-white text-blue-600 border-white hover:bg-blue-50 w-full md:w-auto font-bold'
          />

          <Button
            label='Ver Eventos'
            icon='pi pi-calendar'
            size='large'
            outlined
            className='text-white border-white hover:bg-white-alpha-10 w-full md:w-auto'
            onClick={() => navigate('/eventos')}
          />
        </motion.div>
      </div>
    </main>
  )
}

export default Hero
