import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from 'react-leaflet'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Toast } from 'primereact/toast'
import { useNavigate } from 'react-router-dom'
import { addLocale } from 'primereact/api'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import AddEventDialog from '../components/AddEventDialog'

// Configuración Español
addLocale('es', {
  firstDayOfWeek: 1,
  dayNames: [
    'domingo',
    'lunes',
    'martes',
    'miércoles',
    'jueves',
    'viernes',
    'sábado',
  ],
  dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
  monthNames: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
  monthNamesShort: [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ],
  today: 'Hoy',
  clear: 'Limpiar',
})

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

function LocationMarker({ setPosicionTemp, setDialogVisible, session, toast }) {
  useMapEvents({
    click(e) {
      if (!session) {
        toast.current.show({
          severity: 'warn',
          summary: 'Acceso',
          detail: 'Inicia sesión para añadir eventos.',
        })
        return
      }
      setPosicionTemp({ lat: e.latlng.lat, lng: e.latlng.lng })
      setDialogVisible(true)
    },
  })
  return null
}

const MapPage = ({ session }) => {
  const navigate = useNavigate()
  const toast = useRef(null)
  const [eventos, setEventos] = useState([])
  const [dialogVisible, setDialogVisible] = useState(false)
  const [posicionTemp, setPosicionTemp] = useState({ lat: null, lng: null })

  const fetchEventos = async () => {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('events')
      .select('*, profiles(username)')
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

  const handleOpenModalButton = () => {
    if (!session) {
      toast.current.show({
        severity: 'warn',
        summary: 'Acceso',
        detail: 'Inicia sesión para añadir eventos.',
      })
      return
    }
    setPosicionTemp({ lat: null, lng: null })
    setDialogVisible(true)
  }

  const centerSpain = [40.4637, -3.7492]
  const spainBounds = [
    [27.0, -19.0],
    [44.0, 5.0],
  ]

  return (
    <div className='flex flex-column min-h-screen surface-ground'>
      <Toast ref={toast} />
      <div className='p-3 md:p-5 flex-grow-1 flex flex-column gap-3 max-w-7xl mx-auto w-full h-full'>
        {/* CARD SUPERIOR CON TEXTO ORIGINAL */}
        <Card className='shadow-2 border-round-xl surface-card p-0 flex-none'>
          <div className='flex flex-column md:flex-row align-items-start md:align-items-center justify-content-between gap-3'>
            <div className='flex flex-column gap-1'>
              <h1 className='text-3xl font-extrabold m-0 text-900 tracking-tight'>
                Mapa en Vivo
              </h1>

              <div className='text-600 m-0 text-base'>
                {session ? (
                  <div className='flex flex-column gap-3 mt-2'>
                    {/* TEXTO ORIGINAL SIN TOCAR */}
                    <div className='flex align-items-center gap-2 text-900 font-semibold text-lg'>
                      <i className='pi pi-map-marker text-blue-600 text-xl' />
                      <span>Añadir nuevo evento</span>
                    </div>

                    <p className='m-0 line-height-3 text-700'>
                      Navega por el mapa, haz zoom en la zona exacta y
                      <span className='font-bold text-900'>
                        {' '}
                        haz click sobre el lugar{' '}
                      </span>
                      donde comenzará el evento para crearlo.
                    </p>

                    {/* INSTRUCCIÓN EXTRA QUE PEDISTE AÑADIR (sin borrar lo anterior) */}
                    <p className='m-0 line-height-3 text-700'>
                      - También puedes utilizar el
                      <span className='font-bold text-900'>
                        {' '}
                        botón de abajo{' '}
                      </span>
                      para añadirlo de una manera mas sencilla.
                    </p>

                    <div className='surface-100 p-3 border-round-md flex align-items-start gap-2 text-sm text-600'>
                      <i className='pi pi-info-circle mt-1 text-blue-500' />
                      <span>
                        <strong>Nota:</strong> Una vez que la fecha y hora del
                        evento hayan pasado, este dejará de mostrarse
                        automáticamente en el mapa.
                      </span>
                    </div>

                    {/* BOTÓN NUEVO */}
                    <div className='flex justify-content-center mb-2'>
                      <Button
                        label='Agregar Evento por Dirección'
                        icon='pi pi-plus'
                        className='p-button-primary'
                        onClick={handleOpenModalButton}
                      />
                    </div>
                  </div>
                ) : (
                  <div className='flex align-items-center gap-2 mt-2 text-orange-600 surface-50 p-2 border-round'>
                    <i className='pi pi-lock' />
                    <span className='font-medium'>
                      Inicia sesión para poder publicar tus propios eventos.
                    </span>
                  </div>
                )}
              </div>
            </div>
            {!session && (
              <Button
                label='Iniciar Sesión'
                icon='pi pi-user'
                severity='warning'
                onClick={() => navigate('/login')}
              />
            )}
          </div>
        </Card>

        {/* MAPA */}
        <div
          className='flex-grow-1 w-full border-round-xl overflow-hidden shadow-4 border-1 surface-border relative'
          style={{ minHeight: '500px' }}
        >
          <MapContainer
            center={centerSpain}
            zoom={6}
            minZoom={5}
            maxBounds={spainBounds}
            style={{ height: '100%', width: '100%', position: 'absolute' }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />
            {eventos.map((ev) => (
              <Marker key={ev.id} position={[ev.lat, ev.lng]}>
                <Popup>
                  <div className='text-center' style={{ maxWidth: '200px' }}>
                    {ev.image_url && (
                      <img
                        src={ev.image_url}
                        alt='Evento'
                        className='w-full border-round mb-2'
                        style={{ height: '100px', objectFit: 'cover' }}
                      />
                    )}
                    <h3 className='font-bold text-lg m-0 text-gray-900'>
                      {ev.titulo}
                    </h3>
                    <span className='text-blue-600 font-bold text-sm block my-1'>
                      {ev.tipo}
                    </span>
                    <p className='m-0 text-xs text-gray-600'>
                      {ev.fecha.toLocaleDateString('es-ES')} -{' '}
                      {ev.fecha.toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className='text-xs text-500 mt-1'>
                      Por: {ev.profiles?.username || 'Anónimo'}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
            <LocationMarker
              setPosicionTemp={setPosicionTemp}
              setDialogVisible={setDialogVisible}
              session={session}
              toast={toast}
            />
          </MapContainer>
        </div>
      </div>

      <AddEventDialog
        visible={dialogVisible}
        onHide={() => setDialogVisible(false)}
        onEventAdded={fetchEventos}
        session={session}
        initialLat={posicionTemp.lat}
        initialLng={posicionTemp.lng}
      />
    </div>
  )
}

export default MapPage
