import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { TabView, TabPanel } from 'primereact/tabview'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown' // <--- NUEVO
import { Toast } from 'primereact/toast'
import { addLocale } from 'primereact/api'
import AddEventDialog from '../components/AddEventDialog'

// Configuración de Español
addLocale('es', {
  firstDayOfWeek: 1,
  dayNames: [
    'domingo',
    'lunes',
    'martes',
    'miércoles',
    'jueves',
    'viernes',
    'sábado',
  ],
  dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
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
  monthNamesShort: [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ],
  today: 'Hoy',
  clear: 'Limpiar',
})

const EventsPage = ({ session }) => {
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [pastEvents, setPastEvents] = useState([])
  const [featuredEvents, setFeaturedEvents] = useState([])

  // --- ESTADOS DE FILTRO ---
  const [filterText, setFilterText] = useState('')
  const [filterType, setFilterType] = useState(null)

  const [showModal, setShowModal] = useState(false)
  const toast = useRef(null)

  const tiposEvento = [
    { label: 'Todos los tipos', value: null },
    { label: 'Stance / Expo', value: 'Stance' },
    { label: 'Ruta / Tramo', value: 'Ruta' },
    { label: 'Circuito / Trackday', value: 'Racing' },
    { label: 'Clásicos', value: 'Clasicos' },
    { label: 'Off-road / 4x4', value: 'Offroad' },
  ]

  const fetchAllEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, profiles(username)')
      .order('fecha', { ascending: false })

    if (!error && data) {
      const now = new Date()

      const processedEvents = data.map((ev) => ({
        ...ev,
        dateObj: new Date(ev.fecha),
        formattedDate: new Date(ev.fecha).toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        time: new Date(ev.fecha).toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        image: ev.image_url
          ? ev.image_url
          : `https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=90&random=${ev.id}`,
      }))

      const future = processedEvents
        .filter((ev) => ev.dateObj >= now)
        .sort((a, b) => a.dateObj - b.dateObj)
      const past = processedEvents
        .filter((ev) => ev.dateObj < now)
        .sort((a, b) => b.dateObj - a.dateObj)

      setUpcomingEvents(future)
      setPastEvents(past)
      setFeaturedEvents(future.slice(0, 2))
    }
  }

  useEffect(() => {
    fetchAllEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpenModal = () => {
    if (!session) {
      toast.current.show({
        severity: 'warn',
        summary: 'Acceso',
        detail: 'Inicia sesión para crear eventos.',
      })
      return
    }
    setShowModal(true)
  }

  // --- LÓGICA DE FILTRADO COMBINADO ---
  const filterList = (list) => {
    return list.filter((e) => {
      // 1. Filtro por texto (título)
      const matchesText = e.titulo
        .toLowerCase()
        .includes(filterText.toLowerCase())
      // 2. Filtro por tipo (si hay uno seleccionado)
      const matchesType = filterType ? e.tipo === filterType : true

      return matchesText && matchesType
    })
  }

  // Limpiar filtros
  const clearFilters = () => {
    setFilterText('')
    setFilterType(null)
  }

  const EventCard = ({ event, isPast = false }) => (
    <div className='col-12 md:col-6 lg:col-4 p-3'>
      <div
        className={`surface-card shadow-2 border-round-xl overflow-hidden h-full flex flex-column transition-all hover:shadow-5 ${isPast ? 'opacity-80 grayscale-1' : ''}`}
      >
        <div className='relative h-14rem'>
          <img
            src={event.image}
            alt={event.titulo}
            className='w-full h-full object-cover'
          />
          <div className='absolute top-0 right-0 m-2'>
            <Tag value={event.tipo} severity={isPast ? 'secondary' : 'info'} />
          </div>
          {isPast && (
            <div className='absolute top-0 left-0 m-2'>
              <Tag value='FINALIZADO' severity='danger' />
            </div>
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
  )

  return (
    <div className='min-h-screen surface-ground p-3 md:p-5'>
      <Toast ref={toast} position='top-center' className='mt-6 z-5' />

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

      {featuredEvents.length > 0 && !filterText && !filterType && (
        <div className='mb-6'>
          <h2 className='text-2xl font-bold text-900 mb-3 ml-2 border-left-3 border-blue-500 pl-3'>
            Destacados de la Semana
          </h2>
          <div className='grid'>
            {featuredEvents.map((event) => (
              <div key={`feat-${event.id}`} className='col-12 md:col-6 p-2'>
                <div className='surface-card shadow-3 border-round-xl overflow-hidden flex flex-column md:flex-row h-full'>
                  <div className='w-full md:w-5 relative h-15rem md:h-auto'>
                    <img
                      src={event.image}
                      className='w-full h-full object-cover'
                      alt={event.titulo}
                    />
                    <div className='absolute bottom-0 left-0 m-2'>
                      <Tag severity='warning' value='¡MUY PRONTO!' rounded />
                    </div>
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
                    <Button label='Ver Info Completa' className='w-full' />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- BARRA DE HERRAMIENTAS DE FILTRADO --- */}
      <div className='card mb-4 p-3 border-round-xl shadow-1 surface-card flex flex-column md:flex-row gap-3 justify-content-between align-items-center'>
        <div className='flex align-items-center gap-2 w-full md:w-auto'>
          <i className='pi pi-filter text-blue-500 text-xl mr-2'></i>
          <span className='font-bold text-900'>Filtrar por:</span>
        </div>

        <div className='flex flex-column md:flex-row gap-3 w-full md:w-auto'>
          {/* Dropdown de Categoría */}
          <Dropdown
            value={filterType}
            options={tiposEvento}
            onChange={(e) => setFilterType(e.value)}
            placeholder='Tipo de Evento'
            className='w-full md:w-15rem'
            showClear
          />

          {/* Buscador de Texto */}
          <span className='p-input-icon-left w-full md:w-20rem'>
            <i className='pi pi-search' />
            <InputText
              placeholder='Buscar por título...'
              className='w-full'
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </span>

          {/* Botón limpiar */}
          {(filterText || filterType) && (
            <Button
              icon='pi pi-times'
              rounded
              text
              severity='danger'
              onClick={clearFilters}
              tooltip='Limpiar filtros'
            />
          )}
        </div>
      </div>

      <Card className='shadow-1 border-round-xl'>
        <TabView>
          <TabPanel
            header={`Próximos (${filterList(upcomingEvents).length})`}
            leftIcon='pi pi-calendar-plus mr-2'
          >
            <div className='grid mt-2'>
              {filterList(upcomingEvents).length > 0 ? (
                filterList(upcomingEvents).map((event) => (
                  <EventCard key={event.id} event={event} />
                ))
              ) : (
                <div className='col-12 text-center py-5'>
                  <i className='pi pi-filter-slash text-4xl text-gray-300 mb-3'></i>
                  <p className='text-600'>
                    No hay eventos que coincidan con tus filtros.
                  </p>
                </div>
              )}
            </div>
          </TabPanel>

          <TabPanel
            header={`Historial (${filterList(pastEvents).length})`}
            leftIcon='pi pi-history mr-2'
          >
            <div className='grid mt-2'>
              {filterList(pastEvents).length > 0 ? (
                filterList(pastEvents).map((event) => (
                  <EventCard key={event.id} event={event} isPast={true} />
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
