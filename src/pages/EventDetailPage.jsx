import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { Avatar } from 'primereact/avatar'
import { AvatarGroup } from 'primereact/avatargroup'
import { Toast } from 'primereact/toast'
import { Dialog } from 'primereact/dialog'
import { Skeleton } from 'primereact/skeleton'
import { InputTextarea } from 'primereact/inputtextarea'
import { useFavorites } from '../hooks/useFavorites'
import PageTransition from '../components/PageTransition'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays,
  Clock,
  MapPin,
  AlignLeft,
  MessageSquare,
  Users,
  Share2,
  ArrowLeft,
  Heart,
  CalendarPlus,
  ChevronRight,
  Send,
  User,
  Edit3,
  Trash2,
  Camera,
  X,
} from 'lucide-react'
import './EventDetailPage.css'

const MotionDiv = motion.div

const EventDetailPage = ({ session }) => {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useRef(null)

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

  // Estados para la gestión del evento (Creador)
  const [extraImages, setExtraImages] = useState([])
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [uploadingExtra, setUploadingExtra] = useState(false)

  const {
    isFavorite,
    toggleFavorite,
    loading: favLoading,
  } = useFavorites(id, session)

  // 1. Envolvemos las funciones en useCallback para evitar el error de dependencias en useEffect
  const fetchComments = useCallback(async () => {
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
          setComments(
            data.map((c) => ({
              ...c,
              profiles: profilesData?.find((p) => p.id === c.user_id) || {},
            })),
          )
        } else setComments([])
      }
    } catch (err) {
      console.error('Error fetching comments:', err)
    }
  }, [id])

  const fetchAttendees = useCallback(async () => {
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
          setAttendees(
            data.map((att) => ({
              ...att,
              profiles: profilesData?.find((p) => p.id === att.user_id) || {},
            })),
          )
        } else setAttendees([])
        if (session?.user?.id)
          setIsAttending(data.some((a) => a.user_id === session.user.id))
      }
    } catch (err) {
      console.error('Error fetching attendees:', err)
    }
  }, [id, session?.user?.id])

  const fetchExtraImages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('event_images')
        .select('*')
        .eq('event_id', parseInt(id))
        .order('created_at', { ascending: true })
      if (!error && data) setExtraImages(data)
    } catch (err) {
      console.error('Error fetching extra images:', err)
    }
  }, [id])

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
          if (data.ubicacion && data.ubicacion.trim().length > 0)
            setLocationName(data.ubicacion)
          else if (data.lat && data.lng) {
            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${data.lat}&lon=${data.lng}&accept-language=es`,
              )
              const geoData = await response.json()
              const locality =
                geoData.address.city ||
                geoData.address.town ||
                geoData.address.village ||
                'Ubicación en mapa'
              setLocationName(
                geoData.address.road
                  ? `${geoData.address.road}, ${locality}`
                  : locality,
              )
            } catch {
              setLocationName('Ubicación exacta en mapa')
            }
          } else setLocationName('Ubicación no especificada')

          await Promise.all([
            fetchAttendees(),
            fetchComments(),
            fetchExtraImages(),
          ])
        }
      } catch (err) {
        console.error('Error fetching event:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchEvent()
  }, [id, fetchAttendees, fetchComments, fetchExtraImages]) // 2. Añadidas las dependencias requeridas

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

  const handleAttendToggle = async () => {
    if (!session?.user?.id)
      return toast.current.show({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Inicia sesión para apuntarte.',
      })
    setAttendingLoading(true)
    try {
      if (isAttending)
        await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', parseInt(id))
          .eq('user_id', session.user.id)
      else
        await supabase
          .from('event_attendees')
          .insert({ event_id: parseInt(id), user_id: session.user.id })
      await fetchAttendees()
      toast.current.show({
        severity: 'success',
        summary: isAttending
          ? 'Asistencia cancelada'
          : '¡Te has apuntado al evento!',
        life: 3000,
      })
    } catch (err) {
      console.error('Error attending:', err)
    } finally {
      setAttendingLoading(false)
    }
  }

  const handlePostComment = async () => {
    if (!newComment.trim() || !session?.user?.id)
      return toast.current.show({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Inicia sesión para comentar.',
      })
    setPostingComment(true)
    try {
      const { error } = await supabase
        .from('event_comments')
        .insert({
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
      console.error('Error posting comment:', err) // 3. Uso de la variable err
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo publicar el comentario.',
      })
    } finally {
      setPostingComment(false)
    }
  }

  // Lógica de Gestión (Creador)
  const handleSaveDescription = async () => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ description: editDescription })
        .eq('id', parseInt(id))
      if (error) throw error
      setEvent((prev) => ({ ...prev, description: editDescription }))
      setShowEditModal(false)
      toast.current.show({
        severity: 'success',
        summary: 'Guardado',
        detail: 'Descripción actualizada correctamente',
      })
    } catch (error) {
      console.error('Error saving description:', error) // Uso de la variable error
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar la descripción',
      })
    }
  }

  const handleUploadExtraImage = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingExtra(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${event.id}/${Math.random()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(fileName, file)
      if (uploadError) throw uploadError
      const { data } = supabase.storage
        .from('event-images')
        .getPublicUrl(fileName)
      await supabase
        .from('event_images')
        .insert({ event_id: parseInt(id), image_url: data.publicUrl })
      await fetchExtraImages()
      toast.current.show({
        severity: 'success',
        summary: 'Foto subida',
        detail: 'Añadida a la descripción',
      })
    } catch (error) {
      console.error('Error uploading extra image:', error) // Uso de la variable error
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Fallo al subir la foto',
      })
    } finally {
      setUploadingExtra(false)
    }
  }

  const handleDeleteExtraImage = async (imageId) => {
    try {
      await supabase.from('event_images').delete().eq('id', imageId)
      setExtraImages((prev) => prev.filter((img) => img.id !== imageId))
    } catch (error) {
      console.error('Error deleting extra image:', error)
    } // Uso de la variable error
  }

  const handleDeleteEvent = async () => {
    try {
      await supabase.from('events').delete().eq('id', parseInt(id))
      toast.current.show({
        severity: 'success',
        summary: 'Evento Eliminado',
        detail: 'Serás redirigido...',
      })
      setTimeout(() => navigate('/eventos'), 1500)
    } catch (error) {
      console.error('Error deleting event:', error) // Uso de la variable error
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo eliminar el evento',
      })
    }
  }

  const handleShare = async () => {
    if (navigator.share)
      navigator
        .share({ title: event?.titulo, url: window.location.href })
        .catch(() => {})
    else {
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
    const startDate = new Date(event.fecha)
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000)
    const formatICSDate = (date) => date.toISOString().replace(/-|:|\.\d+/g, '')
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CarMeet ESP//Calendario//ES',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:evento-${event.id}@carmeet.esp`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${event.titulo}`,
      `DESCRIPTION:${event.description ? event.description.replace(/\r?\n/g, '\\n') : 'Evento en CarMeet ESP'}`,
      `LOCATION:${locationName}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `${event.titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (loading)
    return (
      <div className='max-w-7xl mx-auto p-4 mt-8 min-h-screen'>
        <Skeleton
          width='100%'
          height='480px'
          borderRadius='48px'
          className='mb-6'
        ></Skeleton>
      </div>
    )
  if (!event)
    return (
      <div className='flex flex-column justify-content-center align-items-center min-h-screen bg-gray-50 p-6'>
        <CalendarDays size={80} className='text-300 mb-5 pulse-soft' />
        <h2 className='text-900 font-black text-4xl mb-5'>
          Evento no encontrado
        </h2>
        <Button
          label='Explorar eventos'
          icon={<ArrowLeft size={18} className='mr-2' />}
          onClick={() => navigate('/')}
          className='p-button-outlined border-round-2xl p-3 font-bold'
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
  const isCreator = session?.user?.id === event.user_id
  const queryParam =
    event.lat && event.lng
      ? `${event.lat},${event.lng}`
      : encodeURIComponent(locationName)
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${queryParam}`

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  }
  const itemAnim = {
    hidden: { opacity: 0, y: 30 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 300, damping: 24 },
    },
  }

  // Componente Reutilizable de Panel de Control
  const CreatorControls = () => {
    if (!isCreator) return null
    return (
      <div className='mt-4 pt-4 border-top-1 surface-border flex gap-3 creator-controls'>
        <Button
          label='Editar Detalles'
          icon={<Edit3 size={18} className='mr-2' />}
          className='p-button-outlined flex-1 border-round-xl font-bold'
          onClick={(e) => {
            e.stopPropagation()
            setEditDescription(event.description || '')
            setShowEditModal(true)
          }}
        />
        <Button
          label='Eliminar'
          icon={<Trash2 size={18} className='mr-2' />}
          severity='danger'
          text
          className='flex-1 border-round-xl font-bold hover:surface-200'
          onClick={(e) => {
            e.stopPropagation()
            setShowDeleteModal(true)
          }}
        />
      </div>
    )
  }

  return (
    <PageTransition>
      <MotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='page-wrapper pb-8'
      >
        <Toast ref={toast} position='bottom-center' />

        {/* HERO SECTION */}
        <MotionDiv
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className='event-hero'
        >
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
              className='p-button-rounded p-button-text text-white hover:bg-white-alpha-20 transition-colors backdrop-blur-md'
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={24} />
            </Button>
            <Button
              className='p-button-rounded bg-white text-900 border-none shadow-3 hover:scale-110 transition-transform duration-300'
              onClick={handleShare}
            >
              <Share2 size={20} />
            </Button>
          </div>

          <div className='absolute bottom-0 left-0 w-full p-5 md:p-8 z-3'>
            <div className='max-w-7xl mx-auto w-full text-white'>
              <div className='flex flex-wrap gap-2 mb-4'>
                <Tag
                  value={event.tipo}
                  className='bg-blue-600 font-bold border-round-2xl px-4 py-2 uppercase tracking-widest text-xs shadow-3'
                />
                {event.tags &&
                  event.tags.map((t, i) => (
                    <Tag
                      key={i}
                      value={t}
                      className='glass-tag font-semibold border-round-2xl px-4 py-2'
                    />
                  ))}
              </div>
              <h1
                className='text-5xl md:text-7xl lg:text-8xl font-black m-0 mb-4 tracking-tighter line-height-1'
                style={{ textShadow: '0 10px 30px rgba(0,0,0,0.8)' }}
              >
                {event.titulo}
              </h1>
              <div className='flex flex-wrap gap-4 font-bold text-lg md:text-xl text-white-alpha-90 mt-5'>
                <span className='flex align-items-center gap-2 bg-black-alpha-40 px-5 py-3 border-round-3xl backdrop-blur-md border-1 border-white-alpha-20'>
                  <CalendarDays size={22} className='text-blue-400' />{' '}
                  {fullDate}
                </span>
                <span className='flex align-items-center gap-2 bg-black-alpha-40 px-5 py-3 border-round-3xl backdrop-blur-md border-1 border-white-alpha-20'>
                  <Clock size={22} className='text-blue-400' /> {time} h
                </span>
              </div>
            </div>
          </div>
        </MotionDiv>

        <div className='max-w-7xl mx-auto px-4 md:px-6 mt-6 relative z-10'>
          <MotionDiv
            variants={staggerContainer}
            initial='hidden'
            animate='show'
            className='grid gap-4 md:gap-0'
          >
            {/* LEFT COLUMN */}
            <div className='col-12 lg:col-8 lg:pr-6 flex-order-1 lg:flex-order-0'>
              <MotionDiv variants={itemAnim} className='fichar-card'>
                <h2 className='text-2xl md:text-3xl font-black text-900 mb-4 flex align-items-center gap-4'>
                  <div className='icon-box'>
                    <AlignLeft size={28} />
                  </div>
                  Acerca del Evento
                </h2>
                <p className='text-600 text-lg md:text-xl line-height-4 m-0 white-space-pre-wrap font-medium mt-4'>
                  {event.description ||
                    'El organizador no ha proporcionado una descripción detallada para este evento.'}
                </p>

                {/* GALERÍA EXTRA EN LA DESCRIPCIÓN */}
                {extraImages.length > 0 && (
                  <div className='mt-5 grid'>
                    {extraImages.map((img) => (
                      <div key={img.id} className='col-12 md:col-6'>
                        <img
                          src={img.image_url}
                          alt='Extra'
                          className='w-full border-round-2xl shadow-2 object-cover'
                          style={{ height: '240px' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </MotionDiv>

              <MotionDiv variants={itemAnim} className='fichar-card'>
                <h2 className='text-2xl md:text-3xl font-black text-900 mb-4 flex align-items-center gap-4'>
                  <div className='icon-box bg-red-50 text-red-500'>
                    <MapPin size={28} />
                  </div>{' '}
                  Ubicación
                </h2>
                <div className='flex align-items-center gap-4 mb-5 p-2'>
                  <div className='flex flex-column'>
                    <span className='font-black text-2xl text-900'>
                      {locationName}
                    </span>
                    <span className='text-500 text-md font-medium mt-1'>
                      Punto de encuentro aproximado
                    </span>
                  </div>
                </div>
                {event.lat && event.lng && (
                  <div className='mb-5 shadow-3 border-round-3xl overflow-hidden border-2 border-gray-100'>
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
                        className='w-full font-bold py-4 map-app-btn text-md'
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
                        className='w-full font-bold py-4 map-app-btn text-md'
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
                        className='w-full font-bold py-4 map-app-btn text-md'
                      />
                    </a>
                  </div>
                </div>
              </MotionDiv>

              <MotionDiv variants={itemAnim} className='fichar-card'>
                <h2 className='text-2xl md:text-3xl font-black text-900 mb-4 flex align-items-center gap-4'>
                  <div className='icon-box bg-purple-50 text-purple-500'>
                    <MessageSquare size={28} />
                  </div>{' '}
                  Muro del Evento
                </h2>
                <div className='flex flex-column gap-3 mb-6 mt-4'>
                  <InputTextarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    placeholder='¿Qué esperas de este evento? Escribe algo...'
                    className='w-full border-round-3xl p-4 border-2 border-gray-100 hover:border-blue-400 focus:border-blue-500 transition-colors shadow-none bg-gray-50 text-lg'
                    autoResize
                  />
                  <div className='flex justify-content-end mt-2'>
                    <Button
                      label='Comentar'
                      icon={<Send size={18} className='mr-2' />}
                      className='btn-fichar-primary px-5 py-3'
                      onClick={handlePostComment}
                      loading={postingComment}
                      disabled={!newComment.trim()}
                    />
                  </div>
                </div>
                <div className='flex flex-column gap-5'>
                  {comments.length > 0 ? (
                    comments.map((c) => (
                      <div key={c.id} className='flex gap-4 align-items-start'>
                        <Avatar
                          image={c.profiles?.avatar_url}
                          icon={
                            !c.profiles?.avatar_url ? (
                              <User size={20} />
                            ) : undefined
                          }
                          shape='circle'
                          size='xlarge'
                          className='flex-shrink-0 bg-white text-blue-600 cursor-pointer shadow-2 border-2 border-white'
                          onClick={() => navigate(`/usuario/${c.user_id}`)}
                        />
                        <div className='flex-1 comment-bubble'>
                          <div className='flex justify-content-between align-items-center mb-2'>
                            <span
                              className='font-bold text-900 text-lg cursor-pointer hover:text-blue-600 transition-colors'
                              onClick={() => navigate(`/usuario/${c.user_id}`)}
                            >
                              {c.profiles?.username}
                            </span>
                            <span className='text-xs text-500 font-bold bg-gray-100 px-3 py-1 border-round-2xl'>
                              {new Date(c.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className='m-0 text-600 line-height-4 text-md'>
                            {c.content}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className='text-center py-7 bg-gray-50 border-round-3xl border-2 border-gray-100 border-dashed'>
                      <MessageSquare
                        size={48}
                        className='text-300 mb-4 mx-auto'
                      />
                      <div className='text-600 font-medium text-lg'>
                        Aún no hay comentarios. ¡Anímate!
                      </div>
                    </div>
                  )}
                </div>
              </MotionDiv>

              {/* ORGANIZADO POR - MOBILE ONLY */}
              <MotionDiv
                variants={itemAnim}
                className='fichar-card block lg:hidden mt-4'
              >
                <div className='text-900 font-bold mb-4 text-xs uppercase tracking-widest text-400'>
                  Organizado por
                </div>
                <div
                  className='flex align-items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity'
                  onClick={() => navigate(`/usuario/${event.user_id}`)}
                >
                  <Avatar
                    image={event.profiles?.avatar_url || undefined}
                    icon={
                      !event.profiles?.avatar_url ? (
                        <User size={24} />
                      ) : undefined
                    }
                    size='xlarge'
                    shape='circle'
                    className='bg-blue-50 text-blue-600 shadow-2 border-2 border-white'
                    style={{ width: '4.5rem', height: '4.5rem' }}
                  />
                  <div className='flex flex-column'>
                    <span className='font-black text-2xl text-900'>
                      {event.profiles?.username || 'Anónimo'}
                    </span>
                    <span className='text-blue-600 text-md font-bold mt-1 flex align-items-center gap-1'>
                      Ver perfil <ChevronRight size={16} />
                    </span>
                  </div>
                </div>
                <CreatorControls />
              </MotionDiv>
            </div>

            {/* RIGHT COLUMN */}
            <div className='col-12 lg:col-4 flex-order-0 lg:flex-order-1'>
              <div
                className='flex flex-column gap-5 sticky'
                style={{ top: '2rem' }}
              >
                <MotionDiv variants={itemAnim} className='fichar-card m-0'>
                  {!isPast && (
                    <div className='mb-6'>
                      <div className='text-xs font-black text-500 uppercase tracking-widest mb-4 text-center'>
                        El evento comienza en
                      </div>
                      <div className='countdown-container'>
                        <div className='countdown-box'>
                          <span className='countdown-number'>
                            {timeLeft.days}
                          </span>
                          <span className='countdown-label'>Días</span>
                        </div>
                        <div className='countdown-box'>
                          <span className='countdown-number'>
                            {timeLeft.hours}
                          </span>
                          <span className='countdown-label'>Hrs</span>
                        </div>
                        <div className='countdown-box'>
                          <span className='countdown-number'>
                            {timeLeft.minutes}
                          </span>
                          <span className='countdown-label'>Min</span>
                        </div>
                        <div className='countdown-box'>
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
                    className={`w-full mb-4 justify-content-center ${isPast ? 'p-button-secondary bg-gray-300 shadow-none border-none text-white' : isAttending ? 'btn-fichar-success' : 'btn-fichar-primary'}`}
                    onClick={handleAttendToggle}
                    loading={attendingLoading}
                    disabled={isPast}
                  >
                    {!attendingLoading &&
                      (isAttending || isPast ? (
                        <div className='mr-3 bg-white text-green-600 border-circle w-1.5rem h-1.5rem flex align-items-center justify-content-center'>
                          <i className='pi pi-check text-xs font-bold'></i>
                        </div>
                      ) : null)}
                  </Button>

                  {!isPast && (
                    <Button
                      label='Añadir al Calendario'
                      icon={<CalendarPlus size={20} className='mr-2' />}
                      className='w-full p-4 font-bold border-round-2xl bg-white text-700 border-2 border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors mb-5 justify-content-center text-md shadow-none'
                      onClick={handleAddToCalendar}
                    />
                  )}

                  <div
                    className='bg-white border-round-3xl mb-5 border-2 border-gray-100 cursor-pointer hover:border-blue-300 hover:shadow-3 transition-all p-5 relative overflow-hidden group'
                    onClick={() => setShowAttendeesModal(true)}
                  >
                    <div className='flex justify-content-between align-items-center mb-4 relative z-1'>
                      <span className='text-xs font-black text-600 uppercase tracking-widest'>
                        Asistentes
                      </span>
                      <Tag
                        value={attendees.length}
                        className='bg-blue-100 text-blue-700 font-black border-round-2xl px-3 py-1 text-sm'
                      />
                    </div>
                    <div className='relative z-1 mb-4'>
                      {attendees.length > 0 ? (
                        <AvatarGroup>
                          {attendees.slice(0, 5).map((a, i) => (
                            <Avatar
                              key={i}
                              image={a.profiles?.avatar_url || undefined}
                              icon={
                                !a.profiles?.avatar_url ? (
                                  <User size={20} />
                                ) : undefined
                              }
                              size='xlarge'
                              shape='circle'
                              className='border-2 border-white bg-gray-100 text-gray-600 shadow-2'
                            />
                          ))}
                          {attendees.length > 5 && (
                            <Avatar
                              label={`+${attendees.length - 5}`}
                              shape='circle'
                              size='xlarge'
                              className='bg-gray-100 text-600 font-bold border-2 border-white shadow-2'
                            />
                          )}
                        </AvatarGroup>
                      ) : (
                        <div className='text-400 text-md font-medium flex align-items-center gap-3'>
                          <Users size={20} /> Sé el primero en apuntarte
                        </div>
                      )}
                    </div>
                    <div className='text-900 text-xs font-black pt-4 border-top-1 surface-border flex align-items-center justify-content-between uppercase tracking-widest relative z-1'>
                      <span>Ver lista completa</span>
                      <ChevronRight size={18} />
                    </div>
                  </div>

                  <Button
                    label={
                      isFavorite
                        ? 'Guardado en Favoritos'
                        : 'Añadir a Favoritos'
                    }
                    icon={
                      <Heart
                        size={20}
                        className={`mr-2 ${isFavorite ? 'fill-current text-pink-500' : ''}`}
                      />
                    }
                    className={`w-full p-4 font-bold border-round-2xl transition-all text-md justify-content-center shadow-none ${isFavorite ? 'bg-pink-50 text-pink-700 border-2 border-pink-200' : 'bg-white text-700 border-2 border-gray-100 hover:bg-gray-50'}`}
                    onClick={toggleFavorite}
                    loading={favLoading}
                    disabled={isPast}
                  />
                </MotionDiv>

                {/* ORGANIZADO POR - DESKTOP ONLY */}
                <MotionDiv
                  variants={itemAnim}
                  className='fichar-card m-0 hidden lg:block'
                >
                  <div className='text-900 font-bold mb-4 text-xs uppercase tracking-widest text-400'>
                    Organizado por
                  </div>
                  <div
                    className='flex align-items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity'
                    onClick={() => navigate(`/usuario/${event.user_id}`)}
                  >
                    <Avatar
                      image={event.profiles?.avatar_url || undefined}
                      icon={
                        !event.profiles?.avatar_url ? (
                          <User size={24} />
                        ) : undefined
                      }
                      size='xlarge'
                      shape='circle'
                      className='bg-blue-50 text-blue-600 shadow-2 border-2 border-white'
                      style={{ width: '4.5rem', height: '4.5rem' }}
                    />
                    <div className='flex flex-column'>
                      <span className='font-black text-xl text-900'>
                        {event.profiles?.username || 'Anónimo'}
                      </span>
                      <span className='text-blue-600 text-sm font-bold mt-1 flex align-items-center gap-1'>
                        Ver perfil <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                  <CreatorControls />
                </MotionDiv>
              </div>
            </div>
          </MotionDiv>

          {/* DIÁLOGO: ASISTENTES */}
          <Dialog
            header={
              <span className='text-2xl font-black text-900'>Asistentes</span>
            }
            visible={showAttendeesModal}
            onHide={() => setShowAttendeesModal(false)}
            breakpoints={{ '960px': '75vw', '640px': '90vw' }}
            style={{ width: '30vw' }}
            className='border-round-3xl shadow-8'
            contentClassName='p-5'
            headerClassName='px-5 pt-5 pb-2 border-none'
          >
            <div className='flex flex-column gap-3 mt-3'>
              <AnimatePresence>
                {attendees.map((a, i) => (
                  <MotionDiv
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={i}
                    className='flex align-items-center justify-content-between p-4 border-round-3xl hover:bg-gray-50 transition-colors cursor-pointer border-2 border-transparent hover:border-gray-100'
                    onClick={() => {
                      setShowAttendeesModal(false)
                      navigate(`/usuario/${a.user_id}`)
                    }}
                  >
                    <div className='flex align-items-center gap-4'>
                      <Avatar
                        image={a.profiles?.avatar_url || undefined}
                        icon={
                          !a.profiles?.avatar_url ? (
                            <User size={24} />
                          ) : undefined
                        }
                        shape='circle'
                        size='xlarge'
                        className='bg-white text-blue-600 shadow-2 border-2 border-white'
                      />
                      <span className='font-bold text-900 text-lg'>
                        {a.profiles?.username || 'Usuario Anónimo'}
                      </span>
                    </div>
                    <ChevronRight size={24} className='text-400' />
                  </MotionDiv>
                ))}
              </AnimatePresence>
              {attendees.length === 0 && (
                <div className='text-center text-500 py-8 flex flex-column align-items-center gap-4 bg-gray-50 border-round-3xl border-2 border-gray-100 border-dashed'>
                  <Users size={48} className='text-300' />
                  <span className='font-medium text-lg'>
                    Aún no hay asistentes confirmados.
                  </span>
                </div>
              )}
            </div>
          </Dialog>

          {/* DIÁLOGO: EDITAR EVENTO (Creador) */}
          <Dialog
            header={
              <span className='text-2xl font-black text-900'>
                Editar Descripción y Fotos
              </span>
            }
            visible={showEditModal}
            onHide={() => setShowEditModal(false)}
            breakpoints={{ '960px': '90vw' }}
            style={{ width: '40vw' }}
            className='border-round-3xl shadow-8'
            contentClassName='p-5'
            headerClassName='px-5 pt-5 pb-2 border-none'
          >
            <div className='flex flex-column gap-4 pt-2'>
              <div>
                <label className='block text-sm font-bold text-700 mb-2'>
                  Descripción del evento
                </label>
                <InputTextarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={5}
                  autoResize
                  className='w-full border-round-xl p-3'
                />
              </div>

              <div>
                <label className='block text-sm font-bold text-700 mb-2'>
                  Fotos Adicionales
                </label>
                <div className='grid gap-2 mb-3'>
                  {extraImages.map((img) => (
                    <div key={img.id} className='col-4 relative'>
                      <img
                        src={img.image_url}
                        alt='Extra'
                        className='w-full border-round-xl object-cover'
                        style={{ height: '100px' }}
                      />
                      <Button
                        icon={<X size={14} />}
                        className='p-button-rounded p-button-danger p-button-sm absolute top-0 right-0 m-1'
                        style={{ width: '24px', height: '24px' }}
                        onClick={() => handleDeleteExtraImage(img.id)}
                      />
                    </div>
                  ))}
                  <div className='col-4'>
                    <div
                      className='border-dashed border-2 border-300 border-round-xl flex align-items-center justify-content-center relative hover:bg-gray-50 transition-colors'
                      style={{ height: '100px' }}
                    >
                      <input
                        type='file'
                        accept='image/*'
                        onChange={handleUploadExtraImage}
                        className='absolute inset-0 w-full h-full opacity-0 cursor-pointer z-1'
                        disabled={uploadingExtra}
                      />
                      <div className='text-center text-500'>
                        {uploadingExtra ? (
                          <i className='pi pi-spin pi-spinner text-xl'></i>
                        ) : (
                          <Camera size={24} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                label='Guardar Cambios'
                className='btn-fichar-primary w-full mt-3'
                onClick={handleSaveDescription}
              />
            </div>
          </Dialog>

          {/* DIÁLOGO: CONFIRMAR ELIMINACIÓN */}
          <Dialog
            header='¿Eliminar Evento?'
            visible={showDeleteModal}
            onHide={() => setShowDeleteModal(false)}
            style={{ width: '30vw' }}
            breakpoints={{ '960px': '80vw' }}
            className='border-round-2xl'
          >
            <p className='m-0 mb-4 line-height-3'>
              Esta acción es irreversible. Se borrarán los detalles, asistentes
              y comentarios asociados a este evento.
            </p>
            <div className='flex justify-content-end gap-3'>
              <Button
                label='Cancelar'
                outlined
                onClick={() => setShowDeleteModal(false)}
                className='border-round-xl font-bold'
              />
              <Button
                label='Sí, Eliminar'
                severity='danger'
                onClick={handleDeleteEvent}
                className='border-round-xl font-bold'
              />
            </div>
          </Dialog>
        </div>
      </MotionDiv>
    </PageTransition>
  )
}

export default EventDetailPage
