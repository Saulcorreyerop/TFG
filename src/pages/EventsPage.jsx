import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { TabView, TabPanel } from 'primereact/tabview'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Toast } from 'primereact/toast'
import { addLocale } from 'primereact/api'
import AddEventDialog from '../components/AddEventDialog'
import { useFavorites } from '../hooks/useFavorites'
import PageTransition from '../components/PageTransition'

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

const EventCard = React.memo(({ event, isPast = false, session }) => {
  const { isFavorite, toggleFavorite, loading } = useFavorites(
    event.id,
    session,
  )
  const navigate = useNavigate()

  return (
    <div className='col-12 md:col-6 lg:col-4 p-3 flex'>
      <div
        className={`surface-card shadow-3 border-round-2xl overflow-hidden flex flex-column w-full transition-all transition-duration-300 hover:shadow-6 hover:-translate-y-1 ${isPast ? 'opacity-70 grayscale-1' : ''}`}
      >
        <div className='relative h-16rem w-full bg-gray-900'>
          <img
            src={event.image}
            alt={event.titulo}
            className='w-full h-full'
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            loading='lazy'
          />
          <div className='absolute top-0 left-0 w-full h-full bg-gradient-to-t from-black-alpha-80 via-transparent to-black-alpha-20'></div>

          <div className='absolute top-0 right-0 m-3 z-2'>
            <Tag
              value={event.tipo}
              severity={isPast ? 'secondary' : 'info'}
              className='shadow-2 px-3 py-1 font-bold'
            />
          </div>
          {isPast && (
            <Tag
              value='FINALIZADO'
              severity='danger'
              className='absolute top-0 left-0 m-3 z-2 shadow-2 px-3 py-1 font-bold'
            />
          )}

          <div className='absolute bottom-0 left-0 w-full p-4 z-2 flex justify-content-between align-items-end'>
            <div className='text-white font-medium text-sm drop-shadow-md flex align-items-center gap-2'>
              <i className='pi pi-calendar text-xl'></i>
              <span className='font-bold text-base'>{event.formattedDate}</span>
            </div>
          </div>
        </div>

        <div className='p-4 flex flex-column justify-content-between flex-grow-1 surface-overlay'>
          <div className='mb-auto'>
            <div className='text-blue-500 font-bold text-xs mb-2 uppercase tracking-widest'>
              <i className='pi pi-clock mr-1'></i> {event.time}
            </div>
            <h3
              className='text-2xl font-extrabold text-900 mt-0 mb-3 line-height-2'
              title={event.titulo}
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {event.titulo}
            </h3>
            <p
              className='text-600 line-height-3 text-sm mb-4 m-0 font-medium'
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                minHeight: '4.5em',
              }}
            >
              {event.description || 'Sin descripción detallada.'}
            </p>
          </div>

          <div className='border-top-1 surface-border pt-3 flex align-items-center justify-content-between mt-3'>
            <div
              className='flex align-items-center gap-2 text-sm text-600 font-bold cursor-pointer hover:text-blue-500 transition-colors overflow-hidden'
              onClick={() =>
                event.user_id && navigate(`/usuario/${event.user_id}`)
              }
            >
              <div
                className='bg-blue-50 text-blue-600 border-circle flex align-items-center justify-content-center flex-shrink-0'
                style={{ width: '32px', height: '32px' }}
              >
                <i className='pi pi-user text-sm'></i>
              </div>
              <span className='white-space-nowrap overflow-hidden text-overflow-ellipsis'>
                {event.profiles?.username || 'Anónimo'}
              </span>
            </div>

            <div className='flex gap-2 flex-shrink-0'>
              <Button
                icon={isFavorite ? 'pi pi-heart-fill' : 'pi pi-heart'}
                rounded
                text
                severity={isPast ? 'secondary' : 'danger'}
                onClick={toggleFavorite}
                loading={loading}
                disabled={isPast}
                className='w-2.5rem h-2.5rem hover:surface-200'
              />
              <Button
                icon='pi pi-arrow-right'
                rounded
                className={
                  isPast
                    ? 'p-button-secondary w-2.5rem h-2.5rem'
                    : 'p-button-primary w-2.5rem h-2.5rem'
                }
                onClick={() => navigate(`/evento/${event.id}`)}
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
  const [favorites, setFavorites] = useState([])
  const [filters, setFilters] = useState({ text: '', type: null })
  const [showModal, setShowModal] = useState(false)
  const toast = useRef(null)

  const fetchAllEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, profiles(username)')
      .order('fecha', { ascending: false })

    if (!error && data) {
      const now = new Date()
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
        setFavorites(validFavs)
      }
    } else {
      setFavorites([])
    }
  }, [session])

  useEffect(() => {
    fetchAllEvents()
    //eslint-disable-next-line react-hooks/exhaustive-deps
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
    <PageTransition>
      <div className='min-h-screen surface-ground p-3 md:p-5'>
        <Toast ref={toast} position='top-center' className='mt-6 z-5' />

        <div className='text-center mb-6'>
          <h1 className='text-5xl font-extrabold text-900 mb-3 tracking-tight'>
            Agenda de Eventos
          </h1>
          <p className='text-600 text-xl font-medium max-w-3xl mx-auto'>
            Explora todas las concentraciones, rutas y trackdays de la
            comunidad.
          </p>
          <Button
            label='Publicar Evento'
            icon='pi pi-plus'
            size='large'
            className='mt-4 p-button-rounded p-button-primary shadow-4 font-bold px-5'
            onClick={handleOpenModal}
          />
        </div>

        {favorites.length > 0 && !filters.text && !filters.type && (
          <div className='mb-7 fadein animation-duration-500'>
            <div className='flex align-items-center mb-4 ml-3'>
              <div className='bg-pink-100 border-round p-2 mr-3'>
                <i className='pi pi-heart-fill text-pink-500 text-xl'></i>
              </div>
              <h2 className='text-3xl font-extrabold text-900 m-0'>
                Tus Favoritos
              </h2>
            </div>
            <div className='grid align-items-stretch'>
              {favorites.map((ev) => (
                <EventCard key={`fav-${ev.id}`} event={ev} session={session} />
              ))}
            </div>
          </div>
        )}

        {events.featured.length > 0 && !filters.text && !filters.type && (
          <div className='mb-7 fadein animation-duration-500'>
            <div className='flex align-items-center mb-4 ml-3'>
              <div className='bg-blue-100 border-round p-2 mr-3'>
                <i className='pi pi-star-fill text-blue-500 text-xl'></i>
              </div>
              <h2 className='text-3xl font-extrabold text-900 m-0'>
                Destacados de la Semana
              </h2>
            </div>
            <div className='grid'>
              {events.featured.map((event) => (
                <div key={`feat-${event.id}`} className='col-12 lg:col-6 p-3'>
                  <div className='surface-card shadow-4 border-round-2xl overflow-hidden flex flex-column md:flex-row h-full transition-all hover:shadow-6 hover:-translate-y-1'>
                    <div className='w-full md:w-5 relative h-16rem md:h-auto bg-gray-900 flex-shrink-0'>
                      <img
                        src={event.image}
                        className='w-full h-full'
                        style={{ objectFit: 'cover', objectPosition: 'center' }}
                        alt={event.titulo}
                      />
                      <div className='absolute inset-0 bg-gradient-to-t from-black-alpha-70 to-transparent md:hidden'></div>
                      <Tag
                        severity='warning'
                        value='¡MUY PRONTO!'
                        className='absolute bottom-0 left-0 m-3 z-2 shadow-2 font-bold px-3 py-2'
                      />
                    </div>
                    <div className='w-full md:w-7 p-5 flex flex-column justify-content-center flex-grow-1 surface-overlay'>
                      <div className='flex align-items-center gap-2 mb-3'>
                        <Tag
                          value={event.tipo}
                          severity='info'
                          className='px-3 font-bold'
                        />
                        <span className='text-500 font-bold text-sm'>
                          <i className='pi pi-calendar mr-1'></i>{' '}
                          {event.formattedDate}
                        </span>
                      </div>
                      <h3 className='text-3xl font-extrabold text-900 mt-0 mb-3 line-height-2'>
                        {event.titulo}
                      </h3>
                      <p
                        className='text-600 mb-5 line-height-3 text-lg font-medium'
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {event.description}
                      </p>
                      <Button
                        label='Ver Info Completa'
                        icon='pi pi-arrow-right'
                        iconPos='right'
                        className='w-full mt-auto p-button-outlined p-button-primary border-2 font-bold p-3'
                        onClick={() =>
                          window.location.assign(`/evento/${event.id}`)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className='surface-card mb-5 p-4 border-round-2xl shadow-2 flex flex-column md:flex-row gap-4 justify-content-between align-items-center border-1 surface-border'>
          <div className='flex align-items-center gap-3 w-full md:w-auto font-bold text-900 text-xl'>
            <div className='bg-blue-50 text-blue-500 p-3 border-round-xl'>
              <i className='pi pi-filter text-xl'></i>
            </div>
            Explorar Eventos
          </div>
          <div className='flex flex-column md:flex-row gap-3 w-full md:w-auto'>
            <Dropdown
              value={filters.type}
              options={EVENT_TYPES}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, type: e.value }))
              }
              placeholder='Todos los tipos'
              className='w-full md:w-15rem border-round-lg'
              showClear
            />
            <span className='p-input-icon-left w-full md:w-20rem'>
              <i className='pi pi-search text-500' />
              <InputText
                placeholder='Buscar por título...'
                className='w-full border-round-lg'
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

        <div className='shadow-2 border-round-2xl overflow-hidden surface-card'>
          <TabView className='event-tabs'>
            <TabPanel
              header={`Próximos (${filteredUpcoming.length})`}
              headerClassName='text-lg font-bold'
            >
              <div className='grid align-items-stretch mt-3'>
                {filteredUpcoming.length > 0 ? (
                  filteredUpcoming.map((ev) => (
                    <EventCard key={ev.id} event={ev} session={session} />
                  ))
                ) : (
                  <div className='col-12 text-center py-8'>
                    <div
                      className='bg-gray-100 border-circle inline-flex justify-content-center align-items-center mb-4'
                      style={{ width: '80px', height: '80px' }}
                    >
                      <i className='pi pi-calendar-times text-4xl text-gray-400'></i>
                    </div>
                    <h3 className='text-900 font-extrabold text-2xl mb-2'>
                      No hay eventos
                    </h3>
                    <p className='text-600 text-lg font-medium'>
                      No hemos encontrado próximos eventos con esos filtros.
                    </p>
                  </div>
                )}
              </div>
            </TabPanel>

            <TabPanel
              header={`Historial (${filteredPast.length})`}
              headerClassName='text-lg font-bold'
            >
              <div className='grid align-items-stretch mt-3'>
                {filteredPast.length > 0 ? (
                  filteredPast.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      isPast
                      session={session}
                    />
                  ))
                ) : (
                  <div className='col-12 text-center py-8'>
                    <p className='text-600 text-lg font-medium'>
                      No hay eventos en el historial con estos criterios.
                    </p>
                  </div>
                )}
              </div>
            </TabPanel>
          </TabView>
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
