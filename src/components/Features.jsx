import React from 'react'
import { motion } from 'framer-motion'
import {
  Map,
  CarFront,
  BellRing,
  Navigation,
  Camera,
  CalendarClock,
  Zap,
} from 'lucide-react'
import { Tag } from 'primereact/tag'
import './Home.css'

const MotionDiv = motion.div

const Features = () => {
  const containerVars = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.2 } },
  }

  const itemVars = {
    hidden: { opacity: 0, y: 50 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 250, damping: 24 },
    },
  }

  return (
    <section id='features' className='py-8 px-4 relative z-10'>
      <div className='max-w-7xl mx-auto'>
        {/* Cabecera de la sección */}
        <div className='text-center mb-7'>
          <div className='inline-flex align-items-center justify-content-center gap-2 bg-blue-100 text-blue-700 font-black border-round-3xl px-4 py-2 mb-4 uppercase tracking-widest text-sm shadow-1'>
            <Zap size={16} className='text-blue-600' />
            <span>Funcionalidades TOP</span>
          </div>
          <h3 className='text-5xl md:text-7xl font-black text-900 mb-4 tracking-tighter'>
            Lleva tu pasión al <br className='hidden md:block' />
            <span
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #ec4899 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              siguiente nivel
            </span>
          </h3>
          <p className='text-600 text-xl md:text-2xl font-medium max-w-4xl mx-auto line-height-4'>
            Olvida los foros anticuados. Descubre rutas en un mapa interactivo,
            organiza quedadas épicas y presume de tu máquina con el garaje más
            espectacular.
          </p>
        </div>

        {/* BENTO GRID */}
        <MotionDiv
          variants={containerVars}
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, margin: '-100px' }}
          className='grid'
        >
          {/* Feature 1: Bento Azul Vibrante (Radar) */}
          <MotionDiv variants={itemVars} className='col-12 lg:col-7 p-3'>
            <div className='bento-card bento-blue relative group'>
              {/* Brillo decorativo de fondo */}
              <div className='absolute top-0 right-0 -mr-8 -mt-8 w-20rem h-20rem bg-white border-circle opacity-10 blur-3xl group-hover:opacity-20 transition-opacity duration-500 pointer-events-none'></div>

              <div className='relative z-1 p-5 md:p-6 flex flex-column h-full justify-content-between'>
                <div>
                  <div className='glass-icon-box'>
                    <Map size={36} strokeWidth={2.5} />
                  </div>
                  <h4 className='text-4xl md:text-5xl font-black text-white mb-3 tracking-tight'>
                    Radar de KDDs
                  </h4>
                  <p className='text-white-alpha-80 text-xl line-height-4 font-medium max-w-28rem m-0'>
                    Geolocalización en vivo. Filtra el mapa por estilos como{' '}
                    <span className='font-bold text-white'>
                      Stance, JDM, Clásicos u Off-road
                    </span>{' '}
                    y arranca el motor.
                  </p>
                </div>

                {/* Etiquetas decorativas */}
                <div className='mt-6 flex flex-wrap gap-3'>
                  <div className='glass-tag-feature flex align-items-center gap-2'>
                    <Navigation size={18} /> API Waze
                  </div>
                  <div className='glass-tag-feature flex align-items-center gap-2'>
                    <Map size={18} /> Google Maps
                  </div>
                </div>
              </div>
            </div>
          </MotionDiv>

          {/* Feature 2: Bento Naranja/Fuego (Alertas) */}
          <MotionDiv variants={itemVars} className='col-12 lg:col-5 p-3'>
            <div className='bento-card bento-orange relative group flex flex-column'>
              <div className='absolute bottom-0 left-0 w-full h-20rem bg-white border-circle opacity-10 blur-3xl translate-y-50 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none'></div>

              <div className='relative z-1 p-5 md:p-6 flex flex-column flex-1'>
                <div className='glass-icon-box'>
                  <BellRing size={36} strokeWidth={2.5} />
                </div>
                <h4 className='text-4xl md:text-5xl font-black text-white mb-3 tracking-tight'>
                  Alertas Push
                </h4>
                <p className='text-white-alpha-90 text-xl line-height-4 font-medium mb-6'>
                  Sincronización instantánea con el calendario de tu móvil.
                  Recibe avisos y no te pierdas ni una ruta.
                </p>

                {/* Mockup de Notificación */}
                <div className='mt-auto bg-black-alpha-30 backdrop-blur-md border-round-3xl p-4 flex align-items-center justify-content-between border-1 border-white-alpha-20 shadow-4'>
                  <div className='flex align-items-center gap-4'>
                    <div className='w-3rem h-3rem bg-orange-500 text-white border-circle flex align-items-center justify-content-center shadow-2'>
                      <CalendarClock size={20} strokeWidth={3} />
                    </div>
                    <div>
                      <div className='text-white font-black text-lg'>
                        Ruta Nocturna
                      </div>
                      <div className='text-white-alpha-70 font-medium text-sm mt-1'>
                        Añadido al Calendario
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </MotionDiv>

          {/* Feature 3: Bento Ancho Completo Oscuro (Garaje) con Fotos Reales */}
          <MotionDiv variants={itemVars} className='col-12 p-3'>
            <div className='bento-card bento-dark relative group overflow-visible lg:overflow-hidden'>
              {/* Fondo abstracto */}
              <div className='absolute top-50 left-50 translate-middle w-40rem h-40rem bg-blue-600 border-circle opacity-20 blur-3xl group-hover:scale-110 transition-transform duration-1000 pointer-events-none'></div>

              <div className='relative z-1 p-5 md:p-7 flex flex-column lg:flex-row align-items-center gap-6 lg:gap-8'>
                {/* Texto */}
                <div className='flex-1 w-full lg:w-auto z-2'>
                  <div className='glass-icon-box'>
                    <CarFront size={36} strokeWidth={2.5} />
                  </div>
                  <h4 className='text-4xl md:text-6xl font-black text-white mb-4 tracking-tight'>
                    Garaje Virtual
                  </h4>
                  <p className='text-gray-300 text-xl md:text-2xl line-height-4 font-medium max-w-30rem m-0'>
                    La ficha técnica definitiva para tu coche. Registra tus{' '}
                    <span className='font-bold text-white'>
                      modificaciones, stage de motor y setup de chasis
                    </span>
                    . Sube la galería perfecta.
                  </p>
                </div>

                {/* Espacio interactivo / Mockup de fotos Reales */}
                <div className='flex-1 w-full relative h-20rem md:h-25rem bg-white-alpha-10 border-round-3xl border-2 border-white-alpha-20 flex align-items-center justify-content-center overflow-hidden backdrop-blur-sm mt-5 lg:mt-0'>
                  {/* Fake Photo 1 (JDM) */}
                  <div
                    className='mockup-img-card left-card absolute w-16rem h-20rem border-round-3xl overflow-hidden z-2 transform rotate-6 ml-4 left-0 md:left-auto md:ml-0'
                    style={{ transformOrigin: 'bottom left' }}
                  >
                    <img
                      src='https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?auto=format&fit=crop&w=600&q=80'
                      alt='JDM Car'
                      className='w-full h-full object-cover'
                    />
                  </div>

                  {/* Fake Photo 2 (Euro/Stance) */}
                  <div
                    className='mockup-img-card right-card absolute w-16rem h-20rem border-round-3xl overflow-hidden z-1 transform -rotate-12 mr-4 right-0 md:right-auto md:mr-0 mt-6'
                    style={{ transformOrigin: 'bottom right' }}
                  >
                    <img
                      src='https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?auto=format&fit=crop&w=600&q=80'
                      alt='Euro Car'
                      className='w-full h-full object-cover'
                    />
                  </div>
                </div>
              </div>
            </div>
          </MotionDiv>
        </MotionDiv>
      </div>
    </section>
  )
}

export default Features
