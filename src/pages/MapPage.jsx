import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
import AddEventDialog from '../components/AddEventDialog'

// --- SUB-COMPONENTES (Para no ensuciar el componente principal) ---

// A. Controla el vuelo del mapa
const MapController = ({ selectedEvent }) => {
  const map = useMap()
  useEffect(() => {
    if (selectedEvent?.lat && selectedEvent?.lng) {
      map.flyTo(
        [parseFloat(selectedEvent.lat), parseFloat(selectedEvent.lng)],
        15,
        { animate: true, duration: 1.5 },
      )
    }
    // Truco para arreglar gris en móviles al redimensionar
    setTimeout(() => map.invalidateSize(), 200)
  }, [selectedEvent, map])
  return null
}

// B. Maneja el click para poner marcador
const LocationMarker = ({ onLocationSelect, session, showToast }) => {
  useMapEvents({
    click(e) {
      if (!session)
        return showToast('warn', 'Acceso', 'Inicia sesión para añadir eventos.')
      onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

// C. La tarjeta visual del evento en la lista lateral
const EventCard = ({ ev, isSelected, onClick }) => (
  <div
    onClick={() => onClick(ev)}
    className={`surface-card p-2 shadow-1 border-round-xl cursor-pointer transition-all hover:shadow-3 border-left-4 flex gap-3 align-items-center ${isSelected ? 'border-blue-500 surface-50' : 'border-transparent'}`}
  >
    <div className='w-3rem h-3rem border-round overflow-hidden flex-none shadow-1'>
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
        <span className='text-600 text-xs font-semibold'>{ev.fechaCorta}</span>
      </div>
    </div>
    <i
      className={`pi pi-chevron-right text-400 ${isSelected ? 'text-blue-500' : ''}`}
    ></i>
  </div>
)

// --- COMPONENTE PRINCIPAL ---
const MapPage = ({ session }) => {
  const navigate = useNavigate()
  const toast = useRef(null)

  // Estados
  const [eventos, setEventos] = useState([])
  const [dialogVisible, setDialogVisible] = useState(false)
  const [posicionTemp, setPosicionTemp] = useState({ lat: null, lng: null })
  const [selectedEvent, setSelectedEvent] = useState(null)

  // Configuración inicial del mapa
  const centerSpain = [40.0, -3.7492]
  const spainBounds = [
    [20.0, -25.0],
    [55.0, 30.0],
  ]

  // Carga de datos
  const fetchEventos = async () => {
    const { data } = await supabase
      .from('events')
      .select('*, profiles(username)')
      .gte('fecha', new Date().toISOString())
      .order('fecha', { ascending: true })

    if (data) {
      setEventos(
        data.map((ev) => ({
          ...ev,
          lat: parseFloat(ev.lat),
          lng: parseFloat(ev.lng),
          fecha: new Date(ev.fecha),
          fechaCorta: new Date(ev.fecha).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
          }),
        })),
      )
    }
  }

  useEffect(() => {
    fetchEventos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showToast = (severity, summary, detail) =>
    toast.current.show({ severity, summary, detail })

  return (
    <div
      className='flex flex-column md:flex-row w-full overflow-hidden surface-ground'
      style={{ height: 'calc(100vh - 70px)' }}
    >
      <Toast ref={toast} position='top-center' className='mt-6 z-5' />

      {/* --- BARRA LATERAL (LISTA) --- */}
      {/* Móvil: order-1 (Arriba), ocupa espacio restante (flex-1). PC: order-2 (Derecha), ancho fijo. */}
      <aside className='order-1 md:order-2 w-full md:w-26rem flex-1 md:flex-none md:h-full flex flex-column bg-white shadow-4 z-2 border-bottom-1 md:border-bottom-0 md:border-left-1 border-200 overflow-hidden'>
        <div className='p-3 md:p-4 bg-white border-bottom-1 border-100 flex-none'>
          <h1 className='text-xl md:text-2xl font-extrabold m-0 text-900 tracking-tight'>
            Mapa en Vivo
          </h1>
          <p className='text-600 m-0 mt-1 text-sm'>
            {eventos.length} eventos próximos
          </p>
        </div>

        <div className='flex-1 overflow-y-auto p-3 md:p-4 flex flex-column gap-3'>
          {/* Tarjeta de Instrucciones */}
          <div className='surface-ground p-3 border-round-xl border-left-3 border-blue-500 shadow-1 flex-none'>
            <div className='flex align-items-center gap-2 text-900 font-semibold text-lg mb-2'>
              <i className='pi pi-map-marker text-blue-600 text-xl' />{' '}
              <span>Añadir nuevo evento</span>
            </div>
            <p className='m-0 line-height-3 text-700 text-sm mb-2'>
              Haz click en el mapa para crear evento.
            </p>
            {session && (
              <Button
                label='Agregar Evento'
                icon='pi pi-plus'
                className='w-full p-button-outlined p-button-sm shadow-1 mt-2'
                onClick={() => {
                  setPosicionTemp({ lat: null, lng: null })
                  setDialogVisible(true)
                }}
              />
            )}
            {!session && (
              <div className='text-orange-600 text-xs mt-2'>
                <i className='pi pi-lock mr-1' />
                Inicia sesión para publicar.
              </div>
            )}
          </div>

          {/* Lista renderizada */}
          <div className='flex flex-column gap-3 pb-2'>
            {eventos.length === 0 && (
              <div className='text-center p-4 text-600 bg-gray-50 border-round'>
                No hay eventos próximos.
              </div>
            )}
            {eventos.map((ev) => (
              <EventCard
                key={ev.id}
                ev={ev}
                isSelected={selectedEvent?.id === ev.id}
                onClick={setSelectedEvent}
              />
            ))}
          </div>
        </div>
      </aside>

      {/* --- MAPA --- */}
      {/* Móvil: order-2 (Abajo), Altura fija 35vh. PC: order-1 (Izquierda), Altura completa. */}
      <div className='order-2 md:order-1 w-full md:flex-1 h-[35vh] md:h-full relative z-0 border-top-1 md:border-top-0 border-200'>
        <MapContainer
          center={centerSpain}
          zoom={6}
          minZoom={5}
          maxBounds={spainBounds}
          zoomControl={false}
          className='h-full w-full'
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          />

          <MapController selectedEvent={selectedEvent} />
          <LocationMarker
            onLocationSelect={(coords) => {
              setPosicionTemp(coords)
              setDialogVisible(true)
            }}
            session={session}
            showToast={showToast}
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
                    {ev.fechaCorta} -{' '}
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
          <div className='absolute top-0 right-0 m-4 z-[400]'>
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

      <AddEventDialog
        visible={dialogVisible}
        onHide={() => setDialogVisible(false)}
        onEventAdded={fetchEventos} // Recargamos lista suavemente
        session={session}
        initialLat={posicionTemp.lat}
        initialLng={posicionTemp.lng}
      />
    </div>
  )
}

export default MapPage
