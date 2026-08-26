import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Map, CalendarPlus, ArrowRight } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import './Home.css'

const MotionDiv = motion.div

/*
 * Portada.
 *
 * Cambios respecto a la versión anterior:
 *   · Sin redondeo de 48px abajo. La foto llega al borde.
 *   · Sin suscripción propia a Supabase: la sesión llega por props desde
 *     HomePage, que ya la tiene. Antes había tres componentes pidiendo la
 *     sesión por su cuenta en la misma página.
 *   · El titular va en condensada y el rojo se reserva a una palabra.
 *   · Debajo, una franja de datos con cifras tabulares: es lo que da el
 *     aire de telemetría sin necesidad de adornos.
 */

const Hero = ({ session, estadisticas }) => {
  const navigate = useNavigate()
  const { theme } = useTheme()

  const cifras = [
    { valor: estadisticas?.eventos, etiqueta: 'Eventos activos' },
    { valor: estadisticas?.vehiculos, etiqueta: 'Coches en garaje' },
    { valor: estadisticas?.pilotos, etiqueta: 'Pilotos' },
  ]

  return (
    <section className='hero'>
      {/* Fondo */}
      <div className='hero-fondo'>
        <img
          src='https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80'
          alt=''
          aria-hidden='true'
          className='hero-foto'
          fetchPriority='high'
          loading='eager'
          decoding='async'
        />
        <div className='hero-velo' />
        <div className='hero-rayas' aria-hidden='true' />
      </div>

      {/* Contenido */}
      <div className='hero-content'>
        <MotionDiv
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className='hero-rotulo'>
            <span className='hero-punto' aria-hidden='true' />
            La comunidad del motor en España
          </span>
        </MotionDiv>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className='hero-titular'
        >
          Encuentra tu próxima
          <br />
          <span className='hero-acento'>ruta</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.24, duration: 0.6 }}
          className='hero-entradilla'
        >
          Localiza concentraciones cerca de ti, monta tu garaje virtual y
          conecta con gente que lleva el motor igual de dentro que tú.
        </motion.p>

        <MotionDiv
          className='hero-acciones'
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36, duration: 0.6 }}
        >
          <button
            type='button'
            className='btn-librea'
            onClick={() => navigate(session ? '/mapa' : '/login')}
          >
            {session ? <Map size={18} /> : <ArrowRight size={18} />}
            {session ? 'Ver el mapa' : 'Unirme gratis'}
          </button>

          <button
            type='button'
            className='btn-contorno'
            onClick={() => navigate(session ? '/eventos' : '/login')}
          >
            <CalendarPlus size={18} />
            Crear evento
          </button>
        </MotionDiv>
      </div>

      {/* Franja de datos */}
      <MotionDiv
        className='hero-datos'
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        {cifras.map((c) => (
          <div className='hero-dato' key={c.etiqueta}>
            <span className='hero-dato-valor datos'>
              {typeof c.valor === 'number' ? c.valor : '—'}
            </span>
            <span className='hero-dato-etiqueta'>{c.etiqueta}</span>
          </div>
        ))}
        <div className='hero-dato hero-dato-tema'>
          <span className='hero-dato-valor datos'>
            {theme === 'oscuro' ? 'ASFALTO' : 'DÍA'}
          </span>
          <span className='hero-dato-etiqueta'>Modo</span>
        </div>
      </MotionDiv>
    </section>
  )
}

export default Hero
