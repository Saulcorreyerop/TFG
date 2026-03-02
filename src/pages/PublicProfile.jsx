import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Avatar } from 'primereact/avatar'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Toast } from 'primereact/toast'
import { Galleria } from 'primereact/galleria'
import { Dialog } from 'primereact/dialog'
import PageTransition from '../components/PageTransition'
import {
  Share2,
  UserPlus,
  UserCheck,
  Car,
  Flag,
  Calendar,
  MapPin,
  Image as ImageIcon,
  Shield,
  Heart,
} from 'lucide-react'
import './ProfilePage.css'
import SEO from '../components/SEO'
import { sendPushNotification } from '../utils/onesignal'

const PublicProfile = () => {
  const { userId, username } = useParams()
  const identifier = username || userId
  const navigate = useNavigate()
  const toast = useRef(null)

  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [userCrew, setUserCrew] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [createdEvents, setCreatedEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  const [galleryImages, setGalleryImages] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
  }, [])

  useEffect(() => {
    const fetchPublicData = async () => {
      setLoading(true)
      try {
        const isUUID =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            identifier,
          )

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq(isUUID ? 'id' : 'username', identifier)
          .single()

        if (profileError || !profileData)
          throw new Error('Usuario no encontrado')
        setProfile(profileData)
        const actualUserId = profileData.id

        const { data: crewMemberData } = await supabase
          .from('crew_members')
          .select('crews(*)')
          .eq('user_id', actualUserId)
          .eq('status', 'approved')
          .limit(1)
          .maybeSingle()

        if (crewMemberData && crewMemberData.crews) {
          setUserCrew(crewMemberData.crews)
        }

        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('*, vehicle_images(*), vehicle_likes(user_id)')
          .eq('user_id', actualUserId)

        if (vehicleData) {
          const formattedVehicles = vehicleData.map((v) => {
            const likesArray = v.vehicle_likes || []
            const isLikedByMe = session
              ? likesArray.some((like) => like.user_id === session.user.id)
              : false
            return {
              ...v,
              likesCount: likesArray.length,
              isLikedByMe,
            }
          })
          setVehicles(formattedVehicles)
        }

        const { data: eventsData } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', actualUserId)
          .order('fecha', { ascending: false })
        if (eventsData) setCreatedEvents(eventsData)

        const { count: f1 } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', actualUserId)
        const { count: f2 } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', actualUserId)
        setFollowersCount(f1 || 0)
        setFollowingCount(f2 || 0)

        if (session?.user?.id) {
          const { data: followData } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', session.user.id)
            .eq('following_id', actualUserId)
            .maybeSingle()
          setIsFollowing(!!followData)
        }
      } catch (error) {
        console.error('Error cargando perfil:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPublicData()
  }, [identifier, session])

  const openGalleryViewer = (car) => {
    const images = []
    if (car.image_url)
      images.push({
        itemImageSrc: car.image_url,
        thumbnailImageSrc: car.image_url,
        alt: 'Principal',
      })
    if (car.vehicle_images && car.vehicle_images.length > 0) {
      car.vehicle_images.forEach((img) => {
        images.push({
          itemImageSrc: img.image_url,
          thumbnailImageSrc: img.image_url,
          alt: 'Detalle',
        })
      })
    }
    if (images.length > 0) setGalleryImages(images)
  }

  const galleryItemTemplate = (item) => {
    return (
      <img
        src={item.itemImageSrc}
        alt={item.alt}
        style={{
          width: '100%',
          maxHeight: '70vh',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    )
  }

  const galleryThumbnailTemplate = (item) => {
    return (
      <img
        src={item.thumbnailImageSrc}
        alt={item.alt}
        style={{
          width: '100%',
          height: '80px',
          objectFit: 'cover',
          display: 'block',
          borderRadius: '4px',
        }}
      />
    )
  }

  const handleToggleLikeVehicle = async (e, vehicleId, isCurrentlyLiked) => {
    e.stopPropagation()

    if (!session?.user?.id) {
      toast.current.show({
        severity: 'info',
        summary: 'Acceso',
        detail: 'Inicia sesión para dar Respetos.',
      })
      return navigate('/login', {
        state: { returnUrl: `/usuario/${identifier}` },
      })
    }

    setVehicles((prevVehicles) =>
      prevVehicles.map((v) => {
        if (v.id === vehicleId) {
          return {
            ...v,
            isLikedByMe: !isCurrentlyLiked,
            likesCount: isCurrentlyLiked ? v.likesCount - 1 : v.likesCount + 1,
          }
        }
        return v
      }),
    )

    try {
      if (isCurrentlyLiked) {
        await supabase
          .from('vehicle_likes')
          .delete()
          .match({ user_id: session.user.id, vehicle_id: vehicleId })
      } else {
        await supabase
          .from('vehicle_likes')
          .insert({ user_id: session.user.id, vehicle_id: vehicleId })

        if (profile.id !== session.user.id) {
          await supabase.from('notifications').insert({
            user_id: profile.id,
            actor_id: session.user.id,
            tipo: 'nuevo_like_vehiculo',
          })

          // 🚀 NOTIFICACIÓN PUSH PERSONALIZADA
          const myName =
            session.user.user_metadata?.username || 'Un miembro de la comunidad'
          await sendPushNotification(
            [profile.id],
            '¡Nuevos Respetos! 🚘',
            `¡A ${myName} le gusta tu garaje!`,
            `/usuario/${profile.username}`,
          )
        }
      }
    } catch (err) {
      console.error('Error al dar like al vehículo:', err)
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar la acción',
      })
    }
  }

  const handleFollowToggle = async () => {
    if (!session?.user?.id) {
      toast.current.show({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Inicia sesión para seguir usuarios',
      })
      return navigate('/login')
    }

    setFollowLoading(true)
    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', session.user.id)
          .eq('following_id', profile.id)
        setFollowersCount((prev) => prev - 1)
        setIsFollowing(false)
      } else {
        const { error: insertError } = await supabase
          .from('follows')
          .insert({ follower_id: session.user.id, following_id: profile.id })

        if (!insertError) {
          setIsFollowing(true)
          setFollowersCount((prev) => prev + 1)

          await supabase.from('notifications').insert({
            user_id: profile.id,
            actor_id: session.user.id,
            tipo: 'nuevo_seguidor',
          })

          // 🚀 NOTIFICACIÓN PUSH PERSONALIZADA
          const myName =
            session.user.user_metadata?.username || 'Un miembro de la comunidad'
          await sendPushNotification(
            [profile.id],
            '¡Nuevo seguidor! 👤',
            `¡${myName} ha empezado a seguir tu perfil!`,
            `/usuario/${profile.username}`,
          )
        }
      }
    } catch (error) {
      console.error('Error en seguimiento:', error)
    } finally {
      setFollowLoading(false)
    }
  }

  const handleShare = () => {
    const url = `${window.location.origin}/usuario/${profile.username}`
    if (navigator.share) {
      navigator
        .share({ title: `Garaje de ${profile?.username}`, url })
        .catch(() => {})
    } else {
      navigator.clipboard.writeText(url)
      toast.current.show({
        severity: 'success',
        summary: 'Copiado',
        detail: 'Enlace copiado al portapapeles.',
        life: 2000,
      })
    }
  }

  if (loading)
    return (
      <div className='flex justify-content-center p-8'>
        <ProgressSpinner />
      </div>
    )
  if (!profile)
    return (
      <div className='text-center p-8 text-2xl font-bold text-500'>
        Usuario no encontrado
      </div>
    )

  const isMyOwnProfile = session?.user?.id === profile.id

  const renderEventCard = (event) => (
    <div key={event.id} className='col-12 md:col-6 lg:col-4 p-2'>
      <div
        className='event-card-modern'
        onClick={() => navigate(`/evento/${event.id}`)}
      >
        <div className='event-card-body'>
          <Tag
            value={event.tipo}
            className='w-min mb-3 bg-blue-50 text-blue-700 font-bold'
          />
          <h4 className='m-0 mb-3 text-xl font-black text-900 line-clamp-1'>
            {event.titulo}
          </h4>
          <div className='mt-auto flex flex-column gap-2'>
            <div className='flex align-items-center gap-2 text-sm text-500 font-medium'>
              <Calendar size={16} className='text-blue-500' />
              <span>
                {new Date(event.fecha).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className='flex align-items-center gap-2 text-sm text-500 font-medium'>
              <MapPin size={16} className='text-red-500' />
              <span className='line-clamp-1'>
                {event.ubicacion || 'En mapa'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <SEO
        title={`Perfil de ${profile.username}`}
        description={
          profile.bio ||
          `Descubre el garaje, los eventos y la crew de ${profile.username} en la comunidad de CarMeet ESP.`
        }
        image={
          profile.avatar_url ||
          'https://stryumcmeavlvjaamcaw.supabase.co/storage/v1/object/public/crews/default-share.jpg'
        }
        url={window.location.href}
        type='profile'
      />

      <PageTransition>
        <div className='max-w-6xl mx-auto p-3 md:p-5 min-h-screen'>
          <Toast ref={toast} />

          <Dialog
            visible={!!galleryImages}
            onHide={() => setGalleryImages(null)}
            header={`Galería de ${profile.username}`}
            style={{ width: '90vw', maxWidth: '800px' }}
            dismissableMask
          >
            {galleryImages && (
              <Galleria
                value={galleryImages}
                numVisible={5}
                circular
                autoPlay
                transitionInterval={3000}
                item={galleryItemTemplate}
                thumbnail={galleryThumbnailTemplate}
                style={{ maxWidth: '100%' }}
              />
            )}
          </Dialog>

          <div className='flex justify-content-between align-items-center mb-4'>
            <Button
              label='Volver'
              icon='pi pi-arrow-left'
              text
              className='font-bold text-700'
              onClick={() => navigate(-1)}
            />
            <Button
              icon={<Share2 size={18} />}
              rounded
              text
              className='bg-white shadow-1'
              onClick={handleShare}
            />
          </div>

          <div className='bg-white shadow-2 border-round-3xl p-5 md:p-6 mb-5 flex flex-column md:flex-row align-items-center gap-5 border-1 border-100'>
            <Avatar
              icon='pi pi-user'
              size='xlarge'
              shape='circle'
              className='bg-blue-50 text-blue-600 w-8rem h-8rem text-5xl shadow-2 border-2 border-white flex-shrink-0'
              image={profile.avatar_url}
            />
            <div className='text-center md:text-left flex-1'>
              <h1 className='text-3xl font-black m-0 text-900'>
                {profile.username || 'Usuario'}
              </h1>
              {profile.bio ? (
                <p className='text-600 mt-2 mb-0 font-medium line-height-3 max-w-30rem mx-auto md:mx-0'>
                  {profile.bio}
                </p>
              ) : (
                <p className='text-500 mt-1 mb-0 font-medium'>
                  Miembro de CarMeet ESP
                </p>
              )}
              {userCrew && (
                <div className='mt-3'>
                  <div
                    className='inline-flex align-items-center gap-2 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer border-round-3xl pr-4 p-1 border-1 border-300'
                    onClick={() => navigate(`/crew/${userCrew.name}`)}
                  >
                    <Avatar
                      image={userCrew.profile_image_url}
                      icon={!userCrew.profile_image_url && <Shield size={14} />}
                      shape='circle'
                      className='w-2rem h-2rem shadow-1'
                    />
                    <span className='font-bold text-sm text-900'>
                      {userCrew.name}
                    </span>
                  </div>
                </div>
              )}
              {!isMyOwnProfile && (
                <div className='mt-4'>
                  <Button
                    label={isFollowing ? 'Siguiendo' : 'Seguir'}
                    icon={
                      isFollowing ? (
                        <UserCheck size={18} className='mr-2' />
                      ) : (
                        <UserPlus size={18} className='mr-2' />
                      )
                    }
                    className={`border-round-xl font-bold px-4 ${isFollowing ? 'p-button-outlined p-button-secondary' : ''}`}
                    style={
                      !isFollowing
                        ? {
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                          }
                        : {}
                    }
                    onClick={handleFollowToggle}
                    loading={followLoading}
                  />
                </div>
              )}
            </div>

            <div className='flex gap-4 md:gap-5 text-center border-top-1 md:border-top-none md:border-left-1 border-200 pt-4 md:pt-0 md:pl-5 w-full md:w-auto justify-content-center'>
              <div>
                <div className='text-2xl font-black text-900'>
                  {vehicles.length}
                </div>
                <div className='text-xs font-bold text-500 uppercase tracking-widest'>
                  Coches
                </div>
              </div>
              <div>
                <div className='text-2xl font-black text-900'>
                  {followersCount}
                </div>
                <div className='text-xs font-bold text-500 uppercase tracking-widest'>
                  Seguidores
                </div>
              </div>
              <div>
                <div className='text-2xl font-black text-900'>
                  {followingCount}
                </div>
                <div className='text-xs font-bold text-500 uppercase tracking-widest'>
                  Seguidos
                </div>
              </div>
            </div>
          </div>

          <section className='profile-section'>
            <h2 className='profile-section-title'>
              <Car className='text-purple-600' size={28} /> Garaje de{' '}
              {profile.username}
            </h2>
            {vehicles.length === 0 ? (
              <div className='empty-state-box'>
                <Car size={48} className='text-300 mb-3 mx-auto' />
                <span className='block font-bold text-lg'>
                  Aún no ha subido vehículos.
                </span>
              </div>
            ) : (
              <div className='grid m-0'>
                {vehicles.map((v) => {
                  const totalImages =
                    (v.image_url ? 1 : 0) +
                    (v.vehicle_images ? v.vehicle_images.length : 0)

                  return (
                    <div key={v.id} className='col-12 sm:col-6 lg:col-4 p-2'>
                      <div className='vehicle-card hover:-translate-y-1 hover:shadow-2 flex flex-column overflow-hidden bg-white'>
                        {/* ZONA CLICABLE: ABRE GALERÍA */}
                        <div
                          className='cursor-pointer flex-grow-1'
                          onClick={() => openGalleryViewer(v)}
                        >
                          <div
                            className='vehicle-img-wrapper relative'
                            style={{ height: '220px' }}
                          >
                            {v.image_url ? (
                              <img
                                src={v.image_url}
                                alt={v.modelo}
                                className='w-full h-full'
                                style={{ objectFit: 'cover' }}
                              />
                            ) : (
                              <div className='flex h-full align-items-center justify-content-center text-300 bg-gray-100'>
                                <ImageIcon size={40} />
                              </div>
                            )}

                            <Tag
                              value={v.combustible}
                              className='absolute top-0 right-0 m-3 bg-black-alpha-60 backdrop-blur-sm px-3'
                            />

                            {/* CONTADOR DE LIKES (ESTÁTICO, SIN ONCLICK) */}
                            <div className='absolute top-0 left-0 m-2 flex align-items-center gap-2 bg-black-alpha-50 backdrop-blur-sm px-3 py-2 border-round-3xl border-1 border-white-alpha-20 z-10'>
                              <Heart
                                size={16}
                                fill={v.likesCount > 0 ? '#ec4899' : 'none'}
                                className={`${v.likesCount > 0 ? 'text-pink-500' : 'text-white'}`}
                              />
                              <span className='text-white font-bold text-sm'>
                                {v.likesCount}
                              </span>
                            </div>

                            {totalImages > 1 && (
                              <div className='gallery-indicator-badge absolute bottom-0 right-0 m-2 bg-black-alpha-60 text-white text-xs px-2 py-1 border-round'>
                                <i className='pi pi-images mr-1'></i> 1/
                                {totalImages}
                              </div>
                            )}
                          </div>

                          <div className='p-4 text-center'>
                            <h3 className='font-black text-2xl text-900 mb-1 m-0 line-clamp-1'>
                              {v.marca} {v.modelo}
                            </h3>
                            <div className='text-md text-500 font-bold mb-3'>
                              {v.anio} • {v.cv} CV
                            </div>
                            {v.descripcion && (
                              <p className='text-600 text-sm line-clamp-2 m-0 bg-gray-50 p-3 border-round-xl border-1 border-100'>
                                {v.descripcion}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* NUEVA BARRA DE ACCIÓN INFERIOR */}
                        <div className='border-top-1 border-100 p-3 bg-gray-50 mt-auto'>
                          <Button
                            label={
                              v.isLikedByMe
                                ? 'Marcado como me gusta'
                                : 'Me gusta'
                            }
                            icon={
                              <Heart
                                size={18}
                                fill={v.isLikedByMe ? 'currentColor' : 'none'}
                                className={`mr-2 ${v.isLikedByMe ? 'text-pink-500' : ''}`}
                              />
                            }
                            className={`w-full font-bold border-round-xl transition-all ${v.isLikedByMe ? 'p-button-outlined p-button-secondary bg-white' : 'p-button-help shadow-2 hover:shadow-4'}`}
                            onClick={(e) =>
                              handleToggleLikeVehicle(e, v.id, v.isLikedByMe)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className='profile-section mb-0'>
            <h2 className='profile-section-title'>
              <Flag className='text-blue-600' size={28} /> Eventos Organizados
            </h2>
            {createdEvents.length === 0 ? (
              <div className='empty-state-box'>
                <Flag size={48} className='text-300 mb-3 mx-auto' />
                <span className='block font-bold text-lg'>
                  No ha organizado eventos.
                </span>
              </div>
            ) : (
              <div className='grid m-0'>
                {createdEvents.map(renderEventCard)}
              </div>
            )}
          </section>
        </div>
      </PageTransition>
    </>
  )
}

export default PublicProfile
