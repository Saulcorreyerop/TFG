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
    // Ajuste crítico para que el mapa se renderice bien al cambiar tamaños
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

  // Referencia al contenedor scrollable (la "sábana")
  const scrollSheetRef = useRef(null)

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

  // Detectar orientación
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
    fetchEventos() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAddClick = () => {
    setPosicionTemp({ lat: null, lng: null })
    setDialogVisible(true)
  }

  // --- LÓGICA DE "DES-SOLAPAR" ---
  const handleEventClick = (ev) => {
    setSelectedEvent(ev)

    // Si estamos en móvil vertical, hacemos scroll al inicio (0)
    // Esto hace que la lista baje visualmente y se vea el mapa a través del espaciador transparente.
    if (
      scrollSheetRef.current &&
      window.innerWidth < 768 &&
      !isLandscapeMobile
    ) {
      scrollSheetRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }
  }

  const showToast = (severity, summary, detail) =>
    toast.current.show({ severity, summary, detail })

  // Estilos condicionales según dispositivo
  const isDesktopOrLandscape = window.innerWidth >= 768 || isLandscapeMobile

  return (
    <div
      className='w-full overflow-hidden surface-ground relative'
      style={{
        height: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: isDesktopOrLandscape ? 'row' : 'column',
      }}
    >
      <Toast ref={toast} position='top-center' className='mt-6 z-5' />

      {/* =============================================
         CAPA 1: EL MAPA (FONDO) 
         =============================================
         En Móvil Vertical: Ocupa TODA la pantalla (h-full) y está absoluta al fondo (z-0).
         En Desktop: Flex relativo normal.
      */}
      <div
        className={`
            ${
              isDesktopOrLandscape
                ? 'flex-1 h-full relative z-0 order-1' // Desktop/Landscape
                : 'absolute inset-0 w-full h-full z-0' // Móvil Vertical (Fondo fijo)
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
                  <div className='text-xs text-gray-600 border-top-1 border-200 pt-2 mt-1'>
                    <div className='font-semibold'>
                      {ev.fecha.toLocaleDateString('es-ES')}
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Botón Login Flotante */}
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

      {/* =============================================
         CAPA 2: LA LISTA (FRENTE / SCROLLABLE)
         =============================================
         En Móvil Vertical: 
            - Absoluta (z-10) cubriendo toda la pantalla.
            - Fondo TRANSPARENTE (para ver el mapa a través).
            - overflow-y-auto (para hacer scroll).
         En Desktop:
            - Bloque estático lateral.
      */}
      <aside
        ref={scrollSheetRef}
        className={`
            ${
              isDesktopOrLandscape
                ? 'w-26rem h-full bg-white shadow-4 z-2 flex flex-column order-2 relative overflow-hidden' // Desktop
                : 'absolute inset-0 z-10 w-full h-full overflow-y-auto pointer-events-auto no-scrollbar' // Móvil Vertical
            }
        `}
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* --- ESPACIADOR TRANSPARENTE (Solo Móvil) ---
           Esta es la clave. Es un div vacío transparente que empuja el contenido blanco hacia abajo.
           Al inicio, ves el mapa a través de este div.
           Al hacer scroll, el contenido blanco sube y tapa este div.
           pointer-events-none: Permite tocar el mapa si tocas en la zona transparente.
        */}
        {!isDesktopOrLandscape && (
          <div
            className='w-full pointer-events-none'
            style={{ height: '45vh' }} // Altura inicial visible del mapa
          />
        )}

        {/* --- CONTENIDO BLANCO DE LA LISTA --- */}
        <div
          className={`
                bg-white flex-1 flex flex-column shadow-top-large
                ${!isDesktopOrLandscape ? 'min-h-[70vh] rounded-t-3xl shadow-8' : 'h-full'}
            `}
          // Bordes redondeados solo en móvil
          style={
            !isDesktopOrLandscape
              ? {
                  borderRadius: '24px 24px 0 0',
                  boxShadow: '0 -4px 10px rgba(0,0,0,0.1)',
                }
              : {}
          }
        >
          {/* Header de la Lista (Sticky) */}
          <div
            className={`
                    p-3 md:p-4 bg-white border-bottom-1 border-100 flex-none flex justify-content-between align-items-center
                    ${!isDesktopOrLandscape ? 'sticky top-0 z-20' : ''} 
                `}
            style={
              !isDesktopOrLandscape ? { borderRadius: '24px 24px 0 0' } : {}
            }
          >
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
                icon='pi pi-plus'
                severity='help'
                rounded={!isDesktopOrLandscape}
                label={isDesktopOrLandscape ? 'Añadir' : undefined}
                onClick={handleAddClick}
                className='shadow-1'
              />
            )}
          </div>

          {/* Cuerpo de la Lista */}
          <div
            className={`p-2 md:p-4 bg-gray-50 md:bg-white flex-1 ${isDesktopOrLandscape ? 'overflow-y-auto' : ''}`}
          >
            {/* Tarjeta de Instrucciones (Morada) */}
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
                Navega por el mapa y haz click para crear.
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
              {/* Botón extra en móvil por si el mapa queda muy tapado */}
              {session && !isDesktopOrLandscape && (
                <Button
                  label='Añadir por dirección'
                  link
                  size='small'
                  className='w-full mt-2 p-0 text-purple-600'
                  onClick={handleAddClick}
                />
              )}
            </div>

            {/* Lista de Eventos */}
            <div className='flex flex-column gap-2 pb-8'>
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
                  onClick={handleEventClick}
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
