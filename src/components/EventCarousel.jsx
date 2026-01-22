import React, { useState } from 'react'
import { Carousel } from 'primereact/carousel'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'

const EventCarousel = () => {
  // CAMBIO: Iniciamos los datos directamente aquí (sin useEffect)
  const [events] = useState([
    {
      id: 1,
      name: 'EuroCrew Spain',
      date: '15 MAY',
      location: 'Valencia',
      image:
        'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&q=80&w=600',
      status: 'CONFIRMADO',
    },
    {
      id: 2,
      name: 'Ruta de Montaña',
      date: '22 MAY',
      location: 'Sierra de Madrid',
      image:
        'https://images.unsplash.com/photo-1532974297617-c0f05fe48bff?auto=format&fit=crop&q=80&w=600',
      status: 'PLAZAS LIMITADAS',
    },
    {
      id: 3,
      name: 'JDM Fest',
      date: '05 JUN',
      location: 'Barcelona',
      image:
        'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=600',
      status: 'ABIERTO',
    },
    {
      id: 4,
      name: 'Clásicos del Sur',
      date: '12 JUN',
      location: 'Sevilla',
      image:
        'https://images.unsplash.com/photo-1469037784699-75dcff1cbf75?auto=format&fit=crop&q=80&w=600',
      status: 'CONFIRMADO',
    },
  ])

  const responsiveOptions = [
    { breakpoint: '1199px', numVisible: 3, numScroll: 1 },
    { breakpoint: '991px', numVisible: 2, numScroll: 1 },
    { breakpoint: '767px', numVisible: 1, numScroll: 1 },
  ]

  const eventTemplate = (event) => {
    return (
      <div className='border-1 surface-border border-round m-2 text-center py-5 px-3 bg-gray-900'>
        <div className='mb-3 relative'>
          <img
            src={event.image}
            alt={event.name}
            className='w-full border-round shadow-2'
            style={{ height: '200px', objectFit: 'cover' }}
          />
          <Tag
            value={event.status}
            severity={event.status === 'CONFIRMADO' ? 'success' : 'warning'}
            className='absolute'
            style={{ left: '5px', top: '5px' }}
          />
        </div>
        <div>
          <h4 className='mb-1 text-white'>{event.name}</h4>
          <h6 className='mt-0 mb-3 text-blue-400'>
            <i className='pi pi-map-marker mr-1'></i>
            {event.location} | {event.date}
          </h6>
          <div className='mt-4 flex gap-2 justify-content-center'>
            <Button
              icon='pi pi-search'
              className='p-button p-button-rounded'
              tooltip='Ver Detalles'
            />
            <Button
              icon='pi pi-star-fill'
              className='p-button-success p-button-rounded p-button-outlined'
              tooltip='Me interesa'
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className='py-6 bg-black-alpha-90'>
      <h3 className='text-center text-white text-3xl mb-4'>
        Próximos Eventos Destacados
      </h3>
      <div className='card'>
        {/* Corregido también el error de mayúsculas 'autoplayInterval' */}
        <Carousel
          value={events}
          numVisible={3}
          numScroll={1}
          responsiveOptions={responsiveOptions}
          itemTemplate={eventTemplate}
          circular
          autoplayInterval={3000}
        />
      </div>
    </section>
  )
}

export default EventCarousel
