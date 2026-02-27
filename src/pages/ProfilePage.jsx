import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Avatar } from 'primereact/avatar'
import { Button } from 'primereact/button'
import { useNavigate } from 'react-router-dom'
import { Tag } from 'primereact/tag'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Toast } from 'primereact/toast'
import { Galleria } from 'primereact/galleria'
import PageTransition from '../components/PageTransition'
import imageCompression from 'browser-image-compression'
import {
  Share2,
  Car,
  Flag,
  CheckCircle,
  Heart,
  Calendar,
  MapPin,
  PlusCircle,
  LogOut,
  Image as ImageIcon,
  Shield,
} from 'lucide-react'
import './ProfilePage.css'
import SEO from '../components/SEO'

const ProfilePage = ({ session }) => {
  const navigate = useNavigate()
  const toast = useRef(null)

  const [profile, setProfile] = useState(null)
  const [myVehicles, setMyVehicles] = useState([])
  const [myCrew, setMyCrew] = useState(null)

  // Estados de Eventos
  const [favorites, setFavorites] = useState([])
  const [attendingEvents, setAttendingEvents] = useState([])
  const [createdEvents, setCreatedEvents] = useState([])

  // Estados de Seguidores
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)

  const [showEditDialog, setShowEditDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editForm, setEditForm] = useState({
    username: '',
    avatar_url: null,
    bio: '',
  })
  const [avatarFile, setAvatarFile] = useState(null)

  // ESTADO PARA LA GALERÍA
  const [galleryImages, setGalleryImages] = useState(null)

  useEffect(() => {
    if (session) {
      fetchAllData()
    }
    // eslint-disable-next-line
  }, [session])

  const fetchAllData = async () => {
    // 1. Perfil
    const { data: profData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    setProfile(profData)
    if (profData) {
      setEditForm({
        username: profData.username || '',
        avatar_url: profData.avatar_url,
        bio: profData.bio || '',
      })
    }

    // 2. Vehículos (Ahora traemos TODAS las fotos)
    const { data: vehData } = await supabase
      .from('vehicles')
      .select('*, vehicle_images(*)')
      .eq('user_id', session.user.id)
    if (vehData) setMyVehicles(vehData)

    // 3. Mi Crew
    const { data: crewMemberData } = await supabase
      .from('crew_members')
      .select('crews(*)')
      .eq('user_id', session.user.id)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle()

    if (crewMemberData && crewMemberData.crews) {
      setMyCrew(crewMemberData.crews)
    }

    // 4. Favoritos
    const { data: favData } = await supabase
      .from('favorites')
      .select(`event_id, events (*)`)
      .eq('user_id', session.user.id)
    if (favData)
      setFavorites(
        favData.map((item) => item.events).filter((ev) => ev !== null),
      )

    // 5. Asistencias
    const { data: attData } = await supabase
      .from('event_attendees')
      .select(`event_id, events (*)`)
      .eq('user_id', session.user.id)
    if (attData)
      setAttendingEvents(
        attData.map((item) => item.events).filter((ev) => ev !== null),
      )

    // 6. Creados
    const { data: creData } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', session.user.id)
      .order('fecha', { ascending: false })
    if (creData) setCreatedEvents(creData)

    // 7. Seguidores
    try {
      const { count: f1 } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', session.user.id)
      const { count: f2 } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', session.user.id)
      setFollowersCount(f1 || 0)
      setFollowingCount(f2 || 0)
    } catch (err) {
      console.warn('Tabla follows no lista aún o error:', err)
    }
  }

  // --- LÓGICA DE GALERÍA ---
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
    else navigate('/garaje') // Si no hay fotos ni siquiera principal, le mandamos a su garaje a añadir
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

  const handleAvatarUpload = async (file) => {
    const options = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.8,
    }
    const compressedFile = await imageCompression(file, options)
    const filePath = `${session.user.id}-${Date.now()}.webp`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, compressedFile, { contentType: 'image/webp' })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
    return data.publicUrl
  }

  const handleSaveProfile = async () => {
    setLoading(true)
    try {
      let finalAvatarUrl = editForm.avatar_url
      if (avatarFile) {
        toast.current.show({
          severity: 'info',
          summary: 'Optimizando',
          detail: 'Procesando imagen de perfil...',
          life: 2000,
        })
        finalAvatarUrl = await handleAvatarUpload(avatarFile)
      }
      const { error } = await supabase
        .from('profiles')
        .update({
          username: editForm.username,
          avatar_url: finalAvatarUrl,
          bio: editForm.bio,
          updated_at: new Date(),
        })
        .eq('id', session.user.id)
      if (error) throw error
      toast.current.show({
        severity: 'success',
        summary: 'Actualizado',
        detail: 'Perfil modificado correctamente',
      })
      setShowEditDialog(false)
      setAvatarFile(null)
      fetchAllData()
    } catch (err) {
      console.error('Error guardando perfil:', err)
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo actualizar el perfil',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleShareMyProfile = async () => {
    const profileUrl = `${window.location.origin}/usuario/${profile?.username}`
    if (navigator.share) {
      navigator
        .share({ title: `Perfil de ${profile?.username}`, url: profileUrl })
        .catch(() => {})
    } else {
      navigator.clipboard.writeText(profileUrl)
      toast.current.show({
        severity: 'success',
        summary: 'Enlace copiado',
        detail: 'Enlace copiado al portapapeles.',
        life: 3000,
      })
    }
  }

  if (!session)
    return (
      <div className='p-5 text-center font-bold text-xl'>
        Inicia sesión para ver tu perfil
      </div>
    )

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
                {event.ubicacion || 'Ubicación en mapa'}
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
        title='Mi Panel'
        description='Gestiona tu perfil, tus coches y tus eventos guardados en CarMeet ESP.'
        url={window.location.href}
      />
      <PageTransition>
        <div className='max-w-6xl mx-auto p-3 md:p-5'>
          <Toast ref={toast} />

          {/* VISOR DE GALERÍA PANTALLA COMPLETA */}
          <Dialog
            visible={!!galleryImages}
            onHide={() => setGalleryImages(null)}
            header='Galería del Vehículo'
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

          {/* HEADER DEL PERFIL */}
          <div className='bg-white shadow-2 border-round-3xl p-5 md:p-6 mb-5 flex flex-column lg:flex-row align-items-center gap-5 border-1 border-100'>
            <div className='relative'>
              <Avatar
                icon='pi pi-user'
                size='xlarge'
                shape='circle'
                className='bg-blue-50 text-blue-600 w-8rem h-8rem text-5xl shadow-2 border-2 border-white'
                image={profile?.avatar_url}
              />
            </div>

            <div className='text-center lg:text-left flex-1'>
              <h1 className='text-3xl font-black m-0 text-900'>
                {profile?.username || 'Usuario'}
              </h1>

              {/* Biografía */}
              {profile?.bio ? (
                <p className='text-600 mt-2 mb-0 font-medium line-height-3 max-w-30rem mx-auto lg:mx-0'>
                  {profile.bio}
                </p>
              ) : (
                <p className='text-500 mt-1 mb-0 font-medium'>
                  {session.user.email}
                </p>
              )}

              {/* Crew Badge */}
              <div className='mt-3'>
                {myCrew ? (
                  <div
                    className='inline-flex align-items-center gap-2 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer border-round-3xl pr-4 p-1 border-1 border-300'
                    onClick={() => navigate(`/crew/${myCrew.name}`)}
                  >
                    <Avatar
                      image={myCrew.profile_image_url}
                      icon={!myCrew.profile_image_url && <Shield size={14} />}
                      shape='circle'
                      className='w-2rem h-2rem shadow-1'
                    />
                    <span className='font-bold text-sm text-900'>
                      {myCrew.name}
                    </span>
                  </div>
                ) : (
                  <div
                    className='inline-flex align-items-center gap-2 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer border-round-3xl px-3 py-2 border-1 border-blue-200'
                    onClick={() =>
                      navigate('/comunidad', { state: { tab: 'crews' } })
                    }
                  >
                    <Shield size={16} className='text-blue-600' />
                    <span className='font-bold text-sm text-blue-700'>
                      Descubrir Crews
                    </span>
                  </div>
                )}
              </div>

              <div className='flex flex-wrap gap-2 justify-content-center lg:justify-content-start mt-4'>
                <Button
                  label='Editar Perfil'
                  icon='pi pi-pencil'
                  size='small'
                  outlined
                  className='border-round-xl font-bold'
                  onClick={() => setShowEditDialog(true)}
                />
                <Button
                  label='Compartir'
                  icon={<Share2 size={16} className='mr-2' />}
                  size='small'
                  outlined
                  severity='info'
                  className='border-round-xl font-bold'
                  onClick={handleShareMyProfile}
                />
                <Button
                  icon={<LogOut size={16} />}
                  size='small'
                  severity='danger'
                  text
                  className='border-round-xl hover:bg-red-50'
                  onClick={() => supabase.auth.signOut()}
                  tooltip='Cerrar Sesión'
                />
              </div>
            </div>

            {/* ESTADÍSTICAS */}
            <div className='flex gap-4 md:gap-5 text-center border-top-1 lg:border-top-none lg:border-left-1 border-200 pt-4 lg:pt-0 lg:pl-5 w-full lg:w-auto justify-content-center'>
              <div>
                <div className='text-2xl font-black text-900'>
                  {myVehicles.length}
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

          {/* --- SECCIÓN EN CASCADA 1: GARAJE --- */}
          <section className='profile-section'>
            <h2 className='profile-section-title'>
              <Car className='text-purple-600' size={28} /> Mi Garaje
            </h2>
            <div className='grid m-0'>
              {myVehicles.map((v) => {
                const totalImages =
                  (v.image_url ? 1 : 0) +
                  (v.vehicle_images ? v.vehicle_images.length : 0)

                return (
                  <div key={v.id} className='col-12 sm:col-6 lg:col-3 p-2'>
                    <div
                      className='vehicle-card cursor-pointer'
                      onClick={() => openGalleryViewer(v)}
                    >
                      <div className='vehicle-img-wrapper'>
                        {v.image_url ? (
                          <img
                            src={v.image_url}
                            alt={`${v.marca} ${v.modelo}`}
                          />
                        ) : (
                          <div className='flex h-full align-items-center justify-content-center text-300'>
                            <ImageIcon size={40} />
                          </div>
                        )}

                        {/* INDICADOR DE FOTOS */}
                        {totalImages > 1 && (
                          <div className='gallery-indicator-badge'>
                            <i className='pi pi-images'></i> 1/{totalImages}
                          </div>
                        )}
                      </div>
                      <div className='p-3 text-center'>
                        <div className='font-black text-lg text-900 mb-1 line-clamp-1'>
                          {v.marca}
                        </div>
                        <div className='text-sm text-600 line-clamp-1 font-medium'>
                          {v.modelo}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className='col-12 sm:col-6 lg:col-3 p-2'>
                <div
                  className='add-vehicle-card'
                  onClick={() => navigate('/garaje')}
                >
                  <PlusCircle size={36} className='mb-2' />
                  <span className='font-bold text-lg'>Añadir Vehículo</span>
                </div>
              </div>
            </div>
          </section>

          {/* --- SECCIÓN EN CASCADA 2: EVENTOS CREADOS --- */}
          <section className='profile-section'>
            <h2 className='profile-section-title'>
              <Flag className='text-blue-600' size={28} /> Eventos Organizados
            </h2>
            {createdEvents.length === 0 ? (
              <div className='empty-state-box'>
                <Flag size={48} className='text-300 mb-3 mx-auto' />
                <span className='block font-bold text-lg'>
                  No has organizado ningún evento.
                </span>
              </div>
            ) : (
              <div className='grid m-0'>
                {createdEvents.map(renderEventCard)}
              </div>
            )}
          </section>

          {/* --- SECCIÓN EN CASCADA 3: ASISTENCIAS --- */}
          <section className='profile-section'>
            <h2 className='profile-section-title'>
              <CheckCircle className='text-emerald-600' size={28} /> Me Apunto
            </h2>
            {attendingEvents.length === 0 ? (
              <div className='empty-state-box'>
                <CheckCircle size={48} className='text-300 mb-3 mx-auto' />
                <span className='block font-bold text-lg'>
                  No te has apuntado a nada aún.
                </span>
              </div>
            ) : (
              <div className='grid m-0'>
                {attendingEvents.map(renderEventCard)}
              </div>
            )}
          </section>

          {/* --- SECCIÓN EN CASCADA 4: FAVORITOS --- */}
          <section className='profile-section mb-0'>
            <h2 className='profile-section-title'>
              <Heart className='text-pink-500' size={28} /> Eventos Favoritos
            </h2>
            {favorites.length === 0 ? (
              <div className='empty-state-box'>
                <Heart size={48} className='text-300 mb-3 mx-auto' />
                <span className='block font-bold text-lg'>
                  No tienes eventos en favoritos.
                </span>
              </div>
            ) : (
              <div className='grid m-0'>{favorites.map(renderEventCard)}</div>
            )}
          </section>

          {/* MODAL EDITAR PERFIL */}
          <Dialog
            header={<span className='text-xl font-black'>Editar Perfil</span>}
            visible={showEditDialog}
            style={{ width: '90vw', maxWidth: '400px' }}
            onHide={() => setShowEditDialog(false)}
            className='border-round-2xl shadow-8'
          >
            <div className='flex flex-column gap-4 pt-3'>
              <div className='flex flex-column align-items-center gap-3'>
                <Avatar
                  image={
                    avatarFile
                      ? URL.createObjectURL(avatarFile)
                      : editForm.avatar_url
                  }
                  icon={
                    !editForm.avatar_url && !avatarFile ? 'pi pi-user' : null
                  }
                  size='xlarge'
                  shape='circle'
                  className='w-8rem h-8rem text-5xl bg-gray-100 border-2 border-gray-200'
                />
                <div className='relative'>
                  <input
                    type='file'
                    id='avatar-upload'
                    accept='image/*'
                    className='hidden'
                    onChange={(e) => setAvatarFile(e.target.files[0])}
                  />
                  <label
                    htmlFor='avatar-upload'
                    className='p-button p-component p-button-outlined p-button-secondary p-button-sm cursor-pointer border-round-xl font-bold'
                  >
                    <i className='pi pi-camera mr-2'></i> Cambiar Foto
                  </label>
                </div>
              </div>

              <div className='flex flex-column gap-3 mt-3'>
                <span className='p-float-label'>
                  <InputText
                    id='username'
                    value={editForm.username}
                    onChange={(e) =>
                      setEditForm({ ...editForm, username: e.target.value })
                    }
                    className='w-full border-round-xl p-3'
                  />
                  <label htmlFor='username'>Nombre de Usuario</label>
                </span>

                <span className='p-float-label'>
                  <InputTextarea
                    id='bio'
                    value={editForm.bio}
                    onChange={(e) =>
                      setEditForm({ ...editForm, bio: e.target.value })
                    }
                    className='w-full border-round-xl p-3'
                    rows={3}
                    autoResize
                  />
                  <label htmlFor='bio'>Biografía (Opcional)</label>
                </span>
              </div>

              <Button
                label='Guardar Cambios'
                onClick={handleSaveProfile}
                loading={loading}
                className='w-full border-round-xl py-3 font-bold mt-2'
                style={{ backgroundColor: '#2563eb' }}
              />
            </div>
          </Dialog>
        </div>
      </PageTransition>
    </>
  )
}

export default ProfilePage
