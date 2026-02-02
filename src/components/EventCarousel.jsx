import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Carousel } from 'primereact/carousel'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import AddEventDialog from './AddEventDialog'
import { useFavorites } from '../hooks/useFavorites'
import { useNavigate } from 'react-router-dom' // <--- IMPORTADO

const RESPONSIVE_OPTIONS = [
  { breakpoint: '1199px', numVisible: 3, numScroll: 1 },
  { breakpoint: '991px', numVisible: 2, numScroll: 1 },
  { breakpoint: '767px', numVisible: 1, numScroll: 1 },
]

// --- SUB-COMPONENTE: Tarjeta Individual del Carrusel ---
const CarouselItem = ({ event, session }) => {
  const { isFavorite, toggleFavorite, loading } = useFavorites(
    event.id,
    session,
  )
  const navigate = useNavigate() // <--- HOOK PARA NAVEGAR

  return (
    <div className='p-3 h-full'>
      <div className='surface-card shadow-2 border-round-xl overflow-hidden hover:shadow-5 transition-all transition-duration-300 h-full flex flex-column'>
        {/* Imagen y Tags */}
        <div className='relative h-15rem w-full bg-gray-200'>
          <img
            src={event.image}
            alt={event.titulo}
            className='w-full h-full'
            style={{ objectFit: 'cover', display: 'block' }}
            loading='lazy'
          />
          <div className='absolute bottom-0 right-0 m-3'>
            <Tag
              value={event.tipo}
              severity='info'
              className='shadow-2'
              icon='pi pi-tag'
            />
          </div>
          <div
            className='absolute bottom-0 left-0 w-full h-3rem'
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.1), transparent)',
            }}
          ></div>
        </div>

        {/* Contenido */}
        <div className='p-4 flex flex-column justify-content-between flex-grow-1'>
          <div>
            <div className='flex align-items-center gap-2 text-500 text-sm font-semibold mb-2 uppercase tracking-wide'>
              <i className='pi pi-calendar text-blue-500'></i>
              <span>{event.formattedDate}</span>
            </div>
            <h4 className='text-xl font-bold text-900 mt-0 mb-2 line-height-3'>
              {event.titulo}
            </h4>
            {event.description && (
              <p
                className='text-600 text-sm line-height-3 m-0 mb-4 line-clamp-2'
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  height: '3em',
                }}
              >
                {event.description}
              </p>
            )}
          </div>

          {/* Footer de la tarjeta */}
          <div className='pt-3 border-top-1 surface-border flex align-items-center justify-content-between mt-auto'>
            {/* Usuario Clickable */}
            <div
              className='flex align-items-center gap-2 text-600 text-sm cursor-pointer hover:text-primary transition-colors'
              onClick={() =>
                event.user_id && navigate(`/usuario/${event.user_id}`)
              }
            >
              <div
                className='border-circle surface-300 flex align-items-center justify-content-center'
                style={{ width: '24px', height: '24px' }}
              >
                <i className='pi pi-user text-xs'></i>
              </div>
              <span
                className='font-medium text-overflow-ellipsis white-space-nowrap overflow-hidden'
                style={{ maxWidth: '80px' }}
              >
                {event.profiles?.username || 'Anónimo'}
              </span>
            </div>

            <div className='flex gap-2'>
              {/* BOTÓN DE FAVORITO */}
              <Button
                icon={isFavorite ? 'pi pi-heart-fill' : 'pi pi-heart'}
                rounded
                outlined={!isFavorite}
                severity='danger'
                className='w-2rem h-2rem'
                aria-label='Favorito'
                onClick={toggleFavorite}
                loading={loading}
              />
              {/* BOTÓN DE VER DETALLES */}
              <Button
                icon='pi pi-arrow-right'
                rounded
                className='w-2rem h-2rem'
                aria-label='Ver detalles'
                onClick={() => navigate(`/evento/${event.id}`)} // <--- ACCIÓN AÑADIDA
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- COMPONENTE PRINCIPAL ---
const EventCarousel = () => {
  const [events, setEvents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [currentUserSession, setCurrentUserSession] = useState(null)
  const toast = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserSession(session)
    })
  }, [])

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, profiles(username)')
      .gte('fecha', new Date().toISOString())
      .order('fecha', { ascending: true })
      .limit(9)

    if (!error && data) {
      const processedEvents = data.map((ev) => ({
        ...ev,
        formattedDate: new Date(ev.fecha).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        image:
          ev.image_url ||
          `https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80&random=${ev.id}`,
      }))
      setEvents(processedEvents)
    }
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
        detail: 'Debes iniciar sesión.',
        life: 3000,
      })
      return
    }
    setShowModal(true)
  }

  return (
    <section className='py-6 surface-ground relative'>
      <Toast ref={toast} position='top-center' className='mt-6 z-5' />

      <div className='text-center mb-5'>
        <h3 className='text-900 text-3xl font-bold mb-2'>Próximos Eventos</h3>
        <p className='text-600'>
          Descubre las mejores concentraciones cerca de ti
        </p>
      </div>

      <div className='flex justify-content-center mb-5'>
        <Button
          label='Publicar Evento'
          icon='pi pi-plus'
          rounded
          raised
          className='px-4 py-2 font-bold'
          onClick={handleOpenModal}
        />
      </div>

      <div className='card'>
        {events.length > 0 ? (
          <Carousel
            value={events}
            numVisible={3}
            numScroll={1}
            responsiveOptions={RESPONSIVE_OPTIONS}
            itemTemplate={(event) => (
              <CarouselItem event={event} session={currentUserSession} />
            )}
            circular
            autoplayInterval={4000}
            showIndicators={false}
          />
        ) : (
          <div className='text-center py-8 surface-card border-round shadow-1 mx-3'>
            <i className='pi pi-calendar-times text-6xl text-gray-300 mb-4'></i>
            <p className='text-700 text-xl font-medium'>
              No hay eventos próximos.
            </p>
          </div>
        )}
      </div>

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
