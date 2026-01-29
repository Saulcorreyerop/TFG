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

const EventCard = ({ ev, isSelected, onClick }) => (
  <div
    onClick={() => onClick(ev)}
    className='surface-card p-3 shadow-1 border-round-xl cursor-pointer transition-all hover:shadow-3 flex gap-3 align-items-center mb-2 mx-1'
    style={{
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

  // Referencia al contenedor de scroll para moverlo programáticamente
  const scrollContainerRef = useRef(null)

  const [eventos, setEventos] = useState([])
  const [dialogVisible, setDialogVisible] = useState(false)
  const [posicionTemp, setPosicionTemp] = useState({ lat: null, lng: null })
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false)

  const centerSpain = [40.0, -3.7492]
  const spainBounds = [
    [20.0, -25.0],
    [55.0, 30.0],
  ]

  useEffect(() => {
    const handleResize = () => {
      const isLandscape =
        window.innerWidth > window.innerHeight && window.innerWidth < 1024
      setIsLandscapeMobile(isLandscape)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

  const handleAddClick = () => {
    setPosicionTemp({ lat: null, lng: null })
    setDialogVisible(true)
  }

  // FUNCIÓN CLAVE: Al seleccionar un evento, hacemos scroll arriba (des-solapar)
  const handleEventClick = (ev) => {
    setSelectedEvent(ev)

    // Si estamos en móvil vertical, hacemos scroll suave al inicio
    if (
      scrollContainerRef.current &&
      window.innerWidth < 768 &&
      !isLandscapeMobile
    ) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }
  }

  const showToast = (severity, summary, detail) =>
    toast.current.show({ severity, summary, detail })

  // Lógica de diseño:
  // En Desktop/Landscape: Flex Row normal.
  // En Móvil Vertical: 'relative' para permitir posicionamiento absoluto.
  const containerClass = isLandscapeMobile
    ? 'flex flex-row w-full overflow-hidden surface-ground'
    : 'flex flex-column md:flex-row w-full overflow-hidden surface-ground relative'

  return (
    <div className={containerClass} style={{ height: 'calc(100vh - 64px)' }}>
      <Toast ref={toast} position='top-center' className='mt-6 z-5' />

      {/* --- SECCIÓN 1: MAPA --- */}
      {/* En Móvil Vertical: Posición ABSOLUTA y FIJA arriba.
          En Desktop/Landscape: Posición RELATIVA normal.
      */}
      <div
        className={`
            z-0
            ${
              isLandscapeMobile
                ? 'w-6 h-full relative order-1'
                : 'absolute top-0 left-0 w-full h-[45vh] md:static md:w-full md:h-full md:flex-1 md:order-1'
            }
        `}
      >
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
              <Popup>
                <div className='text-center p-1' style={{ minWidth: '150px' }}>
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
                  <p className='text-xs text-500 m-0 mt-1'>{ev.fechaCorta}</p>
                </div>
              </Popup>
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

      {/* --- SECCIÓN 2: LISTA DE EVENTOS (SCROLLABLE) --- */}
      {/* En Móvil Vertical: 
             - Ocupa TODO el alto (h-full).
             - Tiene scroll (overflow-y-auto).
             - Tiene un 'padding' superior transparente (espaciador) para dejar ver el mapa.
             - Está por encima del mapa (z-10).
      */}
      <aside
        ref={scrollContainerRef}
        className={`
            z-10 bg-transparent
            ${
              isLandscapeMobile
                ? 'order-2 w-6 h-full flex flex-column bg-white shadow-4 overflow-hidden relative'
                : 'absolute inset-0 overflow-y-auto md:static md:w-26rem md:h-full md:flex md:flex-column md:bg-white md:shadow-4 md:order-2 md:overflow-hidden'
            }
        `}
      >
        {/* --- ESPACIADOR TRANSPARENTE (Solo visible en Móvil Vertical) --- */}
        {/* Altura: 40vh (La altura visible inicial del mapa).
            pointer-events-none: Permite hacer click en el mapa a través de este espacio vacío.
        */}
        {!isLandscapeMobile && (
          <div className='w-full h-[40vh] pointer-events-none md:hidden' />
        )}

        {/* --- CONTENIDO REAL (FONDO BLANCO) --- */}
        <div
          className={`
            bg-white flex-1 flex flex-column shadow-top-large
            ${!isLandscapeMobile ? 'min-h-[60vh] border-round-top-2xl' : 'h-full'}
        `}
        >
          {/* Header Sticky dentro de la lista */}
          <div className='p-3 md:p-4 bg-white border-bottom-1 border-100 flex-none flex justify-content-between align-items-center sticky top-0 z-20 border-round-top-2xl'>
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
                label={window.innerWidth > 768 ? 'Añadir evento' : undefined}
                icon='pi pi-plus'
                severity='help'
                onClick={handleAddClick}
                className='p-button-outlined shadow-1'
                rounded={window.innerWidth < 768} // Redondo en móvil para ahorrar espacio
              />
            )}
          </div>

          {/* Lista Scrollable Interna (En desktop) o Continuación (En móvil) */}
          <div
            className={`
                p-2 md:p-4 bg-gray-50 md:bg-white
                ${isLandscapeMobile || window.innerWidth >= 768 ? 'flex-1 overflow-y-auto' : ''}
            `}
          >
            {/* BLOQUE DE AVISO (MORADO) */}
            <div
              className='p-3 border-round-xl shadow-2 mb-4 bg-white'
              style={{ borderLeft: '4px solid #A855F7' }}
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
                Navega por el mapa, haz zoom y haz click para crear.
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
                  <strong>Nota:</strong> Los eventos pasados desaparecen
                  automáticamente.
                </span>
              </div>
            </div>

            {/* LISTA DE CARDS */}
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
                  onClick={handleEventClick} // Usamos el nuevo handler
                />
              ))}
            </div>
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
