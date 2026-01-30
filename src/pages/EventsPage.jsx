import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { TabView, TabPanel } from 'primereact/tabview'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Toast } from 'primereact/toast'
import { Card } from 'primereact/card'
import { addLocale } from 'primereact/api'
import AddEventDialog from '../components/AddEventDialog'
import { useFavorites } from '../hooks/useFavorites'

// Configuración global
addLocale('es', {
  firstDayOfWeek: 1,
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
  today: 'Hoy',
  clear: 'Limpiar',
})

const EVENT_TYPES = [
  { label: 'Todos los tipos', value: null },
  { label: 'Stance / Expo', value: 'Exposición' },
  { label: 'Ruta / Tramo', value: 'Tramo' },
  { label: 'Circuito / Trackday', value: 'Circuito' },
  { label: 'Clásicos', value: 'Clasicos' },
  { label: 'Off-road / 4x4', value: 'Offroad' },
]

// Helper para formatear eventos (usado para lista general y favoritos)
const formatEventData = (ev) => {
  const date = new Date(ev.fecha)
  return {
    ...ev,
    dateObj: date,
    formattedDate: date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
    time: date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    image:
      ev.image_url ||
      `https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80&random=${ev.id}`,
  }
}

// Componente Tarjeta
const EventCard = React.memo(({ event, isPast = false, session }) => {
  const { isFavorite, toggleFavorite, loading } = useFavorites(
    event.id,
    session,
  )

  return (
    <div className='col-12 md:col-6 lg:col-4 p-3'>
      <div
        className={`surface-card shadow-2 border-round-xl overflow-hidden h-full flex flex-column transition-all hover:shadow-5 ${isPast ? 'opacity-70 grayscale-1' : ''}`}
      >
        <div className='relative h-14rem'>
          <img
            src={event.image}
            alt={event.titulo}
            className='w-full h-full object-cover'
            loading='lazy'
          />
          <div className='absolute top-0 right-0 m-2'>
            <Tag value={event.tipo} severity={isPast ? 'secondary' : 'info'} />
          </div>
          {isPast && (
            <Tag
              value='FINALIZADO'
              severity='danger'
              className='absolute top-0 left-0 m-2'
            />
          )}
        </div>

        <div className='p-4 flex flex-column justify-content-between flex-grow-1'>
          <div>
            <div className='text-500 font-medium text-sm mb-2'>
              <i className='pi pi-calendar mr-1'></i> {event.formattedDate} •{' '}
              {event.time}
            </div>
            <h3 className='text-xl font-bold text-900 mt-0 mb-2'>
              {event.titulo}
            </h3>
            <p className='text-600 line-height-3 text-sm line-clamp-3 mb-4'>
              {event.description || 'Sin descripción detallada.'}
            </p>
          </div>

          <div className='border-top-1 surface-border pt-3 flex align-items-center justify-content-between'>
            <span className='text-sm text-500'>
              <i className='pi pi-user mr-1'></i>{' '}
              {event.profiles?.username || 'Anónimo'}
            </span>

            <div className='flex gap-2'>
              <Button
                icon={isFavorite ? 'pi pi-heart-fill' : 'pi pi-heart'}
                rounded
                text
                severity='danger'
                onClick={toggleFavorite}
                loading={loading}
                tooltip='Guardar en favoritos'
              />
              <Button
                label='Ver Detalles'
                icon='pi pi-external-link'
                size='small'
                outlined
                className={isPast ? 'p-button-secondary' : ''}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

const EventsPage = ({ session }) => {
  const [events, setEvents] = useState({ upcoming: [], past: [], featured: [] })
  // NUEVO ESTADO PARA FAVORITOS
  const [favorites, setFavorites] = useState([])

  const [filters, setFilters] = useState({ text: '', type: null })
  const [showModal, setShowModal] = useState(false)
  const toast = useRef(null)

  const fetchAllEvents = useCallback(async () => {
    // 1. Cargar TODOS los eventos
    const { data, error } = await supabase
      .from('events')
      .select('*, profiles(username)')
      .order('fecha', { ascending: false })

    if (!error && data) {
      const now = new Date()
      // Usamos el helper para formatear
      const processed = data.map((ev) => formatEventData(ev))

      const future = processed
        .filter((ev) => ev.dateObj >= now)
        .sort((a, b) => a.dateObj - b.dateObj)

      setEvents({
        upcoming: future,
        past: processed
          .filter((ev) => ev.dateObj < now)
          .sort((a, b) => b.dateObj - a.dateObj),
        featured: future.slice(0, 2),
      })
    }

    // 2. Cargar FAVORITOS (Solo si hay sesión)
    if (session) {
      const { data: favData, error: favError } = await supabase
        .from('favorites')
        .select('event_id, events(*, profiles(username))') // Join con events y profiles
        .eq('user_id', session.user.id)

      if (!favError && favData) {
        // Extraemos el objeto 'events' y lo formateamos
        const validFavs = favData
          .map((item) => item.events) // Sacamos el evento anidado
          .filter((ev) => ev !== null) // Filtramos nulos por seguridad
          .map((ev) => formatEventData(ev)) // Formateamos igual que los demás

        setFavorites(validFavs)
      }
    } else {
      setFavorites([]) // Si no hay sesión, vaciamos favoritos
    }
  }, [session])

  useEffect(() => {
    fetchAllEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAllEvents])

  const filterList = useCallback(
    (list) => {
      return list.filter((e) => {
        const matchText = e.titulo
          .toLowerCase()
          .includes(filters.text.toLowerCase())
        const matchType = filters.type ? e.tipo === filters.type : true
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

  return (
    <div className='min-h-screen surface-ground p-3 md:p-5'>
      <Toast ref={toast} position='top-center' className='mt-6 z-5' />

      {/* Título */}
      <div className='text-center mb-6'>
        <h1 className='text-4xl font-extrabold text-900 mb-2'>
          Agenda de Eventos
        </h1>
        <p className='text-700 text-lg'>
          Explora todas las concentraciones, rutas y trackdays de la comunidad.
        </p>
        <Button
          label='Publicar Evento'
          icon='pi pi-plus'
          className='mt-3 p-button-rounded shadow-3'
          onClick={handleOpenModal}
        />
      </div>

      {/* --- SECCIÓN NUEVA: TUS FAVORITOS --- */}
      {/* Se renderiza solo si hay favoritos y no hay filtros activos (opcional, para que siempre estén visibles) */}
      {favorites.length > 0 && !filters.text && !filters.type && (
        <div className='mb-6 fadein animation-duration-500'>
          <h2 className='text-2xl font-bold text-900 mb-3 ml-2 border-left-3 border-pink-500 pl-3 flex align-items-center gap-2'>
            <i className='pi text-pink-500'></i> Tus Favoritos
          </h2>
          <div className='grid'>
            {favorites.map((ev) => (
              <EventCard key={`fav-${ev.id}`} event={ev} session={session} />
            ))}
          </div>
          {/* Separador visual */}
          <div className='border-bottom-1 surface-border my-5'></div>
        </div>
      )}

      {/* Destacados (Se ocultan si se filtra) */}
      {events.featured.length > 0 && !filters.text && !filters.type && (
        <div className='mb-6 fadein animation-duration-500'>
          <h2 className='text-2xl font-bold text-900 mb-3 ml-2 border-left-3 border-blue-500 pl-3'>
            Destacados de la Semana
          </h2>
          <div className='grid'>
            {events.featured.map((event) => (
              <div key={`feat-${event.id}`} className='col-12 md:col-6 p-2'>
                <div className='surface-card shadow-3 border-round-xl overflow-hidden flex flex-column md:flex-row h-full'>
                  <div className='w-full md:w-5 relative h-15rem md:h-auto'>
                    <img
                      src={event.image}
                      className='w-full h-full object-cover'
                      alt={event.titulo}
                    />
                    <Tag
                      severity='warning'
                      value='¡MUY PRONTO!'
                      rounded
                      className='absolute bottom-0 left-0 m-2'
                    />
                  </div>
                  <div className='w-full md:w-7 p-4 flex flex-column justify-content-center'>
                    <h3 className='text-2xl font-bold mb-2'>{event.titulo}</h3>
                    <div className='flex align-items-center gap-2 mb-3'>
                      <Tag value={event.tipo} severity='info' />
                      <span className='text-600 text-sm'>
                        <i className='pi pi-calendar'></i> {event.formattedDate}
                      </span>
                    </div>
                    <p className='text-600 mb-4 line-clamp-2'>
                      {event.description}
                    </p>
                    <Button
                      label='Ver Info Completa'
                      className='w-full'
                      outlined
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className='card mb-4 p-3 border-round-xl shadow-1 surface-card flex flex-column md:flex-row gap-3 justify-content-between align-items-center'>
        <div className='flex align-items-center gap-2 w-full md:w-auto font-bold text-900'>
          <i className='pi pi-filter text-blue-500 text-xl'></i> Filtrar por:
        </div>
        <div className='flex flex-column md:flex-row gap-3 w-full md:w-auto'>
          <Dropdown
            value={filters.type}
            options={EVENT_TYPES}
            onChange={(e) => setFilters((prev) => ({ ...prev, type: e.value }))}
            placeholder='Tipo de Evento'
            className='w-full md:w-15rem'
            showClear
          />
          <span className='p-input-icon-left w-full md:w-20rem'>
            <i className=' pl-2 pi pi-search' />
            <InputText
              placeholder='Buscar por título...'
              className='pl-5 w-full'
              value={filters.text}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, text: e.target.value }))
              }
            />
          </span>
          {(filters.text || filters.type) && (
            <Button
              icon='pi pi-times'
              rounded
              text
              severity='danger'
              onClick={() => setFilters({ text: '', type: null })}
              tooltip='Limpiar filtros'
            />
          )}
        </div>
      </div>

      {/* Tabs Listado */}
      <Card className='shadow-1 border-round-xl'>
        <TabView>
          <TabPanel
            header={`Próximos (${filteredUpcoming.length})`}
            leftIcon='pi pi-calendar-plus mr-2'
          >
            <div className='grid mt-2'>
              {filteredUpcoming.length > 0 ? (
                filteredUpcoming.map((ev) => (
                  <EventCard key={ev.id} event={ev} session={session} />
                ))
              ) : (
                <div className='col-12 text-center py-5'>
                  <i className='pi pi-filter-slash text-4xl text-gray-300 mb-3'></i>
                  <p className='text-600'>
                    No hay eventos próximos con estos filtros.
                  </p>
                </div>
              )}
            </div>
          </TabPanel>

          <TabPanel
            header={`Historial (${filteredPast.length})`}
            leftIcon='pi pi-history mr-2'
          >
            <div className='grid mt-2'>
              {filteredPast.length > 0 ? (
                filteredPast.map((ev) => (
                  <EventCard key={ev.id} event={ev} isPast session={session} />
                ))
              ) : (
                <div className='col-12 text-center py-5'>
                  <p className='text-600'>
                    No hay eventos pasados con estos criterios.
                  </p>
                </div>
              )}
            </div>
          </TabPanel>
        </TabView>
      </Card>

      <AddEventDialog
        visible={showModal}
        onHide={() => setShowModal(false)}
        onEventAdded={fetchAllEvents}
        session={session}
      />
    </div>
  )
}

export default EventsPage
