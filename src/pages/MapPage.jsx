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

// --- SUB-COMPONENTES ---

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
    setTimeout(() => map.invalidateSize(), 300)
  }, [selectedEvent, map])
  return null
}

// B. Marcador
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

// C. Tarjeta de Evento (Lista lateral)
const EventCard = ({ ev, isSelected, onClick }) => (
  <div
    onClick={() => onClick(ev)}
    className='surface-card p-3 shadow-1 border-round-xl cursor-pointer transition-all hover:shadow-3 flex gap-3 align-items-center mb-2 mx-1'
    style={{
      // Borde morado si está seleccionado
      borderLeft: isSelected ? '4px solid #A855F7' : '4px solid transparent',
      backgroundColor: isSelected ? '#FAF5FF' : '#ffffff',
    }}
  >
    <div className='w-4rem h-4rem border-round-lg overflow-hidden flex-none shadow-1 bg-gray-100'>
      <img
        src={ev.image_url || 'https://via.placeholder.com/150'}
        alt='mini'
        className='w-full h-full object-cover'
      />
    </div>

    <div className='flex-grow-1 overflow-hidden min-w-0'>
      <h4 className='m-0 text-900 font-bold text-sm md:text-base mb-1 white-space-nowrap overflow-hidden text-overflow-ellipsis'>
        {ev.titulo}
      </h4>
      <div className='flex align-items-center gap-2 flex-wrap'>
        <Tag
          value={ev.tipo}
          severity='info'
          style={{ fontSize: '0.6rem', padding: '2px 4px' }}
        />
        <span className='text-600 text-xs font-semibold white-space-nowrap'>
          <i className='pi pi-calendar mr-1 text-xs'></i>
          {ev.fechaCorta}
        </span>
      </div>
    </div>

    <div className='flex-none'>
      <Button
        icon='pi pi-chevron-right'
        rounded
        text
        size='small'
        className='text-400'
      />
    </div>
  </div>
)

// --- COMPONENTE PRINCIPAL ---
const MapPage = ({ session }) => {
  const navigate = useNavigate()
  const toast = useRef(null)

  const [eventos, setEventos] = useState([])
  const [dialogVisible, setDialogVisible] = useState(false)
  const [posicionTemp, setPosicionTemp] = useState({ lat: null, lng: null })
  const [selectedEvent, setSelectedEvent] = useState(null)

  const centerSpain = [40.0, -3.7492]
  const spainBounds = [
    [20.0, -25.0],
    [55.0, 30.0],
  ]

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
          fecha: new Date(ev.fecha), // Objeto Date para el popup
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

  const handleAddClick = () => {
    setPosicionTemp({ lat: null, lng: null })
    setDialogVisible(true)
  }

  const showToast = (severity, summary, detail) =>
    toast.current.show({ severity, summary, detail })

  return (
    <div
      className='flex flex-column md:flex-row w-full overflow-hidden surface-ground relative'
      style={{ height: 'calc(100vh - 64px)' }}
    >
      <Toast ref={toast} position='top-center' className='mt-6 z-5' />

      {/* --- SECCIÓN 1: MAPA --- */}
      <div className='w-full h-[40%] md:h-full md:flex-1 relative z-0 order-1'>
        <MapContainer
          center={centerSpain}
          zoom={5}
          minZoom={4}
          maxBounds={spainBounds}
          zoomControl={false}
          className='h-full w-full'
          style={{ height: '100%', width: '100%', background: '#f0f0f0' }}
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
            <Marker key={ev.id} position={[ev.lat, ev.lng]}>
              {/* --- POPUP RESTAURADO CON TODOS LOS DETALLES --- */}
              <Popup>
                <div className='text-center' style={{ minWidth: '200px' }}>
                  {ev.image_url && (
                    <img
                      src={ev.image_url}
                      alt='Evento'
                      className='w-full border-round mb-2 shadow-2'
                      style={{
                        height: '120px',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  )}
                  <h3 className='font-bold text-lg m-0 text-gray-900'>
                    {ev.titulo}
                  </h3>

                  <div className='flex justify-content-center my-2'>
                    <Tag value={ev.tipo} severity='info' />
                  </div>

                  {ev.description && (
                    <p
                      className='text-sm text-gray-700 m-0 mb-2 line-clamp-2'
                      style={{
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {ev.description}
                    </p>
                  )}

                  <div className='text-xs text-gray-600 border-top-1 border-200 pt-2 mt-1'>
                    <div className='font-semibold mb-1'>
                      {ev.fecha.toLocaleDateString('es-ES')} -{' '}
                      {ev.fecha.toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className='italic text-500'>
                      Añadido por: {ev.profiles?.username || 'Anónimo'}
                    </div>
                  </div>
                </div>
              </Popup>
              {/* ----------------------------------------------- */}
            </Marker>
          ))}
        </MapContainer>

        {!session && (
          <div className='absolute top-0 right-0 m-3 z-[400]'>
            <Button
              icon='pi pi-user'
              rounded
              severity='warning'
              aria-label='Login'
              onClick={() => navigate('/login')}
              className='shadow-3'
            />
          </div>
        )}
      </div>

      {/* --- SECCIÓN 2: LISTA E INSTRUCCIONES --- */}
      <aside
        className='
            order-2 
            w-full md:w-26rem 
            h-[60%] md:h-full 
            flex flex-column 
            bg-white shadow-top-large md:shadow-4 
            z-2 
            relative md:static
            border-top-1 md:border-top-0 md:border-left-1 border-200
            overflow-hidden
        '
        style={{
          borderRadius: window.innerWidth < 768 ? '20px 20px 0 0' : '0',
          marginTop: window.innerWidth < 768 ? '-20px' : '0',
        }}
      >
        <div className='p-3 md:p-4 bg-white border-bottom-1 border-100 flex-none flex justify-content-between align-items-center'>
          <div>
            <h1 className='text-lg md:text-2xl font-extrabold m-0 text-900'>
              Eventos
            </h1>
            <p className='text-500 m-0 text-xs md:text-sm mt-1'>
              {eventos.length} disponibles
            </p>
          </div>
          {session && (
            <Button
              label='Añadir evento'
              icon='pi pi-plus'
              severity='help'
              onClick={handleAddClick}
              className='p-button-outlined shadow-1 mt-3'
            />
          )}
        </div>

        <div className='flex-1 overflow-y-auto p-2 md:p-4 bg-gray-50 md:bg-white'>
          {/* --- BLOQUE DE AVISO (MORADO) --- */}
          <div
            className='p-3 border-round-xl shadow-2 mb-4'
            style={{
              borderLeft: '4px solid #A855F7',
              backgroundColor: '#ffffff',
            }}
          >
            <div
              className='flex align-items-center gap-2 font-bold text-lg mb-2'
              style={{ color: '#2c3e50' }}
            >
              <i
                className='pi pi-map-marker text-xl'
                style={{ color: '#9333EA' }}
              />
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

            <div
              className='p-3 border-round-md flex align-items-start gap-2 text-xs text-700'
              style={{
                backgroundColor: '#FAF5FF',
                border: '1px solid #E9D5FF',
              }}
            >
              <i
                className='pi pi-info-circle'
                style={{ color: '#A855F7', marginTop: '2px' }}
              />
              <span>
                <strong>Nota:</strong> Una vez que la fecha y hora del evento
                hayan pasado, este dejará de mostrarse automáticamente en el
                mapa.
              </span>
            </div>

            {session && (
              <Button
                label='Agregar Evento por Dirección'
                severity='help'
                icon='pi pi-plus'
                className='w-full p-button-outlined shadow-1 mt-3'
                onClick={handleAddClick}
              />
            )}
          </div>

          <div className='flex flex-column gap-2 pb-6'>
            {eventos.length === 0 && (
              <div className='text-center p-5 text-500'>
                <i className='pi pi-map text-4xl mb-2 opacity-50' />
                <p>No hay eventos próximos.</p>
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
