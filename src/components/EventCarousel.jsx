import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Carousel } from 'primereact/carousel'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import { Tag } from 'primereact/tag'
import { Avatar } from 'primereact/avatar'
import AddEventDialog from './AddEventDialog'
import { useFavorites } from '../hooks/useFavorites'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, MapPin, Plus, Heart, Sparkles, User } from 'lucide-react'
import { motion } from 'framer-motion'
import './Home.css'

const MotionDiv = motion.div

const RESPONSIVE_OPTIONS = [
  { breakpoint: '1400px', numVisible: 3, numScroll: 1 },
  { breakpoint: '1199px', numVisible: 2, numScroll: 1 },
  { breakpoint: '767px', numVisible: 1, numScroll: 1 },
]

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'

// --- TARJETA DE EVENTO PREMIUM ---
const CarouselItem = ({ event, session }) => {
  const { isFavorite, toggleFavorite, loading } = useFavorites(
    event.id,
    session,
  )
  const navigate = useNavigate()

  // Extraemos datos de la fecha para el Badge Flotante
  const eventDateObj = new Date(event.fecha)
  const dayNumber = eventDateObj.getDate()
  const monthShort = eventDateObj
    .toLocaleDateString('es-ES', { month: 'short' })
    .toUpperCase()
    .replace('.', '')

  return (
    <div className='p-3 h-full'>
      <div
        className='premium-event-card cursor-pointer'
        onClick={() => navigate(`/evento/${event.id}`)}
      >
        {/* SECCIÓN DE IMAGEN */}
        <div
          className='premium-card-img-container flex-shrink-0'
          style={{ height: '220px', minHeight: '220px' }}
        >
          <img
            src={event.image}
            alt={event.titulo}
            className='premium-card-img w-full h-full object-cover'
            loading='lazy'
            onError={(e) => {
              e.target.onerror = null
              e.target.src = FALLBACK_IMAGE
            }}
          />

          {/* Overlay oscuro sutil para proteger los textos blancos */}
          <div
            className='absolute top-0 left-0 w-full h-full'
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 40%, transparent 100%)',
            }}
          ></div>

          {/* Etiqueta de Categoría */}
          <div className='absolute top-0 left-0 m-3 z-2'>
            <Tag
              value={event.tipo}
              className='bg-blue-600 text-white font-black border-round-xl px-3 py-2 uppercase tracking-widest text-xs shadow-2'
            />
          </div>

          {/* Badge de Fecha Premium */}
          <div
            className='absolute bottom-0 right-0 m-3 date-badge-premium p-2 flex flex-column z-2 bg-white-alpha-90 backdrop-blur-sm border-round-xl shadow-2 text-center'
            style={{ minWidth: '65px' }}
          >
            <span className='text-xs font-black text-blue-600 uppercase tracking-widest mb-1'>
              {monthShort}
            </span>
            <span className='text-2xl font-black text-900 line-height-1'>
              {dayNumber}
            </span>
          </div>
        </div>

        {/* SECCIÓN DE CONTENIDO */}
        <div className='p-4 flex flex-column flex-grow-1 bg-white'>
          <h4
            className='text-2xl font-black text-900 mt-0 mb-3 line-height-2 tracking-tight'
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {event.titulo}
          </h4>

          <div className='flex align-items-center gap-2 text-600 font-medium mb-4 text-sm'>
            <MapPin size={18} className='text-red-500 flex-shrink-0' />
            <span className='white-space-nowrap overflow-hidden text-overflow-ellipsis'>
              {event.ubicacion
                ? event.ubicacion
                : event.lat && event.lng
                  ? 'Ubicación en el mapa'
                  : 'Por determinar'}
            </span>
          </div>

          {/* FOOTER (Organizador y Botón) */}
          <div className='pt-3 border-top-1 surface-border flex align-items-center justify-content-between mt-auto'>
            <div
              className='flex align-items-center gap-3 text-700 cursor-pointer hover:text-blue-600 transition-colors'
              onClick={(e) => {
                e.stopPropagation()
                event.user_id && navigate(`/usuario/${event.user_id}`)
              }}
            >
              <Avatar
                image={event.profiles?.avatar_url || undefined}
                icon={
                  !event.profiles?.avatar_url ? <User size={20} /> : undefined
                }
                shape='circle'
                size='large'
                className='bg-blue-50 text-blue-600 border-1 surface-border'
              />
              <div className='flex flex-column'>
                <span className='text-xs text-500 font-black uppercase tracking-widest mb-1'>
                  Organiza
                </span>
                <span
                  className='font-bold text-sm text-overflow-ellipsis white-space-nowrap overflow-hidden'
                  style={{ maxWidth: '120px' }}
                >
                  {event.profiles?.username || 'Anónimo'}
                </span>
              </div>
            </div>

            <Button
              icon={
                <Heart
                  size={20}
                  className={isFavorite ? 'fill-current text-pink-500' : ''}
                />
              }
              rounded
              text={!isFavorite}
              className={`w-3rem h-3rem transition-colors shadow-none ${isFavorite ? 'bg-pink-50 border-1 border-pink-200' : 'surface-100 text-600 hover:surface-200 border-none'}`}
              onClick={(e) => {
                e.stopPropagation()
                toggleFavorite()
              }}
              loading={loading}
              tooltip={isFavorite ? 'Quitar de favoritos' : 'Guardar evento'}
              tooltipOptions={{ position: 'top' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// --- COMPONENTE PRINCIPAL CARRUSEL ---
const EventCarousel = () => {
  const [events, setEvents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [currentUserSession, setCurrentUserSession] = useState(null)
  const [loadingState, setLoadingState] = useState(true)
  const toast = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserSession(session)
    })
  }, [])

  const fetchEvents = async () => {
    setLoadingState(true)
    const { data, error } = await supabase
      .from('events')
      .select('*, profiles(username, avatar_url)')
      .gte('fecha', new Date().toISOString())
      .order('fecha', { ascending: true })
      .limit(9)

    if (!error && data) {
      const processedEvents = data.map((ev) => {
        const isValidUrl =
          ev.image_url &&
          typeof ev.image_url === 'string' &&
          ev.image_url.trim().startsWith('http')
        const validImage = isValidUrl ? ev.image_url.trim() : FALLBACK_IMAGE

        return {
          ...ev,
          image: validImage,
          formattedDate: new Date(ev.fecha).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
        }
      })
      setEvents(processedEvents)
    }
    setLoadingState(false)
  }

  useEffect(() => {
    fetchEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpenModal = () => {
    if (!currentUserSession) {
      toast.current.show({
        severity: 'warn',
        summary: 'Acceso restringido',
        detail: 'Debes iniciar sesión para publicar.',
        life: 3000,
      })
      return
    }
    setShowModal(true)
  }

  const containerVars = {
    hidden: { opacity: 0, y: 30 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
    },
  }

  return (
    <section className='py-8 relative z-10 overflow-hidden'>
      <Toast ref={toast} position='top-center' className='mt-6 z-5' />

      {/* Brillos de fondo orgánicos sutiles */}
      <div className='absolute top-0 left-0 -translate-x-50 -translate-y-50 w-50rem h-50rem bg-purple-100 border-circle opacity-30 blur-3xl pointer-events-none z-0'></div>

      <MotionDiv
        variants={containerVars}
        initial='hidden'
        whileInView='show'
        viewport={{ once: true, margin: '-100px' }}
        className='max-w-7xl mx-auto px-4 md:px-6 relative z-1'
      >
        {/* CABECERA */}
        <div className='flex flex-column md:flex-row justify-content-between align-items-md-end mb-7 gap-4'>
          <div>
            <div className='inline-flex align-items-center gap-2 bg-purple-50 text-purple-600 font-black border-round-3xl px-4 py-2 mb-3 uppercase tracking-widest text-xs shadow-1 border-1 border-purple-100'>
              <Sparkles size={16} />
              <span>Agenda del Motor</span>
            </div>

            <h3 className='text-5xl md:text-7xl font-black text-900 m-0 tracking-tighter'>
              Próximos <span className='text-gradient-purple'>Eventos</span>
            </h3>

            <p className='text-600 text-xl font-medium m-0 mt-3 max-w-2xl line-height-3'>
              No te pierdas nada. Las mejores rutas, KDDs y concentraciones
              seleccionadas para ti.
            </p>
          </div>
          <div className='flex-shrink-0'>
            <Button
              label='Publicar Evento'
              icon={<Plus size={20} className='mr-2' strokeWidth={2.5} />}
              className='btn-fichar-primary px-5 py-3 shadow-4 text-lg'
              onClick={handleOpenModal}
            />
          </div>
        </div>

        {/* CARRUSEL DE PRIME REACT */}
        <div className='-mx-3'>
          {!loadingState && events.length > 0 ? (
            <Carousel
              value={events}
              numVisible={3}
              numScroll={1}
              responsiveOptions={RESPONSIVE_OPTIONS}
              itemTemplate={(event) => (
                <CarouselItem event={event} session={currentUserSession} />
              )}
              circular
              autoplayInterval={6000}
              showIndicators={false}
              pt={{
                itemsContent: { className: 'py-4' },
              }}
            />
          ) : (
            <div className='text-center py-8 bg-white border-round-3xl border-2 border-dashed border-gray-200 shadow-1 mx-3'>
              <CalendarDays size={64} className='text-300 mb-4 mx-auto' />
              <p className='text-900 text-3xl font-black m-0 mb-2'>
                No hay eventos próximos.
              </p>
              <p className='text-600 text-xl m-0'>
                ¡Sé el primero en crear una ruta épica!
              </p>
              <Button
                label='Crear el primer evento'
                icon={<Plus size={20} className='mr-2' />}
                className='mt-5 px-5 py-3 font-bold border-round-xl p-button-outlined'
                onClick={handleOpenModal}
              />
            </div>
          )}
        </div>
      </MotionDiv>

      <AddEventDialog
        visible={showModal}
        onHide={() => setShowModal(false)}
        onEventAdded={fetchEvents}
        session={currentUserSession}
      />
    </section>
  )
}

export default EventCarousel
