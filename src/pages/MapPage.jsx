import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import L from 'leaflet'
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
import 'leaflet/dist/leaflet.css'
import './MapPage.css'
import PageTransition from '../components/PageTransition'

// --- CREADOR DE PINES PERSONALIZADOS ---
const getCustomIcon = (isPrivate) => {
  const bgColor = isPrivate ? '#eab308' : '#3b82f6'
  const iconClass = isPrivate ? 'pi-lock' : 'pi-map-marker'

  return L.divIcon({
    className: 'custom-leaflet-pin',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
        <div style="background-color: ${bgColor}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white;">
          <i class="pi ${iconClass}" style="color: white; font-size: 15px;"></i>
        </div>
        <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid ${bgColor}; margin-top: -1px;"></div>
      </div>
    `,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  })
}

const MapController = ({ selectedEvent }) => {
  const map = useMap()

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize()
    })

    const container = map.getContainer()
    if (container) {
      resizeObserver.observe(container)
    }

    const timer1 = setTimeout(() => map.invalidateSize(), 300)
    const timer2 = setTimeout(() => map.invalidateSize(), 800)

    return () => {
      if (container) resizeObserver.unobserve(container)
      resizeObserver.disconnect()
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [map])

  useEffect(() => {
    if (selectedEvent?.lat && selectedEvent?.lng) {
      map.flyTo(
        [parseFloat(selectedEvent.lat), parseFloat(selectedEvent.lng)],
        16,
        { animate: true, duration: 1.5 },
      )
    }
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

const EventCard = ({ ev, isSelected, onClick, onNavigate }) => (
  <div
    onClick={() => onClick(ev)}
    className={`surface-card p-3 shadow-1 border-round-xl cursor-pointer flex gap-3 align-items-center mb-2 mx-1 event-card ${isSelected ? 'selected' : ''}`}
  >
    <div className='w-4rem h-4rem border-round-lg overflow-hidden flex-shrink-0 shadow-1 bg-gray-100 relative'>
      <img
        src={ev.image_url || 'https://via.placeholder.com/150'}
        alt={ev.titulo}
        className='w-full h-full'
        style={{ objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
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
        {ev.is_private && (
          <Tag
            className='bg-yellow-100 text-yellow-700 border-1 border-yellow-300'
            style={{ fontSize: '0.6rem', padding: '2px 4px' }}
          >
            <i className='pi pi-lock text-xs mr-1'></i>Crew
          </Tag>
        )}
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
        className='text-400 hover:text-primary hover:bg-gray-100'
        onClick={(e) => {
          e.stopPropagation()
          onNavigate()
        }}
      />
    </div>
  </div>
)

const MapPage = ({ session }) => {
  const navigate = useNavigate()
  const toast = useRef(null)
  const mainContainerRef = useRef(null)

  // REFERENCIAS PARA LA ANIMACIÓN APPLE
  const filterBarRef = useRef(null)
  const [indicatorStyle, setIndicatorStyle] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  })

  const [eventos, setEventos] = useState([])
  const [dialogVisible, setDialogVisible] = useState(false)
  const [posicionTemp, setPosicionTemp] = useState({ lat: null, lng: null })
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [activeFilter, setActiveFilter] = useState('Todos')

  const centerSpain = [40.0, -3.7492]
  const spainBounds = [
    [20.0, -25.0],
    [55.0, 30.0],
  ]

  const fetchEventos = useCallback(async () => {
    let userCrews = []
    if (session) {
      const { data: crewData } = await supabase
        .from('crew_members')
        .select('crew_id')
        .eq('user_id', session.user.id)
        .eq('status', 'approved')
      if (crewData) userCrews = crewData.map((c) => c.crew_id)
    }

    let query = supabase
      .from('events')
      .select('*, profiles(username)')
      .gte('fecha', new Date().toISOString())
      .order('fecha', { ascending: true })

    if (userCrews.length > 0) {
      query = query.or(
        `is_private.is.null,is_private.eq.false,crew_id.in.(${userCrews.join(',')})`,
      )
    } else {
      query = query.or('is_private.is.null,is_private.eq.false')
    }

    const { data } = await query

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
  }, [session])

  useEffect(() => {
    // eslint-disable-next-line
    fetchEventos()
  }, [fetchEventos])

  // --- LÓGICA DE FILTRADO ---
  const eventCategories = [
    'Todos',
    ...new Set(eventos.map((ev) => ev.tipo).filter(Boolean)),
  ]

  const filteredEventos =
    activeFilter === 'Todos'
      ? eventos
      : eventos.filter((ev) => ev.tipo === activeFilter)

  // 🔴 LÓGICA DE LA ANIMACIÓN Y CENTRADO DE LA BARRA 🔴
  useEffect(() => {
    const updateIndicator = () => {
      if (filterBarRef.current) {
        const activeBtn = filterBarRef.current.querySelector(
          '.map-filter-btn.active',
        )
        if (activeBtn) {
          // 1. Movemos la píldora azul
          setIndicatorStyle({
            left: activeBtn.offsetLeft,
            width: activeBtn.offsetWidth,
            opacity: 1,
          })

          // 2. Centramos el scroll (Magia UX para móviles)
          const container = filterBarRef.current
          const scrollTarget =
            activeBtn.offsetLeft -
            container.offsetWidth / 2 +
            activeBtn.offsetWidth / 2
          container.scrollTo({ left: scrollTarget, behavior: 'smooth' })
        }
      }
    }

    // Pequeño delay para que React dibuje el DOM antes de medir
    setTimeout(updateIndicator, 50)
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [activeFilter, eventos.length])

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
    <PageTransition>
      <div className='map-page-container'>
        <Helmet>
          <title>Mapa de Eventos en Vivo | CarMeetESP</title>
        </Helmet>

        <div
          ref={mainContainerRef}
          className='map-page-container w-full relative'
        >
          <Toast ref={toast} position='top-center' className='mt-6 z-5' />

          <div className='map-section relative'>
            {/* 🔴 BARRA DE FILTROS ANIMADA ESTILO APPLE 🔴 */}
            <div className='map-filter-bar' ref={filterBarRef}>
              <div className='filter-indicator' style={indicatorStyle}></div>
              {eventCategories.map((cat) => (
                <button
                  key={cat}
                  className={`map-filter-btn ${activeFilter === cat ? 'active' : ''}`}
                  onClick={() => {
                    setActiveFilter(cat)
                    setSelectedEvent(null)
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <MapContainer
              center={centerSpain}
              zoom={5}
              minZoom={5}
              maxZoom={18}
              maxBounds={spainBounds}
              maxBoundsViscosity={1.0}
              zoomControl={false}
              className='h-full w-full'
              style={{ background: '#e9ecef' }}
              zoomAnimation={true}
              markerZoomAnimation={true}
              trackResize={true}
              fadeAnimation={true}
              inertia={true}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                maxZoom={18}
                keepBuffer={8}
                updateWhenZooming={false}
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

              {filteredEventos.map((ev) => (
                <Marker
                  key={ev.id}
                  position={[ev.lat, ev.lng]}
                  icon={getCustomIcon(ev.is_private)}
                >
                  <Popup>
                    <div
                      className='text-center p-1 cursor-pointer'
                      style={{ minWidth: '150px' }}
                      onClick={() => navigate(`/evento/${ev.id}`)}
                    >
                      {ev.image_url && (
                        <div
                          className='w-full relative bg-gray-100 mb-2 border-round overflow-hidden shadow-2'
                          style={{ height: '120px' }}
                        >
                          <img
                            src={ev.image_url}
                            alt='Evento'
                            className='w-full h-full'
                            style={{
                              objectFit: 'cover',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                            }}
                          />
                        </div>
                      )}

                      {ev.is_private && (
                        <div className='flex justify-content-center mb-1'>
                          <span className='bg-yellow-100 text-yellow-700 font-bold px-2 py-1 border-round-md text-xs flex align-items-center gap-1 border-1 border-yellow-300'>
                            <i className='pi pi-lock text-xs'></i> CREW
                          </span>
                        </div>
                      )}

                      <h3 className='font-bold text-lg m-0 text-gray-900 hover:text-primary transition-colors'>
                        {ev.titulo}
                      </h3>
                      <div className='flex justify-content-center my-2'>
                        <Tag value={ev.tipo} severity='info' />
                      </div>
                      <div className='text-xs text-gray-600 border-top-1 border-200 pt-2 mt-1'>
                        <div className='font-semibold'>
                          {ev.fecha.toLocaleDateString('es-ES')}
                        </div>
                        <div className='text-primary font-bold mt-1'>
                          <Button
                            label='Ver más info >'
                            severity='help'
                            rounded
                            className='shadow-1'
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/evento/${ev.id}`)
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

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
              <div className='mt-2 md:mt-0 text-center flex justify-content-center align-items-center flex-column w-full'>
                <h1 className='text-lg md:text-2xl font-extrabold m-0 text-900 text-center'>
                  Eventos
                </h1>
                <p className='text-500 m-0 text-xs md:text-sm mt-1 text-center'>
                  {filteredEventos.length} disponibles
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
              <div className='flex flex-column gap-2'>
                <h2 className='text-lg md:text-2xl font-extrabold m-0 text-900 text-center mt-3'>
                  {activeFilter === 'Todos'
                    ? 'Próximos Eventos'
                    : `Eventos de ${activeFilter}`}
                </h2>
                <hr className='event-separator' />
                {filteredEventos.length === 0 && (
                  <div className='text-center p-5 text-500'>
                    <i className='pi pi-filter-slash text-4xl mb-2 opacity-50' />
                    <p>No hay eventos disponibles para esta categoría.</p>
                  </div>
                )}
                {filteredEventos.map((ev) => (
                  <EventCard
                    key={ev.id}
                    ev={ev}
                    isSelected={selectedEvent?.id === ev.id}
                    onClick={handleEventClick}
                    onNavigate={() => navigate(`/evento/${ev.id}`)}
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
      </div>
    </PageTransition>
  )
}

export default MapPage
