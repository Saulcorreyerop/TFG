import React, { useEffect, useState, useRef, useLayoutEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Avatar } from 'primereact/avatar'
import { AvatarGroup } from 'primereact/avatargroup'
import { Toast } from 'primereact/toast'
import { Dialog } from 'primereact/dialog'
import { useFavorites } from '../hooks/useFavorites'
import PageTransition from '../components/PageTransition'
import gsap from 'gsap'
import './EventDetailPage.css'

const EventDetailPage = ({ session }) => {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useRef(null)
  const containerRef = useRef(null)

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [locationName, setLocationName] = useState('Cargando ubicación...')
  const [attendees, setAttendees] = useState([])
  const [isAttending, setIsAttending] = useState(false)
  const [attendingLoading, setAttendingLoading] = useState(false)
  const [showAttendeesModal, setShowAttendeesModal] = useState(false)

  const {
    isFavorite,
    toggleFavorite,
    loading: favLoading,
  } = useFavorites(id, session)

  const fetchAttendees = async () => {
    try {
      const { data, error } = await supabase
        .from('event_attendees')
        .select('user_id')
        .eq('event_id', id)

      if (!error && data) {
        const userIds = data.map((d) => d.user_id)

        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds)

          const attendeesWithProfiles = data.map((att) => ({
            ...att,
            profiles: profilesData?.find((p) => p.id === att.user_id) || {},
          }))
          setAttendees(attendeesWithProfiles)
        } else {
          setAttendees([])
        }

        if (session?.user?.id) {
          setIsAttending(data.some((a) => a.user_id === session.user.id))
        }
      }
    } catch (err) {
      console.error('Error fetching attendees:', err)
    }
  }

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*, profiles(*)')
          .eq('id', id)
          .single()

        if (!error && data) {
          setEvent(data)

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
              setLocationName(
                addr.road ? `${addr.road}, ${locality}` : locality,
              )
            } catch (err) {
              console.error('Error geocoding:', err)
              setLocationName('Ubicación exacta en mapa')
            }
          } else {
            setLocationName('Ubicación no especificada')
          }

          await fetchAttendees()
        }
      } catch (err) {
        console.error('Error fetching event:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchEvent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, session?.user?.id])

  useLayoutEffect(() => {
    if (!loading && event) {
      gsap.fromTo(
        '.gsap-reveal',
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power3.out',
          delay: 0.2,
        },
      )
    }
  }, [loading, event])

  const handleAttendToggle = async () => {
    if (!session?.user?.id) {
      toast.current.show({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Inicia sesión para apuntarte.',
      })
      return
    }

    setAttendingLoading(true)
    try {
      if (isAttending) {
        await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', id)
          .eq('user_id', session.user.id)
      } else {
        await supabase
          .from('event_attendees')
          .insert({ event_id: id, user_id: session.user.id })
      }

      await fetchAttendees()

      toast.current.show({
        severity: 'success',
        summary: isAttending ? 'Asistencia cancelada' : '¡Te has apuntado!',
        life: 3000,
      })
    } catch (err) {
      console.error('Error toggling attendance:', err)
    } finally {
      setAttendingLoading(false)
    }
  }

  const handleShare = async () => {
    const shareData = { title: event?.titulo, url: window.location.href }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        console.error('Error sharing:', err)
      }
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast.current.show({
        severity: 'success',
        summary: 'Copiado',
        detail: 'Enlace en el portapapeles.',
        life: 2000,
      })
    }
  }

  if (loading)
    return (
      <div className='flex justify-content-center align-items-center min-h-screen surface-ground'>
        <ProgressSpinner strokeWidth='4' />
      </div>
    )
  if (!event)
    return (
      <div className='flex flex-column justify-content-center align-items-center min-h-screen surface-ground p-6'>
        <i className='pi pi-calendar-times text-6xl text-400 mb-4'></i>
        <h2 className='text-900 font-bold text-3xl mb-4'>
          Evento no encontrado
        </h2>
        <Button
          label='Volver al inicio'
          icon='pi pi-home'
          onClick={() => navigate('/')}
        />
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

  const queryParam =
    event.lat && event.lng
      ? `${event.lat},${event.lng}`
      : encodeURIComponent(locationName)
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${queryParam}`

  return (
    <PageTransition>
      <div ref={containerRef} className='min-h-screen surface-ground pb-8'>
        <Toast ref={toast} position='bottom-center' />

        <div className='event-hero gsap-reveal'>
          <div
            className='hero-bg-blur'
            style={{ backgroundImage: `url(${event.image_url})` }}
          ></div>
          <img
            src={event.image_url}
            alt={event.titulo}
            className='hero-img-main'
          />
          <div className='hero-overlay'></div>

          <div className='absolute top-0 left-0 w-full p-4 flex justify-content-between z-3 max-w-7xl mx-auto right-0'>
            <Button
              icon='pi pi-arrow-left'
              label='Volver'
              className='p-button-rounded p-button-text text-white bg-black-alpha-20'
              onClick={() => navigate(-1)}
            />
            <Button
              icon='pi pi-share-alt'
              rounded
              className='bg-white text-900 border-none shadow-2 hover:surface-200'
              onClick={handleShare}
            />
          </div>

          <div className='absolute bottom-0 left-0 w-full p-4 md:p-6 z-3'>
            <div className='max-w-7xl mx-auto w-full text-white'>
              <Tag
                value={event.tipo}
                className='mb-3 px-3 py-2 bg-blue-500 font-bold border-round-xl shadow-2'
              />
              <h1
                className='text-4xl md:text-6xl font-bold m-0 mb-3 tracking-tight'
                style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
              >
                {event.titulo}
              </h1>
              <div className='flex flex-wrap gap-4 font-medium text-lg'>
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

        <div className='max-w-7xl mx-auto px-4 md:px-6 mt-5'>
          <div className='grid'>
            <div className='col-12 lg:col-8'>
              <div className='detail-card gsap-reveal'>
                <h2 className='text-2xl font-bold text-900 mb-4 flex align-items-center gap-3'>
                  <i className='pi pi-info-circle text-blue-500'></i> Detalles
                  del Evento
                </h2>
                <p
                  className='text-700 text-xl line-height-3 m-0 white-space-pre-wrap'
                  style={{ wordBreak: 'break-word' }}
                >
                  {event.description || 'Sin descripción detallada.'}
                </p>
              </div>

              <div className='detail-card gsap-reveal'>
                <h2 className='text-2xl font-bold text-900 mb-4 flex align-items-center gap-3'>
                  <i className='pi pi-map-marker text-red-500'></i> Ubicación
                </h2>
                <div className='bg-gray-50 p-4 border-round-xl mb-4 flex align-items-center gap-4'>
                  <div className='bg-white p-3 border-round-xl shadow-1'>
                    <i className='pi pi-map text-blue-600 text-2xl'></i>
                  </div>
                  <div className='flex flex-column'>
                    <span className='font-bold text-2xl text-900'>
                      {locationName}
                    </span>
                    <span className='text-500 text-sm font-medium'>
                      Dirección aproximada del punto de encuentro
                    </span>
                  </div>
                </div>

                <div className='grid gap-3 m-0 mt-4'>
                  <div className='col-12 md:col p-0'>
                    <a
                      href={googleMapsUrl}
                      target='_blank'
                      rel='noreferrer'
                      className='no-underline'
                    >
                      <Button
                        label='Google Maps'
                        icon='pi pi-google'
                        className='w-full p-button-outlined border-round-xl font-bold py-3'
                      />
                    </a>
                  </div>
                  <div className='col-12 md:col p-0'>
                    <a
                      href={`https://waze.com/ul?ll=${event.lat},${event.lng}&navigate=yes`}
                      target='_blank'
                      rel='noreferrer'
                      className='no-underline'
                    >
                      <Button
                        label='Waze'
                        icon='pi pi-map'
                        className='w-full p-button-outlined border-round-xl font-bold py-3'
                      />
                    </a>
                  </div>
                  <div className='col-12 md:col p-0'>
                    <a
                      href={`http://maps.apple.com/?q=${queryParam}`}
                      target='_blank'
                      rel='noreferrer'
                      className='no-underline'
                    >
                      <Button
                        label='Apple Maps'
                        icon='pi pi-apple'
                        className='w-full p-button-outlined border-round-xl font-bold py-3'
                      />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className='col-12 lg:col-4'>
              <div className='detail-card gsap-reveal'>
                <Button
                  label={
                    isAttending ? '¡Ya estás apuntado!' : 'Me Apunto al Evento'
                  }
                  icon={isAttending ? 'pi pi-check-circle' : 'pi pi-plus'}
                  className={`w-full p-4 font-bold text-xl border-round-xl shadow-2 mb-4 transition-colors ${isAttending ? 'p-button-success' : 'p-button-primary'}`}
                  onClick={handleAttendToggle}
                  loading={attendingLoading}
                  disabled={isPast}
                />

                <div
                  className='bg-gray-50 p-4 border-round-2xl mb-4 border-1 surface-border cursor-pointer hover:surface-200 transition-colors'
                  onClick={() => setShowAttendeesModal(true)}
                >
                  <div className='flex justify-content-between align-items-center mb-3 font-bold text-700'>
                    <span className='text-sm uppercase tracking-wider'>
                      Asistentes
                    </span>
                    <Tag
                      value={attendees.length}
                      severity='info'
                      rounded
                      className='px-3'
                    />
                  </div>

                  {attendees.length > 0 ? (
                    <AvatarGroup>
                      {attendees.slice(0, 5).map((a, i) => (
                        <Avatar
                          key={i}
                          image={a.profiles?.avatar_url || undefined}
                          icon={
                            !a.profiles?.avatar_url ? 'pi pi-user' : undefined
                          }
                          size='large'
                          shape='circle'
                          className='border-2 border-white shadow-1 bg-blue-100 text-blue-600'
                        />
                      ))}
                      {attendees.length > 5 && (
                        <Avatar
                          label={`+${attendees.length - 5}`}
                          shape='circle'
                          size='large'
                          className='bg-blue-600 text-white font-bold border-2 border-white shadow-1'
                        />
                      )}
                    </AvatarGroup>
                  ) : (
                    <div className='text-500 text-sm italic flex align-items-center gap-2'>
                      <i className='pi pi-info-circle'></i> Sé el primero en
                      apuntarte
                    </div>
                  )}
                  <div className='text-blue-500 text-xs font-bold mt-3 text-right'>
                    Ver todos <i className='pi pi-angle-right'></i>
                  </div>
                </div>

                <Button
                  label={isFavorite ? 'En Favoritos' : 'Añadir a Favoritos'}
                  icon={isFavorite ? 'pi pi-heart-fill' : 'pi pi-heart'}
                  className={`w-full p-3 font-bold border-round-xl transition-colors ${isFavorite ? 'bg-pink-50 text-pink-600 border-pink-200' : 'p-button-outlined p-button-secondary bg-white'}`}
                  onClick={toggleFavorite}
                  loading={favLoading}
                />
              </div>

              <div className='detail-card gsap-reveal'>
                <div className='text-900 font-bold mb-4 text-xl border-bottom-1 surface-border pb-2'>
                  Organizado por
                </div>
                <div
                  className='flex align-items-center gap-3 p-3 bg-gray-50 border-round-xl cursor-pointer hover:surface-200 transition-all border-1 border-transparent hover:border-blue-200'
                  onClick={() => navigate(`/usuario/${event.user_id}`)}
                >
                  <Avatar
                    image={event.profiles?.avatar_url || undefined}
                    icon={
                      !event.profiles?.avatar_url ? 'pi pi-user' : undefined
                    }
                    size='xlarge'
                    shape='circle'
                    className='shadow-1 border-2 border-white bg-blue-100 text-blue-600'
                  />
                  <div className='flex flex-column'>
                    <span className='font-bold text-xl text-900'>
                      {event.profiles?.username || 'Anónimo'}
                    </span>
                    <span className='text-blue-500 text-sm font-medium mt-1'>
                      Ver perfil y garaje →
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Dialog
          header='Asistentes Confirmados'
          visible={showAttendeesModal}
          onHide={() => setShowAttendeesModal(false)}
          breakpoints={{ '960px': '75vw', '640px': '90vw' }}
          style={{ width: '40vw' }}
          className='border-round-2xl'
        >
          <div className='flex flex-column gap-3 mt-3'>
            {attendees.map((a, i) => (
              <div
                key={i}
                className='flex align-items-center justify-content-between p-3 border-round-xl surface-50 hover:surface-100 transition-colors cursor-pointer border-1 surface-border'
                onClick={() => {
                  setShowAttendeesModal(false)
                  navigate(`/usuario/${a.user_id}`)
                }}
              >
                <div className='flex align-items-center gap-3'>
                  <Avatar
                    image={a.profiles?.avatar_url || undefined}
                    icon={!a.profiles?.avatar_url ? 'pi pi-user' : undefined}
                    shape='circle'
                    size='large'
                    className='bg-blue-100 text-blue-600 shadow-1'
                  />
                  <span className='font-bold text-900 text-lg'>
                    {a.profiles?.username || 'Usuario Anónimo'}
                  </span>
                </div>
                <Button
                  icon='pi pi-angle-right'
                  rounded
                  text
                  className='text-600'
                />
              </div>
            ))}
            {attendees.length === 0 && (
              <div className='text-center text-500 py-4 flex flex-column align-items-center gap-3'>
                <i className='pi pi-users text-4xl text-300'></i>
                <span>Aún no hay asistentes confirmados para este evento.</span>
              </div>
            )}
          </div>
        </Dialog>
      </div>
    </PageTransition>
  )
}

export default EventDetailPage
