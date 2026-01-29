import React, { useState, useEffect, useRef, useCallback } from 'react'
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

import './MapPage.css'

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
    setTimeout(() => map.invalidateSize(), 400)
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
    className={`surface-card p-3 shadow-1 border-round-xl cursor-pointer flex gap-3 align-items-center mb-2 mx-1 event-card ${isSelected ? 'selected' : ''}`}
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
          <i className='pi pi-calendar mr-1 text-xs'></i> {ev.fechaCorta}
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
  const mainContainerRef = useRef(null)

  const [eventos, setEventos] = useState([])
  const [dialogVisible, setDialogVisible] = useState(false)
  const [posicionTemp, setPosicionTemp] = useState({ lat: null, lng: null })
  const [selectedEvent, setSelectedEvent] = useState(null)

  const centerSpain = [40.0, -3.7492]
  const spainBounds = [
    [20.0, -25.0],
    [55.0, 30.0],
  ]

  const fetchEventos = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    fetchEventos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchEventos])

  const handleAddClick = () => {
    if (!session) {
      toast.current.show({
        severity: 'info',
        summary: 'Cuenta requerida',
        detail: 'Debes iniciar sesión para publicar un evento.',
        life: 3000,
      })
      return
    }
    setPosicionTemp({ lat: null, lng: null })
    setDialogVisible(true)
  }

  const handleEventClick = (ev) => {
    setSelectedEvent(ev)
    if (window.innerWidth < 768 && mainContainerRef.current) {
      mainContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const scrollToTopList = () => {
    if (window.innerWidth < 768 && mainContainerRef.current) {
      mainContainerRef.current.scrollTo({ top: 500, behavior: 'smooth' })
    }
  }

  const showToast = (severity, summary, detail) =>
    toast.current.show({ severity, summary, detail })

  return (
    <div ref={mainContainerRef} className='map-page-container'>
      <Toast ref={toast} position='top-center' className='mt-6 z-5' />

      {/* 1. SECCIÓN DEL MAPA */}
      <div className='map-section'>
        <MapContainer
          center={centerSpain}
          zoom={5}
          minZoom={4}
          maxBounds={spainBounds}
          zoomControl={false}
          className='h-full w-full'
          style={{ background: '#f0f0f0' }}
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

      {/* 2. SECCIÓN DE LA LISTA */}
      <aside className='sidebar-section'>
        <div
          className='sidebar-header p-3 md:p-4 border-bottom-1 border-100 flex justify-content-between align-items-center'
          onClick={scrollToTopList}
        >
          <div className='mobile-drag-handle'>
            <div
              className='w-3rem h-1 border-round opacity-50'
              style={{ backgroundColor: '#d1d5db' }}
            ></div>
          </div>

          <div className='mt-2 md:mt-0 text-center display-flex justify-content-center align-items-center flex-column w-full'>
            <h1 className='text-lg md:text-2xl font-extrabold m-0 text-900 text-center'>
              Eventos
            </h1>
            <p className='text-500 m-0 text-xs md:text-sm mt-1 text-center'>
              {eventos.length} disponibles
            </p>
          </div>

          <Button
            icon='pi pi-plus'
            severity='help'
            rounded
            className='shadow-1'
            onClick={(e) => {
              e.stopPropagation()
              handleAddClick()
            }}
            aria-label='Añadir'
          />
        </div>

        <div className='sidebar-content p-2 md:p-4 bg-gray-50 md:bg-white'>
          <div className='p-3 border-round-xl shadow-2 mb-4 instruction-card'>
            <div
              className='flex align-items-center gap-2 font-bold text-lg mb-2'
              style={{ color: '#2c3e50' }}
            >
              <i className='pi pi-map-marker text-xl text-purple' />
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
              <span className='font-bold text-900'>
                {' '}
                botón de abajo o la cruz de arriba{' '}
              </span>
              para añadirlo de una manera mas sencilla.
            </p>

            <div className='p-3 border-round-md flex align-items-start gap-2 text-xs note-box'>
              <i
                className='pi pi-info-circle text-purple'
                style={{ marginTop: '2px' }}
              />
              <span>
                <strong>Nota:</strong> Una vez que la fecha y hora del evento
                hayan pasado, este dejará de mostrarse automáticamente en el
                mapa.
              </span>
            </div>

            <div className='mt-3'>
              <Button
                label='Agregar Evento por Dirección'
                severity='help'
                outlined
                className='w-full text-purple-dark'
                onClick={handleAddClick}
              />
            </div>
          </div>

          <div className='flex flex-column gap-2'>
            <h2 className='text-lg md:text-2xl font-extrabold m-0 text-900 text-center'>
              Eventos Próximos
            </h2>
            {/* AQUÍ ESTÁ EL CAMBIO: Usamos la clase .event-separator */}
            <hr className='event-separator' />

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
