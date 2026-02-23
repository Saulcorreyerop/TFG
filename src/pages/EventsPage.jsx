import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { Dropdown } from 'primereact/dropdown'
import { Toast } from 'primereact/toast'
import { Avatar } from 'primereact/avatar'
import { addLocale } from 'primereact/api'
import AddEventDialog from '../components/AddEventDialog'
import { useFavorites } from '../hooks/useFavorites'
import PageTransition from '../components/PageTransition'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  MapPin,
  Search,
  Filter,
  Plus,
  Heart,
  ArrowUpRight,
  User,
  Clock,
  Layers,
  Grid,
  List,
  Star,
  ArrowRight,
} from 'lucide-react'
import './EventsPage.css'

const MotionDiv = motion.div

addLocale('es', {
  firstDayOfWeek: 1,
  dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
  monthNames: [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ],
  today: 'Hoy',
  clear: 'Limpiar',
})

// AÑADIDO: Propiedad 'theme' para darle un color único a cada categoría
const EVENT_TYPES = [
  { label: 'Todos los tipos', value: null, theme: 'blue' },
  {
    label: 'Stance / Expo',
    value: 'Stance,Exposición,Expo',
    icon: '🚘',
    theme: 'purple',
  },
  { label: 'Ruta / Tramo', value: 'Tramo,Ruta', icon: '🛣️', theme: 'emerald' },
  {
    label: 'Circuito / Trackday',
    value: 'Circuito,Trackday,Racing',
    icon: '🏁',
    theme: 'red',
  },
  { label: 'Clásicos', value: 'Clasicos,Clásicos', icon: '🕰️', theme: 'amber' },
  {
    label: 'Off-road / 4x4',
    value: 'Offroad,Off-road,4x4',
    icon: '⛰️',
    theme: 'orange',
  },
]

const formatEventData = (ev) => {
  const date = new Date(ev.fecha)
  return {
    ...ev,
    dateObj: date,
    monthShort: date
      .toLocaleDateString('es-ES', { month: 'short' })
      .toUpperCase(),
    dayNumber: date.toLocaleDateString('es-ES', { day: '2-digit' }),
    time: date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    formattedDate: date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
    image:
      ev.image_url ||
      `https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80&random=${ev.id}`,
  }
}

const TechnicalCoverCard = ({ event }) => {
  const navigate = useNavigate()
  return (
    <div
      className='technical-cover group cursor-pointer'
      onClick={() => navigate(`/evento/${event.id}`)}
    >
      <div className='cover-image-wrapper'>
        <img
          src={event.image}
          alt={event.titulo}
          className='cover-image group-hover:scale-105 transition-transform duration-700'
        />
        <div className='cover-overlay'></div>
      </div>

      <div className='cover-content'>
        <div className='flex align-items-center gap-2 mb-4'>
          <span className='tech-badge bg-white text-black'>
            <Star size={14} className='mr-1' /> DESTACADO
          </span>
          <span className='tech-badge bg-black text-white border-1 border-white-alpha-30'>
            {event.tipo}
          </span>
        </div>
        <h1 className='text-4xl md:text-6xl font-black text-white m-0 line-height-1 tracking-tight mb-4'>
          {event.titulo}
        </h1>

        <div className='flex flex-column md:flex-row align-items-start md:align-items-center justify-content-between w-full border-top-1 border-white-alpha-20 pt-4 mt-auto gap-4'>
          <div className='flex gap-4'>
            <div className='text-white pr-4 border-right-1 border-white-alpha-20'>
              <div className='text-xs text-white-alpha-60 font-bold uppercase tracking-widest mb-1'>
                Fecha
              </div>
              <div className='font-bold text-lg flex align-items-center gap-2'>
                <Calendar size={18} /> {event.formattedDate}
              </div>
            </div>
            <div className='text-white'>
              <div className='text-xs text-white-alpha-60 font-bold uppercase tracking-widest mb-1'>
                Ubicación
              </div>
              <div className='font-bold text-lg flex align-items-center gap-2 overflow-hidden text-overflow-ellipsis white-space-nowrap'>
                <MapPin size={18} />{' '}
                {event.ubicacion
                  ? event.ubicacion.split(',')[0]
                  : 'Ver detalles'}
              </div>
            </div>
          </div>

          <div className='flex align-items-center gap-2 text-white font-bold tracking-widest uppercase text-sm group-hover:text-blue-300 transition-colors'>
            Ir al evento{' '}
            <ArrowRight
              size={20}
              className='group-hover:translate-x-2 transition-transform'
            />
          </div>
        </div>
      </div>
    </div>
  )
}

const TimelineEventCard = React.memo(({ event, isPast = false, session }) => {
  const { isFavorite, toggleFavorite, loading } = useFavorites(
    event.id,
    session,
  )
  const navigate = useNavigate()

  return (
    <div
      className={`timeline-card ${isPast ? 'is-past' : ''}`}
      onClick={() => navigate(`/evento/${event.id}`)}
    >
      <div className='timeline-date'>
        <span className='day'>{event.dayNumber}</span>
        <span className='month'>{event.monthShort}</span>
      </div>

      <div className='timeline-image-wrapper'>
        <img src={event.image} alt={event.titulo} loading='lazy' />
        {isPast && <div className='past-label'>FINALIZADO</div>}
      </div>

      <div className='timeline-info'>
        <div className='flex align-items-center gap-2 mb-2 text-xs font-bold uppercase tracking-widest text-500'>
          <span className='text-blue-600'>{event.tipo}</span>
          <span>•</span>
          <span className='flex align-items-center gap-1'>
            <Clock size={12} /> {event.time}h
          </span>
        </div>
        <h3 className='text-xl font-black text-900 m-0 mb-3'>{event.titulo}</h3>

        <div className='flex align-items-center justify-content-between mt-auto'>
          <div className='flex align-items-center gap-2 text-sm font-semibold text-700'>
            <User size={16} className='text-500' />{' '}
            {event.profiles?.username || 'Anónimo'}
          </div>
          <div className='flex gap-2 align-items-center'>
            <Button
              icon={
                <Heart
                  size={18}
                  className={
                    isFavorite ? 'fill-current text-red-500' : 'text-700'
                  }
                />
              }
              rounded
              text
              className='hover:bg-gray-100 p-2'
              onClick={(e) => {
                e.stopPropagation()
                toggleFavorite()
              }}
              loading={loading}
              disabled={isPast}
            />
            <Button
              label='Ver'
              icon={<ArrowUpRight size={18} />}
              iconPos='right'
              className='btn-timeline-ver px-3 py-2'
            />
          </div>
        </div>
      </div>
    </div>
  )
})

const EventsPage = ({ session }) => {
  const navigate = useNavigate() // <-- AÑADIDO: Esto soluciona el error de navigate is not defined
  const [events, setEvents] = useState({ upcoming: [], past: [], featured: [] })
  const [favorites, setFavorites] = useState([])
  const [filters, setFilters] = useState({ text: '', type: null })
  const [activeTab, setActiveTab] = useState('upcoming')
  const [showModal, setShowModal] = useState(false)
  const toast = useRef(null)

  const fetchAllEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, profiles(username)')
      .order('fecha', { ascending: false })
    const now = new Date()
    if (!error && data) {
      const processed = data.map((ev) => formatEventData(ev))
      const future = processed
        .filter((ev) => ev.dateObj >= now)
        .sort((a, b) => a.dateObj - b.dateObj)
      setEvents({
        upcoming: future,
        past: processed
          .filter((ev) => ev.dateObj < now)
          .sort((a, b) => b.dateObj - a.dateObj),
        featured: future.slice(0, 1),
      })
    }
    if (session) {
      const { data: favData, error: favError } = await supabase
        .from('favorites')
        .select('event_id, events(*, profiles(username))')
        .eq('user_id', session.user.id)
      if (!favError && favData) {
        const validFavs = favData
          .map((item) => item.events)
          .filter((ev) => ev !== null)
          .map((ev) => formatEventData(ev))
          .filter((ev) => ev.dateObj >= now)
        setFavorites(validFavs)
      }
    } else setFavorites([])
  }, [session])

  useEffect(() => {
    //eslint-disable-next-line
    fetchAllEvents()
  }, [fetchAllEvents])

  const filterList = useCallback(
    (list) => {
      return list.filter((e) => {
        const matchText = e.titulo
          .toLowerCase()
          .includes(filters.text.toLowerCase())
        const matchType = filters.type
          ? filters.type
              .toLowerCase()
              .split(',')
              .some((val) => e.tipo?.toLowerCase().trim() === val.trim())
          : true
        return matchText && matchType
      })
    },
    [filters],
  )

  const filteredUpcoming = useMemo(
    () => filterList(events.upcoming),
    [events.upcoming, filterList],
  )
  const filteredPast = useMemo(
    () => filterList(events.past),
    [events.past, filterList],
  )

  const handleOpenModal = () => {
    if (!session)
      return toast.current.show({
        severity: 'warn',
        summary: 'Acceso',
        detail: 'Inicia sesión para crear eventos.',
      })
    setShowModal(true)
  }

  const currentList = activeTab === 'upcoming' ? filteredUpcoming : filteredPast

  return (
    <PageTransition>
      <div className='technical-page-wrapper'>
        <Toast ref={toast} position='top-center' className='mt-6 z-5' />

        <div className='max-w-8xl mx-auto'>
          <div className='grid grid-nogutter'>
            {/* === BARRA LATERAL FIJA === */}
            <div className='col-12 lg:col-3 lg:pr-5 relative'>
              <div className='sticky-sidebar py-6 px-4 lg:px-0'>
                <div className='mb-6'>
                  <h1 className='text-4xl font-black m-0 tracking-tight text-900'>
                    Agenda de Eventos
                  </h1>
                  <p className='text-500 font-medium mt-2'>
                    Explora las KDDs y rutas de la comunidad.
                  </p>

                  <Button
                    label='Crear Nuevo Evento'
                    icon={<Plus size={20} className='mr-2' />}
                    className='w-full mt-4 btn-create-modern'
                    onClick={handleOpenModal}
                  />
                </div>

                <div className='mb-6'>
                  <div className='text-xs font-bold text-400 uppercase tracking-widest mb-3 flex align-items-center gap-2'>
                    <Filter size={14} /> Filtros
                  </div>
                  <div className='technical-search mb-4'>
                    <Search size={16} className='search-icon' />
                    <input
                      type='text'
                      placeholder='Busca por nombre del evento...'
                      value={filters.text}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          text: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className='flex flex-column gap-2'>
                    {EVENT_TYPES.map((type, i) => (
                      <div
                        key={i}
                        // Aquí aplicamos el colorTheme dinámico a la clase active
                        className={`category-item ${filters.type === type.value ? `active theme-${type.theme}` : ''}`}
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            type: prev.type === type.value ? null : type.value,
                          }))
                        }
                      >
                        <span className='text-xl mr-2'>
                          {type.icon || <Grid size={16} />}
                        </span>
                        <span className='font-bold text-sm'>{type.label}</span>
                        {/* El indicador también cogerá el color por CSS */}
                        {filters.type === type.value && (
                          <div className='ml-auto w-2 h-2 border-circle indicator'></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {favorites.length > 0 && (
                  <div>
                    <div className='text-xs font-bold text-400 uppercase tracking-widest mb-3 flex align-items-center gap-2'>
                      <Heart size={14} /> Favoritos ({favorites.length})
                    </div>
                    <div className='flex flex-column gap-2'>
                      {favorites.slice(0, 3).map((fav) => (
                        <div
                          key={fav.id}
                          className='flex align-items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 border-round-md transition-colors'
                          onClick={() => navigate(`/evento/${fav.id}`)}
                        >
                          <img
                            src={fav.image}
                            alt=''
                            className='w-2rem h-2rem border-round-md object-cover'
                          />
                          <span className='text-sm font-bold text-700 white-space-nowrap overflow-hidden text-overflow-ellipsis'>
                            {fav.titulo}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* === CONTENIDO PRINCIPAL === */}
            <div className='col-12 lg:col-9 py-6 px-4 lg:pl-5 border-left-1 border-gray-200 content-area'>
              {/* DESTACADO */}
              {events.featured.length > 0 && !filters.text && !filters.type && (
                <div className='mb-8'>
                  <TechnicalCoverCard event={events.featured[0]} />
                </div>
              )}

              {/* TABS TÉCNICOS */}
              <div className='flex align-items-center justify-content-between mb-5 border-bottom-2 border-gray-100 pb-2'>
                <div className='flex gap-5'>
                  <button
                    className={`tech-tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
                    onClick={() => setActiveTab('upcoming')}
                  >
                    PRÓXIMOS{' '}
                    <span className='bg-gray-100 text-gray-900 px-2 py-0 border-round-sm text-xs ml-1'>
                      {filteredUpcoming.length}
                    </span>
                  </button>
                  <button
                    className={`tech-tab-btn ${activeTab === 'past' ? 'active' : ''}`}
                    onClick={() => setActiveTab('past')}
                  >
                    HISTORIAL{' '}
                    <span className='bg-gray-100 text-gray-600 px-2 py-0 border-round-sm text-xs ml-1'>
                      {filteredPast.length}
                    </span>
                  </button>
                </div>
                <div className='hidden md:flex text-400 gap-2'>
                  <List size={20} className='text-900' />
                  <Grid size={20} />
                </div>
              </div>

              {/* LISTA DE EVENTOS */}
              <div className='flex flex-column gap-4'>
                <AnimatePresence mode='popLayout'>
                  {currentList.length > 0 ? (
                    currentList.map((ev) => (
                      <MotionDiv
                        key={ev.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <TimelineEventCard
                          event={ev}
                          isPast={activeTab === 'past'}
                          session={session}
                        />
                      </MotionDiv>
                    ))
                  ) : (
                    <div className='text-center py-8 border-2 border-dashed border-gray-200 border-round-lg'>
                      <Layers
                        size={48}
                        className='text-gray-300 mb-3 mx-auto'
                      />
                      <h3 className='text-xl font-black text-gray-900 m-0'>
                        Sin resultados
                      </h3>
                      <p className='text-500 font-medium'>
                        Ajusta los filtros para encontrar eventos.
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
        <AddEventDialog
          visible={showModal}
          onHide={() => setShowModal(false)}
          onEventAdded={fetchAllEvents}
          session={session}
        />
      </div>
    </PageTransition>
  )
}

export default EventsPage
