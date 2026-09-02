import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { motion } from 'framer-motion'
import { Navigation, Lock, Radio } from 'lucide-react'
import { supabase } from '../supabaseClient'
import './HomeMap.css'

const MotionDiv = motion.div

/*
 * Radar de la portada.
 *
 * Cambios respecto a la versión anterior:
 *   · El mapa era una foto: dragging, zoom, teclado y rueda estaban todos
 *     desactivados. Ahora se puede mover y hacer zoom con los botones. La
 *     rueda sigue desactivada a propósito, para no secuestrar el scroll
 *     de la página cuando pasas por encima.
 *   · En tema oscuro las teselas se invierten por CSS (App.css). Se probo
 *     CARTO y marca las teselas con "API KEY REQUIRED" al hacer zoom.
 *   · El velo inferior ocupaba 280px de un mapa de 600: casi la mitad del
 *     contenido tapado por un botón. Ahora la barra va arriba y es fina.
 *   · La sesión llega por props; antes pedía la suya con getSession.
 *
 * El filtrado de eventos privados se mantiene igual: es el mismo criterio
 * que aplica la política RLS events_select_visibilidad en el servidor.
 */

/*
 * Teselas de OpenStreetMap, sin clave. CARTO empezó a marcar las suyas
 * con "API KEY REQUIRED" a partir de cierto zoom, así que se descartan.
 * El aspecto oscuro se consigue con un filtro CSS sobre el panel de
 * teselas (ver App.css), que no toca marcadores ni bocadillos.
 */
const TESELAS = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}

const CENTRO_ESPANA = [40.4637, -3.7492]

const pin = (esPrivado) => {
  const color = esPrivado ? 'var(--ambar)' : 'var(--librea)'
  const icono = esPrivado ? 'pi-lock' : 'pi-map-marker'

  return L.divIcon({
    className: 'pin-librea',
    html: `
      <div class="pin-cuerpo" style="--pin: ${color}">
        <i class="pi ${icono}"></i>
      </div>
      <div class="pin-punta" style="--pin: ${color}"></div>
    `,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -38],
  })
}

const HomeMap = ({ session }) => {
  const navigate = useNavigate()
  const [eventos, setEventos] = useState([])

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      const ahora = new Date().toISOString()

      let misCrews = []
      if (session?.user?.id) {
        const { data } = await supabase
          .from('crew_members')
          .select('crew_id')
          .eq('user_id', session.user.id)
          .eq('status', 'approved')
        if (data) misCrews = data.map((c) => c.crew_id)
      }

      let consulta = supabase
        .from('events')
        .select('id, titulo, tipo, fecha, lat, lng, is_private')
        .gte('fecha', ahora)
        .not('lat', 'is', null)

      consulta =
        misCrews.length > 0
          ? consulta.or(
              `is_private.is.null,is_private.eq.false,crew_id.in.(${misCrews.join(',')})`,
            )
          : consulta.or('is_private.is.null,is_private.eq.false')

      const { data, error } = await consulta
      if (!activo || error || !data) return

      setEventos(data.map((ev) => ({ ...ev, fecha: new Date(ev.fecha) })))
    }

    cargar()
    return () => {
      activo = false
    }
  }, [session])


  return (
    <section className='radar'>
      <div className='radar-caja'>
        <header className='radar-cabecera'>
          <div>
            <span className='rotulo'>
              <Radio size={13} className='pulse-soft' aria-hidden='true' />
              Radar
            </span>
            <h2 className='radar-titulo'>Qué se mueve ahora</h2>
          </div>

          <button
            type='button'
            className='btn-librea radar-abrir'
            onClick={() => navigate('/mapa')}
          >
            <Navigation size={18} />
            Abrir mapa completo
          </button>
        </header>

        <MotionDiv
          className='radar-marco'
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
        >
          <div className='radar-barra'>
            <span className='radar-cuenta datos'>
              {String(eventos.length).padStart(2, '0')}
            </span>
            <span className='radar-cuenta-etiqueta'>
              {eventos.length === 1 ? 'evento localizado' : 'eventos localizados'}
            </span>
            <span className='radar-pista'>Arrastra para explorar</span>
          </div>

          <MapContainer
            center={CENTRO_ESPANA}
            zoom={6}
            className='radar-mapa'
            /* La rueda se queda desactivada: si no, al bajar por la página
               el mapa se traga el scroll. El resto sí funciona. */
            scrollWheelZoom={false}
            dragging
            zoomControl
            doubleClickZoom
            touchZoom
          >
            <TileLayer attribution={TESELAS.attribution} url={TESELAS.url} />

            {eventos.map((ev) => (
              <Marker
                key={ev.id}
                position={[ev.lat, ev.lng]}
                icon={pin(ev.is_private)}
              >
                <Popup className='popup-librea'>
                  <div className='popup-cuerpo'>
                    {ev.is_private && (
                      <span className='popup-crew'>
                        <Lock size={11} /> Crew
                      </span>
                    )}
                    <h3 className='popup-titulo'>{ev.titulo}</h3>
                    <div className='popup-meta datos'>
                      {ev.tipo && <span>{ev.tipo}</span>}
                      <span>
                        {ev.fecha.toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    </div>
                    <button
                      type='button'
                      className='popup-boton'
                      onClick={() => navigate(`/evento/${ev.id}`)}
                    >
                      Ver evento
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </MotionDiv>
      </div>
    </section>
  )
}

export default HomeMap
