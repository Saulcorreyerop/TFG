import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { Button } from 'primereact/button'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import { motion } from 'framer-motion'
import { MapPin, Navigation, Radio } from 'lucide-react'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import './Home.css'

const MotionDiv = motion.div

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

const HomeMap = () => {
  const navigate = useNavigate()
  const [eventos, setEventos] = useState([])

  const fetchEventos = async () => {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('fecha', now)

    if (!error && data) {
      const eventosFormateados = data.map((ev) => ({
        ...ev,
        fecha: new Date(ev.fecha),
      }))
      setEventos(eventosFormateados)
    }
  }

  useEffect(() => {
    fetchEventos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const centerSpain = [40.4637, -3.7492]

  const containerVars = {
    hidden: { opacity: 0, y: 40 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
    },
  }

  return (
    <section className='py-8 px-4 md:px-6 relative z-10'>
      <div className='max-w-7xl mx-auto mt-4'>
        <MotionDiv
          variants={containerVars}
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, margin: '-100px' }}
        >
          {/* CABECERA CENTRADA REDISEÑADA */}
          <div className='flex flex-column align-items-center text-center mb-6'>
            <div className='inline-flex align-items-center gap-2 bg-red-50 text-red-500 font-black border-round-3xl px-4 py-2 mb-3 uppercase tracking-widest text-sm shadow-1 border-1 border-red-100 mt-2'>
              <Radio size={18} className='pulse-soft' />
              <span>Radar en Vivo</span>
            </div>

            <h2 className='text-5xl md:text-7xl font-black text-900 m-0 mb-4 tracking-tighter'>
              Eventos en <span className='text-gradient'>Tiempo Real</span>
            </h2>

            <p className='text-600 text-xl md:text-2xl font-medium m-0 max-w-4xl line-height-3'>
              Descubre las rutas, KDDs y concentraciones que están ocurriendo
              ahora mismo en toda España. Únete a la acción.
            </p>
          </div>

          {/* CONTENEDOR BENTO DEL MAPA */}
          <div className='bento-card bg-white p-2 md:p-3 relative overflow-hidden group mt-5'>
            {/* Brillo decorativo */}
            <div className='absolute top-50 left-50 translate-middle w-40rem h-40rem bg-blue-400 border-circle opacity-10 blur-3xl pointer-events-none z-0 transition-transform duration-1000 group-hover:scale-110'></div>

            <div
              className='relative z-1 border-round-3xl overflow-hidden shadow-2 border-2 border-gray-100'
              style={{ height: '600px', width: '100%' }}
            >
              {/* Etiqueta Flotante sobre el mapa APLICANDO fichar-dark-badge */}
              <div className='absolute top-0 left-0 p-4 z-5 pointer-events-none w-full flex justify-content-between'>
                <div className='fichar-dark-badge font-bold border-round-2xl px-4 py-3 shadow-4 flex align-items-center gap-3'>
                  <div className='w-2rem h-2rem bg-blue-500 border-circle flex align-items-center justify-content-center'>
                    <MapPin size={16} className='text-white' />
                  </div>
                  <span className='text-lg'>
                    {eventos.length} Eventos localizados
                  </span>
                </div>
              </div>

              {/* Degradado inferior perfeccionado para el botón */}
              <div
                className='absolute bottom-0 left-0 w-full z-5 p-5 flex justify-content-center align-items-end map-gradient-overlay'
                style={{ height: '280px', pointerEvents: 'none' }}
              >
                <div
                  style={{ pointerEvents: 'auto' }}
                  className='flex flex-column align-items-center gap-3 transform -translate-y-4'
                >
                  {/* Etiqueta Mapa Interactivo APLICANDO fichar-dark-badge */}
                  <span className='fichar-dark-badge font-black uppercase tracking-widest text-xs px-4 py-2 border-round-3xl shadow-3'>
                    Mapa Interactivo
                  </span>
                  <Button
                    label='Abrir Mapa Completo'
                    icon={<Navigation size={22} className='mr-2' />}
                    className='btn-fichar-primary px-7 py-4 shadow-4 text-xl'
                    onClick={() => navigate('/mapa')}
                  />
                </div>
              </div>

              {/* El Mapa con OpenStreetMap estándar (En Español) y filtro CSS */}
              <MapContainer
                center={centerSpain}
                zoom={6}
                style={{ height: '100%', width: '100%', zIndex: 1 }}
                dragging={false}
                zoomControl={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                touchZoom={false}
                keyboard={false}
                boxZoom={false}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                  className='map-tiles-premium'
                />

                {eventos.map((ev) => (
                  <Marker key={ev.id} position={[ev.lat, ev.lng]}>
                    <Popup className='border-round-2xl shadow-3 border-none p-0 overflow-hidden'>
                      <div className='text-center p-3'>
                        <h4 className='font-black m-0 text-gray-900 text-xl mb-2 line-height-2'>
                          {ev.titulo}
                        </h4>
                        <span className='bg-blue-50 text-blue-600 px-3 py-1 border-round-2xl text-xs font-black uppercase tracking-widest inline-block mb-3 border-1 border-blue-100'>
                          {ev.tipo}
                        </span>
                        <div className='flex align-items-center justify-content-center gap-2 text-sm m-0 text-500 font-medium bg-gray-50 p-2 border-round-xl'>
                          <i className='pi pi-calendar'></i>
                          {ev.fecha.toLocaleDateString()}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </MotionDiv>
      </div>
    </section>
  )
}

export default HomeMap
