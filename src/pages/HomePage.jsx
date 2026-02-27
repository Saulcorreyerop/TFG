import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Zap, ArrowRight } from 'lucide-react'

// Importamos los componentes
import Hero from '../components/Hero'
import Features from '../components/Features'
import HomeMap from '../components/HomeMap'
import EventCarousel from '../components/EventCarousel'
import PageTransition from '../components/PageTransition'

const HomePage = () => {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSession(session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) =>
      setSession(session),
    )
    return () => subscription.unsubscribe()
  }, [])

  return (
    <PageTransition>
      <div className='bg-white'>
        {/* Componentes de la página */}
        <Hero session={session} />
        <Features />
        <HomeMap />
        <EventCarousel />

        {/* --- SECCIÓN CTA FINAL (Estilo Bento Premium) --- */}
        <section className='py-8 md:py-12 px-4 relative z-10 mb-6'>
          <div className='max-w-7xl mx-auto'>
            {/* Reutilizamos la clase bento-dark que sabemos que queda espectacular */}
            <div className='bento-card bento-dark p-6 md:p-8 flex flex-column md:flex-row align-items-center justify-content-between gap-6 relative overflow-hidden'>
              {/* Brillos decorativos abstractos (Cero imágenes externas, puro CSS) */}
              <div className='absolute top-50 left-50 translate-middle w-40rem h-40rem bg-blue-600 border-circle opacity-20 blur-3xl pointer-events-none z-0'></div>
              <div className='absolute top-0 right-0 w-20rem h-20rem bg-purple-600 border-circle opacity-20 blur-3xl pointer-events-none z-0'></div>

              {/* Textos */}
              <div className='text-center md:text-left flex-1 relative z-1'>
                <div className='inline-flex align-items-center gap-2 bg-white-alpha-10 px-3 py-2 border-round-3xl border-1 border-white-alpha-20 mb-4 backdrop-blur-sm'>
                  <Zap size={16} className='text-yellow-400' />
                  <span className='text-white text-xs font-bold uppercase tracking-widest'>
                    La comunidad te espera
                  </span>
                </div>

                <h2 className='text-4xl md:text-6xl font-black text-white m-0 tracking-tighter line-height-1 mb-4'>
                  ¿Estás listo para <br className='hidden lg:block' />
                  {/* Texto con degradado espectacular azul a morado */}
                  <span
                    style={{
                      background:
                        'linear-gradient(135deg, #60a5fa 0%, #c084fc 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    rodar con nosotros?
                  </span>
                </h2>

                {/* Usamos text-400 de PrimeFlex para asegurar que sea un gris clarito y legible */}
                <p className='text-400 text-lg md:text-xl font-medium m-0 max-w-30rem mx-auto md:mx-0 line-height-3'>
                  Únete a miles de conductores. Crea tu perfil, sube tu proyecto
                  al garaje virtual y encuentra la próxima KDD en tu ciudad.
                </p>
              </div>

              {/* Botón Dinámico: Cambia si el usuario está logueado o no */}
              <div className='flex-shrink-0 mt-5 md:mt-0 relative z-1'>
                <button
                  onClick={() =>
                    session
                      ? navigate('/eventos')
                      : navigate('/login', { state: { activeIndex: 1 } })
                  }
                  className='flex align-items-center justify-content-center gap-3 px-6 py-4 border-none font-black text-xl text-white border-round-2xl cursor-pointer shadow-6 transition-transform hover:scale-105 w-full md:w-auto'
                  style={{
                    background:
                      'linear-gradient(135deg, #2563eb 0%, #9333ea 100%)',
                  }}
                >
                  {session ? 'Explorar Eventos' : 'Crear cuenta gratis'}{' '}
                  <ArrowRight size={24} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  )
}

export default HomePage
