import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ArrowRight } from 'lucide-react'

import Hero from '../components/Hero'
import ZonaProvincias from '../components/ZonaProvincias'
import HomeMap from '../components/HomeMap'
import ActivityFeed from '../components/ActivityFeed'
import EventCarousel from '../components/EventCarousel'
import PageTransition from '../components/PageTransition'
import SEO from '../components/SEO'

/*
 * Portada.
 *
 * La sesión llega por props desde App, que ya la tiene y la mantiene
 * actualizada. Antes esta página abría su propia suscripción a
 * onAuthStateChange y Hero abría otra, con lo que había tres escuchas
 * distintas de lo mismo en la misma pantalla.
 */

const HomePage = ({ session }) => {
  const navigate = useNavigate()
  const [estadisticas, setEstadisticas] = useState(null)

  useEffect(() => {
    let activo = true

    const cargarEstadisticas = async () => {
      const ahora = new Date().toISOString()

      // head: true trae solo el recuento, sin ninguna fila
      const [eventos, vehiculos, pilotos] = await Promise.all([
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .gte('fecha', ahora),
        supabase.from('vehicles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ])

      if (!activo) return

      setEstadisticas({
        eventos: eventos.count ?? 0,
        vehiculos: vehiculos.count ?? 0,
        pilotos: pilotos.count ?? 0,
      })
    }

    cargarEstadisticas()
    return () => {
      activo = false
    }
  }, [])

  return (
    <>
      <SEO
        title='Inicio'
        description='La comunidad del motor en España. Encuentra concentraciones y rutas cerca de ti, monta tu garaje virtual y conecta con miles de aficionados.'
        url={window.location.href}
      />
      <PageTransition>
        <div className='portada'>
          <Hero session={session} estadisticas={estadisticas} />
          <ZonaProvincias />
          <HomeMap session={session} />
          <ActivityFeed />
          <EventCarousel session={session} />

          {/* Llamada final */}
          <section className='cta-final'>
            <div className='cta-caja franja-librea'>
              <div className='cta-texto'>
                <span className='rotulo'>La parrilla te espera</span>
                <h2 className='cta-titular'>
                  ¿Listo para <span className='cta-acento'>rodar</span>?
                </h2>
                <p className='cta-entradilla'>
                  Crea tu perfil, sube tu proyecto al garaje y encuentra la
                  próxima quedada en tu provincia.
                </p>
              </div>

              <button
                type='button'
                className='btn-librea cta-boton'
                onClick={() =>
                  session
                    ? navigate('/eventos')
                    : navigate('/login', { state: { activeIndex: 1 } })
                }
              >
                {session ? 'Explorar eventos' : 'Crear cuenta gratis'}
                <ArrowRight size={20} />
              </button>
            </div>
          </section>
        </div>
      </PageTransition>
    </>
  )
}

export default HomePage
