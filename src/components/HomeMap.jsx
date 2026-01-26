import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { Button } from 'primereact/button'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'

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

  return (
    <section className='surface-ground py-6 px-4 md:px-6'>
      <div className='text-center mb-5'>
        <h2 className='text-3xl font-bold text-900 mb-2'>
          Eventos en Tiempo Real
        </h2>
        <p className='text-600'>
          Explora lo que está ocurriendo ahora mismo cerca de ti.
        </p>
      </div>

      {/* CAMBIOS AQUÍ:
         1. style={{ height: '750px' }} -> Más alto para que sea vertical.
         2. maxWidth: '500px' -> Limitamos el ancho para forzar la forma de rectángulo vertical.
         3. className='... mx-auto' -> Lo centramos en la pantalla.
      */}
      <div
        className='relative shadow-4 border-round-xl overflow-hidden mx-auto'
        style={{ height: '700px', maxWidth: '1400px', width: '100%' }}
      >
        {/* Botón flotante */}
        <div
          className='absolute bottom-0 left-0 w-full z-5 p-3 flex justify-content-center'
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>
            <Button
              label='Abrir Mapa Completo'
              icon='pi pi-map-marker'
              className='p-button-rounded p-button-raised'
              onClick={() => navigate('/mapa')}
            />
          </div>
        </div>

        <MapContainer
          center={centerSpain}
          zoom={5.5} // Ajustado un poco el zoom para el formato vertical
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          />

          {eventos.map((ev) => (
            <Marker key={ev.id} position={[ev.lat, ev.lng]}>
              <Popup>
                <div className='text-center'>
                  <h4 className='font-bold m-0 text-gray-900'>{ev.titulo}</h4>
                  <span className='text-blue-600 text-xs font-bold block my-1'>
                    {ev.tipo}
                  </span>
                  <p className='text-xs m-0 text-gray-600'>
                    {ev.fecha.toLocaleDateString()}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </section>
  )
}

export default HomeMap
