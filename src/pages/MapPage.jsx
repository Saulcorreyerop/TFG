import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from 'react-leaflet'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import { Tag } from 'primereact/tag'
import { useNavigate } from 'react-router-dom'
import { addLocale } from 'primereact/api'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

import AddEventDialog from '../components/AddEventDialog'

// --- CONFIGURACIÓN LEAFLET ---
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
  popupAnchor: [1, -34],
})
L.Marker.prototype.options.icon = DefaultIcon

// --- COMPONENTES AUXILIARES ---

function MapController({ selectedEvent }) {
  const map = useMap()

  useEffect(() => {
    if (selectedEvent && selectedEvent.lat && selectedEvent.lng) {
      const targetLat = parseFloat(selectedEvent.lat)
      const targetLng = parseFloat(selectedEvent.lng)

      if (!isNaN(targetLat) && !isNaN(targetLng)) {
        map.flyTo([targetLat, targetLng], 15, {
          animate: true,
          duration: 1.5,
        })
      }
    }
    // Forzamos un ajuste de tamaño al cargar por si el contenedor cambió
    map.invalidateSize()
  }, [selectedEvent, map])

  return null
}

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

// --- COMPONENTE PRINCIPAL ---
const MapPage = ({ session }) => {
  const navigate = useNavigate()
  const toast = useRef(null)

  const [eventos, setEventos] = useState([])
  const [dialogVisible, setDialogVisible] = useState(false)
  const [posicionTemp, setPosicionTemp] = useState({ lat: null, lng: null })
  const [selectedEvent, setSelectedEvent] = useState(null)

  const fetchEventos = async () => {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('events')
      .select('*, profiles(username)')
      .gte('fecha', now)
      .order('fecha', { ascending: true })

    if (!error && data) {
      const eventosFormateados = data.map((ev) => ({
        ...ev,
        lat: parseFloat(ev.lat),
        lng: parseFloat(ev.lng),
        fecha: new Date(ev.fecha),
        fechaCorta: new Date(ev.fecha).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
        }),
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
    // Usamos style inline para asegurar la altura correcta descontando el header.
    // Si tienes un footer grande, aumenta los '70px' a algo como '120px'.
    <div
      className='flex flex-row w-full overflow-hidden surface-ground'
      style={{ height: 'calc(100vh - 70px)' }}
    >
      <Toast ref={toast} position='top-center' className='mt-6 z-5' />

      {/* Forzamos height 100% en el contenedor de Leaflet con CSS puro */}
      <style>{`
        .leaflet-container {
          height: 100% !important;
          width: 100% !important;
        }
      `}</style>

      {/* 1. SECCIÓN IZQUIERDA (MAPA) */}
      {/* Añadido 'flex flex-col' para asegurar que los hijos llenen el alto */}
      <div className='flex-1 flex flex-col relative h-full z-0'>
        <MapContainer
          center={centerSpain}
          zoom={6}
          minZoom={5}
          maxBounds={spainBounds}
          // Quitamos el style inline de height aquí porque ya lo forzamos con la clase CSS arriba
          // y el contenedor padre flex se encarga del resto
          zoomControl={false}
          className='flex-grow-1 h-full w-full'
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          />

          <MapController selectedEvent={selectedEvent} />

          <LocationMarker
            setPosicionTemp={setPosicionTemp}
            setDialogVisible={setDialogVisible}
            session={session}
            toast={toast}
          />

          {eventos.map((ev) => (
            <Marker
              key={ev.id}
              position={[ev.lat, ev.lng]}
              opacity={selectedEvent?.id === ev.id ? 1 : 0.8}
            >
              <Popup>
                <div className='text-center' style={{ maxWidth: '200px' }}>
                  {ev.image_url && (
                    <img
                      src={ev.image_url}
                      alt='Evento'
                      className='w-full border-round mb-2 shadow-2'
                      style={{ height: '120px', objectFit: 'cover' }}
                    />
                  )}
                  <h3 className='font-bold text-lg m-0 text-gray-900'>
                    {ev.titulo}
                  </h3>
                  <Tag value={ev.tipo} severity='info' className='my-2' />
                  <p className='m-0 text-xs text-gray-600'>
                    {ev.fecha.toLocaleDateString('es-ES')} -{' '}
                    {ev.fecha.toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className='text-xs text-500 mt-1 italic'>
                    Por: {ev.profiles?.username || 'Anónimo'}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {!session && (
          <div className='absolute top-0 right-0 m-4 z-5'>
            <Button
              label='Iniciar Sesión'
              icon='pi pi-user'
              severity='warning'
              raised
              onClick={() => navigate('/login')}
            />
          </div>
        )}
      </div>

      {/* 2. BARRA LATERAL (Derecha) */}
      <aside
        className='w-26rem bg-white shadow-4 flex flex-column z-2 h-full border-left-1 border-200'
        style={{ minWidth: '350px' }}
      >
        <div className='p-4 bg-white border-bottom-1 border-100 flex-none'>
          <h1 className='text-2xl font-extrabold m-0 text-900 tracking-tight'>
            Mapa en Vivo
          </h1>
          <p className='text-600 m-0 mt-1 text-sm'>
            {eventos.length} eventos próximos disponibles
          </p>
        </div>

        <div className='flex-1 overflow-y-auto p-4 flex flex-column gap-4'>
          {/* AVISO E INSTRUCCIONES */}
          <div className='surface-ground p-4 border-round-xl border-left-3 border-blue-500 shadow-1 flex-none'>
            <div className='flex align-items-center gap-2 text-900 font-semibold text-lg mb-2'>
              <i className='pi pi-map-marker text-blue-600 text-xl' />
              <span>Añadir nuevo evento</span>
            </div>

            <p className='m-0 line-height-3 text-700 text-sm mb-3'>
              Navega por el mapa, haz zoom en la zona exacta y
              <span className='font-bold text-900'>
                {' '}
                haz click sobre el lugar{' '}
              </span>
              donde comenzará el evento para crearlo.
            </p>

            <p className='m-0 line-height-3 text-700 text-sm mb-3'>
              - También puedes utilizar el
              <span className='font-bold text-900'> botón de abajo </span>
              para añadirlo de una manera mas sencilla.
            </p>

            <div className='surface-0 p-3 border-round-md flex align-items-start gap-2 text-xs text-600 border-1 border-200'>
              <i className='pi pi-info-circle mt-1 text-blue-500' />
              <span>
                <strong>Nota:</strong> Una vez que la fecha y hora del evento
                hayan pasado, este dejará de mostrarse automáticamente en el
                mapa.
              </span>
            </div>
          </div>

          {session ? (
            <Button
              label='Agregar Evento por Dirección'
              icon='pi pi-plus'
              className='w-full p-button-outlined shadow-1 flex-none'
              onClick={handleOpenModalButton}
            />
          ) : (
            <div className='flex align-items-center gap-2 text-orange-600 surface-50 p-3 border-round border-1 border-orange-100 flex-none'>
              <i className='pi pi-lock' />
              <span className='font-medium text-sm'>
                Inicia sesión para poder publicar tus propios eventos.
              </span>
            </div>
          )}

          {/* LISTA DE EVENTOS */}
          <div className='flex flex-column gap-3 mt-2 pb-4'>
            <h3 className='text-900 font-bold m-0 text-lg'>Próximos Eventos</h3>

            {eventos.length === 0 && (
              <div className='text-center p-4 text-600 bg-gray-50 border-round'>
                No hay eventos próximos.
              </div>
            )}

            {eventos.map((ev) => (
              <div
                key={ev.id}
                onClick={() => setSelectedEvent(ev)}
                className={`
                    surface-card p-3 shadow-1 border-round-xl cursor-pointer 
                    transition-all hover:shadow-3 border-left-4 flex gap-3 align-items-center
                    ${selectedEvent?.id === ev.id ? 'border-blue-500 surface-50' : 'border-transparent'}
                 `}
              >
                <div className='w-4rem h-4rem border-round overflow-hidden flex-none shadow-1'>
                  <img
                    src={ev.image_url || 'https://via.placeholder.com/150'}
                    alt='mini'
                    className='w-full h-full object-cover'
                  />
                </div>

                <div className='flex-grow-1 overflow-hidden'>
                  <h4 className='m-0 text-900 font-bold text-sm mb-1 white-space-nowrap overflow-hidden text-overflow-ellipsis'>
                    {ev.titulo}
                  </h4>
                  <div className='flex align-items-center gap-2 mb-1'>
                    <Tag
                      value={ev.tipo}
                      severity='info'
                      style={{ fontSize: '0.65rem', padding: '2px 4px' }}
                    />
                    <span className='text-600 text-xs font-semibold'>
                      <i
                        className='pi pi-calendar mr-1'
                        style={{ fontSize: '0.7rem' }}
                      ></i>
                      {ev.fechaCorta}
                    </span>
                  </div>
                </div>

                <i
                  className={`pi pi-chevron-right text-400 ${selectedEvent?.id === ev.id ? 'text-blue-500' : ''}`}
                ></i>
              </div>
            ))}
          </div>
        </div>
      </aside>

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
