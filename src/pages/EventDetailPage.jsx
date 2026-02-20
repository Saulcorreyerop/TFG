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
import { Skeleton } from 'primereact/skeleton'
import { InputTextarea } from 'primereact/inputtextarea'
import { useFavorites } from '../hooks/useFavorites'
import PageTransition from '../components/PageTransition'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
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
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  const {
    isFavorite,
    toggleFavorite,
    loading: favLoading,
  } = useFavorites(id, session)

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('event_comments')
        .select('*')
        .eq('event_id', parseInt(id))
        .order('created_at', { ascending: false })

      if (!error && data) {
        const userIds = [...new Set(data.map((c) => c.user_id))]
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds)

          const commentsWithProfiles = data.map((c) => ({
            ...c,
            profiles: profilesData?.find((p) => p.id === c.user_id) || {},
          }))
          setComments(commentsWithProfiles)
        } else {
          setComments([])
        }
      }
    } catch (err) {
      console.error('Error fetching comments:', err)
    }
  }

  const fetchAttendees = async () => {
    try {
      const { data, error } = await supabase
        .from('event_attendees')
        .select('user_id')
        .eq('event_id', parseInt(id))

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
          .eq('id', parseInt(id))
          .single()

        if (!error && data) {
          setEvent(data)

          if (data.ubicacion && data.ubicacion.trim().length > 0) {
            setLocationName(data.ubicacion)
          } else if (data.lat && data.lng) {
            try {
              // SOLUCIÓN CORS: Quitamos los headers y pasamos el idioma en la URL
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${data.lat}&lon=${data.lng}&accept-language=es`,
              )
              if (!response.ok) throw new Error('Geocoding error')
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
            } catch {
              // SOLUCIÓN ESLINT: Eliminado el (err)
              setLocationName('Ubicación exacta en mapa')
            }
          } else {
            setLocationName('Ubicación no especificada')
          }

          await Promise.all([fetchAttendees(), fetchComments()])
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

  useEffect(() => {
    if (!event) return
    const interval = setInterval(() => {
      const distance = new Date(event.fecha).getTime() - new Date().getTime()
      if (distance < 0) {
        clearInterval(interval)
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }
      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor(
          (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        ),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [event])

  useLayoutEffect(() => {
    if (!loading && event) {
      gsap.fromTo(
        '.gsap-reveal',
        { y: 30, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.6,
          stagger: 0.1,
          ease: 'power3.out',
          delay: 0.1,
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
          .eq('event_id', parseInt(id))
          .eq('user_id', session.user.id)
      } else {
        await supabase
          .from('event_attendees')
          .insert({ event_id: parseInt(id), user_id: session.user.id })
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

  const handlePostComment = async () => {
    if (!newComment.trim() || !session?.user?.id) {
      return toast.current.show({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Inicia sesión para comentar.',
      })
    }

    setPostingComment(true)
    try {
      const { error } = await supabase.from('event_comments').insert({
        event_id: parseInt(id),
        user_id: session.user.id,
        content: newComment.trim(),
      })

      if (error) throw error

      setNewComment('')
      await fetchComments()
      toast.current.show({
        severity: 'success',
        summary: 'Comentario publicado',
        life: 2000,
      })
    } catch (err) {
      console.error('Error publicando comentario:', err)
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo publicar el comentario.',
        life: 3000,
      })
    } finally {
      setPostingComment(false)
    }
  }

  const handleShare = async () => {
    const shareData = { title: event?.titulo, url: window.location.href }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // SOLUCIÓN ESLINT: Eliminado el (err)
        // Silenced error
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

  const handleAddToCalendar = () => {
    const start = new Date(event.fecha)
      .toISOString()
      .replace(/-|:|\.\d\d\d/g, '')
    const end = new Date(new Date(event.fecha).getTime() + 2 * 60 * 60 * 1000)
      .toISOString()
      .replace(/-|:|\.\d\d\d/g, '')
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.titulo)}&dates=${start}/${end}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(locationName)}`
    window.open(url, '_blank')
  }

  if (loading)
    return (
      <div className='max-w-7xl mx-auto p-4 mt-8 min-h-screen'>
        <Skeleton
          width='100%'
          height='450px'
          borderRadius='24px'
          className='mb-5'
        ></Skeleton>
        <div className='grid gap-4 md:gap-0'>
          <div className='col-12 lg:col-8 lg:pr-4'>
            <Skeleton
              width='100%'
              height='300px'
              borderRadius='24px'
              className='mb-4'
            ></Skeleton>
            <Skeleton
              width='100%'
              height='400px'
              borderRadius='24px'
            ></Skeleton>
          </div>
          <div className='col-12 lg:col-4'>
            <Skeleton
              width='100%'
              height='500px'
              borderRadius='24px'
            ></Skeleton>
          </div>
        </div>
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
  const googleMapsUrl = `http://googleusercontent.com/maps.google.com/maps?q=${queryParam}`

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

          <div className='absolute top-0 left-0 w-full p-4 md:p-6 flex justify-content-between z-3 max-w-7xl mx-auto right-0'>
            <Button
              icon='pi pi-arrow-left'
              label='Volver'
              className='p-button-rounded p-button-text text-white bg-black-alpha-30 hover:bg-black-alpha-50 transition-colors backdrop-blur-sm'
              onClick={() => navigate(-1)}
            />
            <Button
              icon='pi pi-share-alt'
              rounded
              className='bg-white text-900 border-none shadow-3 hover:surface-200 transition-colors'
              onClick={handleShare}
            />
          </div>

          <div className='absolute bottom-0 left-0 w-full p-4 md:p-8 z-3'>
            <div className='max-w-7xl mx-auto w-full text-white'>
              <div className='flex flex-wrap gap-2 mb-4'>
                <Tag
                  value={event.tipo}
                  className='bg-blue-600 font-bold border-round-2xl px-3 py-2 shadow-2 uppercase tracking-wider text-sm'
                />
                {event.tags &&
                  event.tags.map((t, i) => (
                    <Tag
                      key={i}
                      value={t}
                      className='bg-white-alpha-20 backdrop-blur-sm text-white font-bold border-round-2xl px-3 py-2 shadow-2 text-sm'
                    />
                  ))}
              </div>
              <h1
                className='text-4xl md:text-6xl lg:text-7xl font-extrabold m-0 mb-4 tracking-tight'
                style={{ textShadow: '0 4px 12px rgba(0,0,0,0.6)' }}
              >
                {event.titulo}
              </h1>
              <div className='flex flex-wrap gap-5 font-semibold text-lg md:text-xl text-white-alpha-90'>
                <span className='flex align-items-center gap-2'>
                  <i className='pi pi-calendar text-blue-400 text-xl'></i>{' '}
                  {fullDate}
                </span>
                <span className='flex align-items-center gap-2'>
                  <i className='pi pi-clock text-blue-400 text-xl'></i> {time} h
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className='max-w-7xl mx-auto px-4 md:px-6 mt-6'>
          <div className='grid gap-4 md:gap-0'>
            <div className='col-12 lg:col-8 lg:pr-5'>
              <div className='detail-card gsap-reveal'>
                <h2 className='text-2xl font-bold text-900 mb-4 flex align-items-center gap-3 border-bottom-1 surface-border pb-3'>
                  <i
                    className='pi pi-align-left text-blue-600'
                    style={{ fontSize: '1.4rem' }}
                  ></i>{' '}
                  Acerca del Evento
                </h2>
                <p
                  className='text-700 text-lg md:text-xl line-height-4 m-0 white-space-pre-wrap font-medium'
                  style={{ wordBreak: 'break-word' }}
                >
                  {event.description ||
                    'El organizador no ha proporcionado una descripción detallada para este evento.'}
                </p>
              </div>

              <div className='detail-card gsap-reveal'>
                <h2 className='text-2xl font-bold text-900 mb-4 flex align-items-center gap-3 border-bottom-1 surface-border pb-3'>
                  <i
                    className='pi pi-map-marker text-red-500'
                    style={{ fontSize: '1.4rem' }}
                  ></i>{' '}
                  Ubicación
                </h2>
                <div className='bg-gray-50 p-4 border-round-2xl mb-5 flex align-items-center gap-4 border-1 surface-border'>
                  <div className='bg-white p-3 border-round-xl shadow-2'>
                    <i className='pi pi-map text-blue-600 text-2xl'></i>
                  </div>
                  <div className='flex flex-column'>
                    <span className='font-bold text-xl md:text-2xl text-900'>
                      {locationName}
                    </span>
                    <span className='text-500 font-medium mt-1'>
                      Punto de encuentro o ubicación general
                    </span>
                  </div>
                </div>

                {event.lat && event.lng && (
                  <div className='mb-5 shadow-2 border-round-2xl overflow-hidden'>
                    <MapContainer
                      center={[event.lat, event.lng]}
                      zoom={15}
                      style={{ height: '350px', width: '100%', zIndex: 1 }}
                    >
                      <TileLayer url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
                      <Marker position={[event.lat, event.lng]}>
                        <Popup className='font-bold text-sm'>
                          {event.titulo}
                        </Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                )}

                <div className='text-900 font-bold mb-3 text-lg'>
                  Navegar con:
                </div>
                <div className='grid gap-3 m-0'>
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
                        className='w-full p-button-outlined font-bold py-3 map-app-btn google-btn text-lg'
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
                        className='w-full p-button-outlined font-bold py-3 map-app-btn waze-btn text-lg'
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
                        className='w-full p-button-outlined font-bold py-3 map-app-btn apple-btn text-lg'
                      />
                    </a>
                  </div>
                </div>
              </div>

              <div className='detail-card gsap-reveal'>
                <h2 className='text-2xl font-bold text-900 mb-4 flex align-items-center gap-3 border-bottom-1 surface-border pb-3'>
                  <i
                    className='pi pi-comments text-blue-500'
                    style={{ fontSize: '1.4rem' }}
                  ></i>{' '}
                  Muro del Evento
                </h2>
                <div className='flex flex-column gap-3 mb-5'>
                  <InputTextarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    placeholder='¿Qué esperas de este evento? Escribe un comentario...'
                    className='w-full border-round-2xl p-3 text-lg border-2 hover:border-blue-300 focus:border-blue-500 transition-colors'
                    autoResize
                  />
                  <div className='flex justify-content-end'>
                    <Button
                      label='Publicar Comentario'
                      icon='pi pi-send'
                      className='border-round-xl font-bold px-4'
                      onClick={handlePostComment}
                      loading={postingComment}
                      disabled={!newComment.trim()}
                    />
                  </div>
                </div>
                <div className='flex flex-column gap-4'>
                  {comments.length > 0 ? (
                    comments.map((c) => (
                      <div key={c.id} className='flex gap-3 align-items-start'>
                        <Avatar
                          image={c.profiles?.avatar_url}
                          icon={
                            !c.profiles?.avatar_url ? 'pi pi-user' : undefined
                          }
                          shape='circle'
                          size='large'
                          className='flex-shrink-0 bg-blue-100 text-blue-600 shadow-1 mt-1'
                        />
                        <div className='flex-1 comment-bubble'>
                          <div className='flex justify-content-between align-items-center mb-2'>
                            <span
                              className='font-bold text-900 text-lg cursor-pointer hover:text-blue-600 transition-colors'
                              onClick={() => navigate(`/usuario/${c.user_id}`)}
                            >
                              {c.profiles?.username}
                            </span>
                            <span className='text-sm text-500 font-medium'>
                              {new Date(c.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className='m-0 text-700 line-height-3 text-lg'>
                            {c.content}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className='text-center py-5 surface-50 border-round-2xl border-1 surface-border'>
                      <i className='pi pi-comment text-4xl text-400 mb-3 block'></i>
                      <span className='text-500 font-medium text-lg'>
                        Aún no hay comentarios. ¡Sé el primero en escribir algo!
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className='col-12 lg:col-4'>
              <div className='flex flex-column gap-4'>
                <div className='detail-card gsap-reveal m-0'>
                  {!isPast && (
                    <div className='mb-5'>
                      <div className='text-xs font-bold text-600 uppercase tracking-widest mb-3 text-center'>
                        El evento comienza en
                      </div>
                      <div className='grid grid-nogutter gap-2'>
                        <div className='col countdown-box'>
                          <span className='countdown-number'>
                            {timeLeft.days}
                          </span>
                          <span className='countdown-label'>Días</span>
                        </div>
                        <div className='col countdown-box'>
                          <span className='countdown-number'>
                            {timeLeft.hours}
                          </span>
                          <span className='countdown-label'>Hrs</span>
                        </div>
                        <div className='col countdown-box'>
                          <span className='countdown-number'>
                            {timeLeft.minutes}
                          </span>
                          <span className='countdown-label'>Min</span>
                        </div>
                        <div className='col countdown-box'>
                          <span className='countdown-number'>
                            {timeLeft.seconds}
                          </span>
                          <span className='countdown-label'>Seg</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    label={
                      isPast
                        ? 'Evento Finalizado'
                        : isAttending
                          ? '¡Ya estás apuntado!'
                          : 'Me Apunto al Evento'
                    }
                    icon={
                      isAttending || isPast
                        ? 'pi pi-check-circle'
                        : 'pi pi-ticket'
                    }
                    className={`w-full btn-attend-main text-white mb-3 ${
                      isPast
                        ? 'bg-gray-400 p-button-secondary'
                        : isAttending
                          ? 'bg-green-500 p-button-success'
                          : ''
                    }`}
                    onClick={handleAttendToggle}
                    loading={attendingLoading}
                    disabled={isPast}
                  />

                  {!isPast && (
                    <Button
                      label='Añadir al Calendario'
                      icon='pi pi-calendar-plus'
                      className='w-full p-3 font-bold border-round-2xl bg-white text-900 border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors mb-4'
                      onClick={handleAddToCalendar}
                    />
                  )}

                  <div
                    className='bg-gray-50 p-4 border-round-2xl mb-4 border-1 surface-border cursor-pointer hover:shadow-2 transition-all'
                    onClick={() => setShowAttendeesModal(true)}
                  >
                    <div className='flex justify-content-between align-items-center mb-3'>
                      <span className='text-sm font-bold text-700 uppercase tracking-wider'>
                        Asistentes
                      </span>
                      <Tag
                        value={attendees.length}
                        className='bg-blue-100 text-blue-700 font-bold px-3 py-1 border-round-xl'
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
                      <div className='text-500 text-sm font-medium flex align-items-center gap-2'>
                        <i className='pi pi-users'></i> Sé el primero en
                        apuntarte
                      </div>
                    )}
                    <div className='text-blue-600 text-sm font-bold mt-3 flex align-items-center justify-content-between'>
                      <span>Ver lista completa</span>
                      <i className='pi pi-arrow-right'></i>
                    </div>
                  </div>

                  <Button
                    label={
                      isFavorite
                        ? 'Guardado en Favoritos'
                        : 'Añadir a Favoritos'
                    }
                    icon={isFavorite ? 'pi pi-heart-fill' : 'pi pi-heart'}
                    className={`w-full p-3 font-bold border-round-2xl transition-colors border-2 ${isFavorite ? 'bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100' : 'bg-white text-700 border-gray-200 hover:bg-gray-50'}`}
                    onClick={toggleFavorite}
                    loading={favLoading}
                    disabled={isPast}
                  />
                </div>

                <div className='detail-card gsap-reveal m-0'>
                  <div className='text-900 font-bold mb-4 text-lg uppercase tracking-wider text-500 text-sm'>
                    Organizado por
                  </div>
                  <div
                    className='flex align-items-center gap-4 p-3 border-round-2xl cursor-pointer hover:bg-gray-50 transition-all border-1 border-transparent hover:border-gray-200 hover:shadow-1'
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
                      <span className='text-blue-600 text-sm font-semibold mt-1 flex align-items-center gap-1'>
                        Ver perfil y garaje{' '}
                        <i className='pi pi-angle-right'></i>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Dialog
          header={
            <span className='text-2xl font-bold text-900'>
              Asistentes Confirmados
            </span>
          }
          visible={showAttendeesModal}
          onHide={() => setShowAttendeesModal(false)}
          breakpoints={{ '960px': '75vw', '640px': '90vw' }}
          style={{ width: '35vw' }}
          className='border-round-3xl shadow-8'
          contentClassName='p-4'
          headerClassName='px-4 pt-4 pb-2 border-bottom-1 surface-border'
        >
          <div className='flex flex-column gap-2 mt-2'>
            {attendees.map((a, i) => (
              <div
                key={i}
                className='flex align-items-center justify-content-between p-3 border-round-2xl hover:bg-gray-50 transition-colors cursor-pointer border-1 border-transparent hover:border-gray-200'
                onClick={() => {
                  setShowAttendeesModal(false)
                  navigate(`/usuario/${a.user_id}`)
                }}
              >
                <div className='flex align-items-center gap-4'>
                  <Avatar
                    image={a.profiles?.avatar_url || undefined}
                    icon={!a.profiles?.avatar_url ? 'pi pi-user' : undefined}
                    shape='circle'
                    size='large'
                    className='bg-blue-100 text-blue-600 shadow-1 border-2 border-white'
                  />
                  <span className='font-bold text-900 text-lg'>
                    {a.profiles?.username || 'Usuario Anónimo'}
                  </span>
                </div>
                <div className='w-2rem h-2rem flex align-items-center justify-content-center border-circle surface-100 text-600'>
                  <i className='pi pi-angle-right'></i>
                </div>
              </div>
            ))}
            {attendees.length === 0 && (
              <div className='text-center text-500 py-6 flex flex-column align-items-center gap-3 bg-gray-50 border-round-3xl border-1 surface-border'>
                <i className='pi pi-users text-5xl text-400'></i>
                <span className='font-medium text-lg'>
                  Aún no hay asistentes confirmados.
                </span>
              </div>
            )}
          </div>
        </Dialog>
      </div>
    </PageTransition>
  )
}

export default EventDetailPage
