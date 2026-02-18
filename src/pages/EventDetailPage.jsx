import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Tag } from 'primereact/tag'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Avatar } from 'primereact/avatar'
import { useFavorites } from '../hooks/useFavorites'
import PageTransition from '../components/PageTransition'

const EventDetailPage = ({ session }) => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [locationName, setLocationName] = useState('Cargando ubicación...')

  const {
    isFavorite,
    toggleFavorite,
    loading: favLoading,
  } = useFavorites(id, session)

  useEffect(() => {
    const fetchEvent = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, profiles(*)')
        .eq('id', id)
        .single()

      if (!error && data) {
        setEvent(data)

        // --- LÓGICA DE UBICACIÓN INTELIGENTE ---
        if (data.ubicacion && data.ubicacion.trim().length > 0) {
          setLocationName(data.ubicacion)
        } else if (data.lat && data.lng) {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${data.lat}&lon=${data.lng}`,
            )
            const geoData = await response.json()
            const addr = geoData.address
            const locality =
              addr.city ||
              addr.town ||
              addr.village ||
              addr.municipality ||
              'Ubicación en mapa'
            const fullLocality = addr.road
              ? `${addr.road}, ${locality}`
              : locality

            setLocationName(fullLocality)
          } catch (err) {
            console.error(err)
            setLocationName('Ubicación exacta en mapa')
          }
        } else {
          setLocationName('Ubicación no especificada')
        }
      }
      setLoading(false)
    }
    fetchEvent()
  }, [id])

  if (loading)
    return (
      <div className='flex justify-content-center align-items-center min-h-screen'>
        <ProgressSpinner />
      </div>
    )
  if (!event)
    return (
      <div className='text-center p-6 text-xl'>
        Evento no encontrado o eliminado.
      </div>
    )

  const dateObj = new Date(event.fecha)
  const fullDate = dateObj.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const time = dateObj.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const isPast = dateObj < new Date()

  // --- GENERACIÓN DE ENLACES DE MAPAS ---
  const queryParam =
    event.lat && event.lng
      ? `${event.lat},${event.lng}`
      : encodeURIComponent(locationName)

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${queryParam}`
  const appleMapsUrl = `http://maps.apple.com/?q=${queryParam}`
  const wazeUrl = `https://waze.com/ul?ll=${event.lat},${event.lng}&navigate=yes`

  return (
    <PageTransition>
      <div className='min-h-screen surface-ground pb-6'>
        {/* 1. Cabecera con Imagen Grande */}
        <div className='relative w-full h-20rem md:h-30rem overflow-hidden'>
          <img
            src={
              event.image_url ||
              `https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1920&q=80`
            }
            alt={event.titulo}
            className='w-full h-full object-cover'
          />
          <div className='absolute top-0 left-0 w-full h-full bg-black-alpha-40 flex flex-column justify-content-end p-4 md:p-6'>
            <div className='max-w-5xl mx-auto w-full'>
              <Button
                icon='pi pi-arrow-left'
                label='Volver'
                className='mb-3 p-button-text text-white'
                onClick={() => navigate(-1)}
              />
              <Tag
                value={event.tipo}
                severity='info'
                className='mb-2 text-base px-3 py-1'
              />
              <h1 className='text-white text-4xl md:text-6xl font-bold m-0 shadow-1'>
                {event.titulo}
              </h1>
              <div className='flex align-items-center gap-3 text-white mt-3 text-lg md:text-xl font-medium'>
                <span>
                  <i className='pi pi-calendar mr-2'></i> {fullDate}
                </span>
                <span>
                  <i className='pi pi-clock mr-2'></i> {time}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Contenido Principal */}
        <div className='max-w-5xl mx-auto p-4 md:p-6 -mt-4 relative z-1'>
          <div className='grid'>
            {/* Columna Izquierda: Info Principal */}
            <div className='col-12 md:col-8'>
              <Card className='shadow-2 border-round-xl mb-4'>
                <h2 className='text-2xl font-bold text-900 mb-3'>
                  Sobre este evento
                </h2>
                {/* CORRECCIÓN AQUI: wordBreak: 'break-word' evita que el texto se salga */}
                <p
                  className='line-height-3 text-700 text-lg pre-wrap'
                  style={{ wordBreak: 'break-word' }}
                >
                  {event.description ||
                    'El organizador no ha proporcionado una descripción detallada.'}
                </p>
              </Card>

              {/* Sección de Ubicación con Multi-Mapas */}
              <Card className='shadow-2 border-round-xl'>
                <h2 className='text-2xl font-bold text-900 mb-3'>Ubicación</h2>
                <div className='flex align-items-center gap-3 mb-4 text-700 text-lg'>
                  <i className='pi pi-map-marker text-red-500 text-2xl'></i>
                  <span className='font-medium'>{locationName}</span>
                </div>

                <div className='text-500 mb-2 font-semibold text-sm uppercase'>
                  Abrir ruta con:
                </div>
                <div className='flex flex-wrap gap-2'>
                  <a
                    href={googleMapsUrl}
                    target='_blank'
                    rel='noreferrer'
                    className='no-underline flex-1 md:flex-none'
                  >
                    <Button
                      label='Google Maps'
                      icon='pi pi-google'
                      severity='secondary'
                      outlined
                      className='w-full'
                    />
                  </a>

                  <a
                    href={appleMapsUrl}
                    target='_blank'
                    rel='noreferrer'
                    className='no-underline flex-1 md:flex-none'
                  >
                    <Button
                      label='Apple Maps'
                      icon='pi pi-apple'
                      severity='secondary'
                      outlined
                      className='w-full'
                    />
                  </a>

                  <a
                    href={wazeUrl}
                    target='_blank'
                    rel='noreferrer'
                    className='no-underline flex-1 md:flex-none'
                  >
                    <Button
                      label='Waze'
                      icon='pi pi-map'
                      severity='secondary'
                      outlined
                      className='w-full'
                    />
                  </a>
                </div>
              </Card>
            </div>

            {/* Columna Derecha: Sidebar */}
            <div className='col-12 md:col-4'>
              <Card className='shadow-2 border-round-xl mb-4 text-center'>
                <div className='text-500 mb-2 font-medium'>¿Te interesa?</div>
                <Button
                  label={
                    isFavorite ? 'Guardado en Favoritos' : 'Añadir a Favoritos'
                  }
                  icon={isFavorite ? 'pi pi-heart-fill' : 'pi pi-heart'}
                  severity='danger'
                  className={`w-full mb-2 ${isFavorite ? '' : 'p-button-outlined'}`}
                  onClick={toggleFavorite}
                  loading={favLoading}
                  disabled={isPast}
                />
                {isPast && (
                  <Tag
                    severity='warning'
                    value='Este evento ya ha finalizado'
                    className='w-full mt-2'
                  />
                )}
              </Card>

              <Card className='shadow-2 border-round-xl'>
                <div className='text-900 font-bold mb-3'>Organizado por</div>
                <div
                  className='flex align-items-center gap-3 cursor-pointer hover:surface-100 p-2 border-round transition-colors'
                  onClick={() => navigate(`/usuario/${event.user_id}`)}
                >
                  <Avatar
                    image={event.profiles?.avatar_url}
                    icon='pi pi-user'
                    size='large'
                    shape='circle'
                    className='bg-blue-100 text-blue-600'
                  />
                  <div>
                    <div className='font-bold text-lg'>
                      {event.profiles?.username || 'Usuario Anónimo'}
                    </div>
                    <div className='text-500 text-sm'>Ver perfil</div>
                  </div>
                  <i className='pi pi-chevron-right ml-auto text-400'></i>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}

export default EventDetailPage
