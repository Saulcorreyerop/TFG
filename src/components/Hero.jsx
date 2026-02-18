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

  const handleHeroAction = () => {
    if (session) {
      navigate('/mapa')
    } else {
      navigate('/login')
    }
  }

  // Variantes de animación
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }, // Efecto cascada
    },
  }

  const item = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  }

  return (
    <main
      className='hero-bg flex flex-column align-items-center justify-content-center text-center relative overflow-hidden'
      style={{ minHeight: '85vh' }}
    >
      {/* Overlay oscuro para mejorar lectura */}
      <div className='absolute top-0 left-0 w-full h-full bg-black-alpha-40 z-0'></div>

      <motion.div
        className='hero-content z-1 p-4 w-full'
        style={{ maxWidth: '900px' }}
        variants={container}
        initial='hidden'
        animate='show'
      >
        <motion.h1
          className='text-5xl md:text-7xl font-extrabold mb-3 text-white tracking-tight'
          style={{ textShadow: '0 4px 15px rgba(0,0,0,0.6)' }}
          variants={item}
        >
          LA CARRETERA <span className='text-blue-400'>TE LLAMA</span>
        </motion.h1>

        <motion.p
          className='text-xl md:text-2xl text-white mb-6 line-height-3 font-medium opacity-90'
          style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
          variants={item}
        >
          Únete a la mayor comunidad de motor en España. Localiza KDDs, gestiona
          tu garaje y conecta con otros apasionados.
        </motion.p>

        <motion.div
          className='flex flex-column md:flex-row justify-content-center gap-3 w-full md:w-auto'
          variants={item}
        >
          <Button
            label={session ? 'Explorar Mapa' : 'Unirse a la Comunidad'}
            icon={session ? 'pi pi-map' : 'pi pi-user-plus'}
            size='large'
            onClick={handleHeroAction}
            className='p-button-raised bg-white text-blue-900 border-white hover:bg-blue-50 hover:scale-105 transition-transform transition-duration-200 font-bold shadow-4'
          />

          <Button
            label='Ver Eventos'
            icon='pi pi-calendar'
            size='large'
            outlined
            className='text-white border-white hover:bg-white-alpha-20 hover:scale-105 transition-transform transition-duration-200 shadow-2'
            onClick={() => navigate('/eventos')}
          />
        </motion.div>
      </motion.div>
    </main>
  )
}

export default Hero
