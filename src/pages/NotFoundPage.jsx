import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Map, CalendarDays, Users, ArrowRight } from 'lucide-react'
import PageTransition from '../components/PageTransition'
import SEO from '../components/SEO'

/*
 * Página 404.
 *
 * Antes no existía ruta comodín: cualquier URL inventada mostraba la
 * cabecera y el pie con la nada en medio, y Google indexaba eso como una
 * página válida (un "soft 404").
 *
 * En vez de un callejón sin salida, se ofrecen los tres destinos a los que
 * de verdad va la gente.
 */

const DESTINOS = [
  { ruta: '/mapa', icono: Map, titulo: 'Mapa', texto: 'Qué se mueve cerca de ti' },
  { ruta: '/eventos', icono: CalendarDays, titulo: 'Eventos', texto: 'Todas las quedadas' },
  { ruta: '/comunidad', icono: Users, titulo: 'Comunidad', texto: 'Crews y pilotos' },
]

const NotFoundPage = () => {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <>
      <SEO
        title='Página no encontrada'
        description='La página que buscas no existe en CarMeet.'
        url={window.location.href}
      />
      <PageTransition>
        <div className='nf'>
          <div className='nf-caja'>
            <span className='nf-codigo datos'>404</span>

            <h1 className='nf-titulo'>Esta salida no existe</h1>

            <p className='nf-texto'>
              La dirección <code className='nf-ruta'>{location.pathname}</code>{' '}
              no lleva a ninguna parte. Puede que el enlace esté mal, o que lo
              que buscabas ya no esté.
            </p>

            <div className='nf-destinos'>
              {DESTINOS.map(({ ruta, icono: Icono, titulo, texto }) => (
                <button
                  key={ruta}
                  type='button'
                  className='nf-destino'
                  onClick={() => navigate(ruta)}
                >
                  <Icono size={20} aria-hidden='true' />
                  <span className='nf-destino-titulo'>{titulo}</span>
                  <span className='nf-destino-texto'>{texto}</span>
                  <ArrowRight size={16} className='nf-destino-flecha' aria-hidden='true' />
                </button>
              ))}
            </div>

            <button
              type='button'
              className='btn-librea'
              onClick={() => navigate('/')}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </PageTransition>
    </>
  )
}

export default NotFoundPage
