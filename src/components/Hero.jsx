import React, { useState, useEffect } from 'react'
import { Button } from 'primereact/button'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient' // <--- IMPORTANTE: Importamos Supabase

const Hero = () => {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)

  // COMPROBACIÓN INTERNA DE SESIÓN
  // Esto asegura que el botón cambie aunque no le pases props desde el padre
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Escuchar cambios (por si se loguea en otra pestaña o algo cambia)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Lógica del botón principal
  const handleHeroAction = () => {
    if (session) {
      navigate('/mapa')
    } else {
      navigate('/login')
    }
  }

  return (
    <main
      className='hero-bg flex flex-column align-items-center justify-content-center text-center relative'
      style={{ minHeight: '85vh' }}
    >
      <div
        className='hero-content z-1 p-4 w-full'
        style={{ maxWidth: '900px' }}
      >
        <h1
          className='text-5xl md:text-6xl font-bold mb-3 text-white'
          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
        >
          LA CARRETERA TE LLAMA
        </h1>

        <p
          className='text-xl text-white mb-6 line-height-3 font-medium'
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
        >
          Únete a la mayor comunidad de motor en España. Localiza KDDs, gestiona
          tu garaje y conecta con otros apasionados.
        </p>

        <div className='flex flex-column md:flex-row justify-content-center gap-3 w-full md:w-auto'>
          {/* BOTÓN INTELIGENTE */}
          <Button
            label={session ? 'Explorar Mapa' : 'Unirse a la Comunidad'}
            icon={session ? 'pi pi-map' : 'pi pi-user-plus'}
            size='large'
            onClick={handleHeroAction}
            className='p-button-raised p-button-text bg-white text-blue-600 border-white hover:bg-blue-50 w-full md:w-auto font-bold'
          />

          {/* BOTÓN EVENTOS */}
          <Button
            label='Ver Eventos'
            icon='pi pi-calendar'
            size='large'
            outlined
            className='text-white border-white hover:bg-white-alpha-10 w-full md:w-auto'
            onClick={() => navigate('/eventos')}
          />
        </div>
      </div>
    </main>
  )
}

export default Hero
