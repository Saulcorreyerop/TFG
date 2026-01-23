import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Carousel } from 'primereact/carousel'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'

const EventCarousel = () => {
  const [events, setEvents] = useState([])

  useEffect(() => {
    const fetchEvents = async () => {
      // Pedimos eventos a Supabase
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('fecha', { ascending: true }) // Los más cercanos primero
        .limit(9) // Traemos máximo 9

      if (!error && data) {
        // Preparamos los datos para que se vean bonitos
        const eventsWithImages = data.map((ev) => ({
          ...ev,
          date: new Date(ev.fecha).toLocaleDateString(),
          location: 'España', // Ubicación genérica
          // Foto aleatoria de coches
          image: `https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=600&q=80&random=${ev.id}`,
          status: 'CONFIRMADO',
        }))
        setEvents(eventsWithImages)
      }
    }

    fetchEvents()
  }, [])

  const responsiveOptions = [
    { breakpoint: '1199px', numVisible: 3, numScroll: 1 },
    { breakpoint: '991px', numVisible: 2, numScroll: 1 },
    { breakpoint: '767px', numVisible: 1, numScroll: 1 },
  ]

  // Diseño de CADA TARJETA (Aquí no hay mapa, solo imagen y texto)
  const eventTemplate = (event) => {
    return (
      <div className='border-1 surface-border border-round m-2 text-center py-5 px-3 bg-white shadow-1'>
        <div className='mb-3 relative'>
          <img
            src={event.image}
            alt={event.titulo}
            className='w-full border-round shadow-2'
            style={{ height: '200px', objectFit: 'cover' }}
          />
          <Tag
            value={event.status}
            severity='success'
            className='absolute'
            style={{ left: '5px', top: '5px' }}
          />
        </div>
        <div>
          <h4 className='mb-1 text-900 font-bold'>{event.titulo}</h4>
          <span className='text-blue-600 font-bold text-sm block mb-2'>
            {event.tipo}
          </span>
          <h6 className='mt-0 mb-3 text-600 font-medium'>
            <i className='pi pi-calendar mr-1'></i>
            {event.date}
          </h6>
          <div className='mt-4 flex gap-2 justify-content-center'>
            <Button
              icon='pi pi-search'
              className='p-button-rounded p-button-text'
              tooltip='Ver Detalles'
            />
            <Button
              icon='pi pi-heart'
              className='p-button-rounded p-button-outlined p-button-danger'
              tooltip='Me gusta'
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className='py-6 surface-ground'>
      <h3 className='text-center text-900 text-3xl mb-4 font-bold'>
        Últimos Eventos Creados
      </h3>
      <div className='card'>
        {events.length > 0 ? (
          <Carousel
            value={events}
            numVisible={3}
            numScroll={1}
            responsiveOptions={responsiveOptions}
            itemTemplate={eventTemplate}
            circular
            autoplayInterval={3000}
          />
        ) : (
          <div className='text-center py-5'>
            <i className='pi pi-spin pi-spinner text-4xl text-blue-500 mb-3'></i>
            <p className='text-600'>Cargando eventos de la comunidad...</p>
          </div>
        )}
      </div>
    </section>
  )
}

export default EventCarousel
