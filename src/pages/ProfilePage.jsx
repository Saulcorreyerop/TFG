import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from 'primereact/avatar'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Toast } from 'primereact/toast'
import imageCompression from 'browser-image-compression'
import {
  Share2,
  Car,
  Flag,
  CheckCircle,
  Heart,
  CalendarDays,
  MapPin,
  Plus,
  LogOut,
  Images,
  Shield,
  Instagram,
  Youtube,
  Twitter,
  Music2,
  Pencil,
  Camera,
} from 'lucide-react'

import { supabase } from '../supabaseClient'
import PageTransition from '../components/PageTransition'
import LightboxFotos from '../components/LightboxFotos'
import SEO from '../components/SEO'
import './ProfilePage.css'

/*
 * Ficha del piloto.
 *
 * Antes eran cuatro secciones apiladas (garaje, eventos organizados,
 * apuntado y guardados) que hacían la página larguísima: había que bajar
 * mucho para llegar a lo de abajo y no se veía de un vistazo qué tenías.
 *
 * Ahora es una ficha: una banda de cabecera con la mejor foto del garaje
 * de fondo, las cifras tratadas como telemetría, y las cuatro listas
 * repartidas en pestañas. El contador de cada pestaña te dice si vale la
 * pena entrar antes de pulsar.
 *
 * La lógica de datos no cambia; solo la presentación.
 */

const PESTANAS = [
  { id: 'garaje', etiqueta: 'Garaje', icono: Car },
  { id: 'organizados', etiqueta: 'Organizados', icono: Flag },
  { id: 'apuntado', etiqueta: 'Me apunto', icono: CheckCircle },
  { id: 'guardados', etiqueta: 'Guardados', icono: Heart },
]

const REDES = [
  { campo: 'instagram', icono: Instagram, url: (v) => `https://instagram.com/${v}`, nombre: 'Instagram' },
  { campo: 'twitter', icono: Twitter, url: (v) => `https://x.com/${v}`, nombre: 'X' },
  { campo: 'tiktok', icono: Music2, url: (v) => `https://tiktok.com/@${v}`, nombre: 'TikTok' },
  { campo: 'youtube', icono: Youtube, url: (v) => `https://youtube.com/@${v}`, nombre: 'YouTube' },
]

const fechaLarga = (f) =>
  new Date(f).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

/* --- Tarjeta de vehículo: la foto manda --- */

const TarjetaVehiculo = ({ vehiculo, onAbrir }) => {
  const [roto, setRoto] = useState(false)
  const fotos = 1 + (vehiculo.vehicle_images?.length || 0)

  return (
    <article
      className='pf-coche'
      onClick={() => onAbrir(vehiculo)}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onAbrir(vehiculo)}
    >
      <div className='pf-coche-foto'>
        {vehiculo.image_url && !roto ? (
          <img
            src={vehiculo.image_url}
            alt={`${vehiculo.marca} ${vehiculo.modelo}`}
            loading='lazy'
            decoding='async'
            onError={() => setRoto(true)}
          />
        ) : (
          <div className='pf-sinfoto'>
            <Car size={38} aria-hidden='true' />
          </div>
        )}

        {fotos > 1 && (
          <span className='pf-contador-fotos datos'>
            <Images size={12} aria-hidden='true' />
            {fotos}
          </span>
        )}
      </div>

      <div className='pf-coche-cuerpo'>
        <h3 className='pf-coche-titulo'>
          {vehiculo.marca} {vehiculo.modelo}
        </h3>

        <div className='pf-telemetria'>
          <div className='pf-dato'>
            <span className='pf-dato-valor datos'>{vehiculo.cv || '—'}</span>
            <span className='pf-dato-etiqueta'>CV</span>
          </div>
          <div className='pf-dato'>
            <span className='pf-dato-valor datos'>{vehiculo.anio || '—'}</span>
            <span className='pf-dato-etiqueta'>Año</span>
          </div>
          <div className='pf-dato'>
            <span className='pf-dato-valor datos'>
              {vehiculo.combustible ? vehiculo.combustible.slice(0, 3).toUpperCase() : '—'}
            </span>
            <span className='pf-dato-etiqueta'>Comb.</span>
          </div>
        </div>
      </div>
    </article>
  )
}

/* --- Tarjeta de evento: taco de fecha a la izquierda --- */

const TarjetaEvento = ({ evento, onAbrir }) => {
  const fecha = new Date(evento.fecha)
  const pasado = fecha < new Date()

  return (
    <article
      className={`pf-evento ${pasado ? 'pasado' : ''}`}
      onClick={() => onAbrir(evento.id)}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onAbrir(evento.id)}
    >
      <div className='pf-fecha'>
        <span className='pf-fecha-dia datos'>{fecha.getDate()}</span>
        <span className='pf-fecha-mes'>
          {fecha.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}
        </span>
      </div>

      <div className='pf-evento-cuerpo'>
        <div className='pf-evento-alto'>
          {evento.tipo && <span className='pf-tipo'>{evento.tipo}</span>}
          {pasado && <span className='pf-finalizado'>Finalizado</span>}
        </div>

        <h3 className='pf-evento-titulo'>{evento.titulo}</h3>

        <div className='pf-evento-meta datos'>
          <span>
            <CalendarDays size={12} aria-hidden='true' />
            {fechaLarga(evento.fecha)}
          </span>
          {evento.ubicacion && (
            <span>
              <MapPin size={12} aria-hidden='true' />
              {evento.ubicacion.split(',')[0].trim()}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

/* --- Página --- */

const ProfilePage = ({ session }) => {
  const navigate = useNavigate()
  const toast = useRef(null)

  const [profile, setProfile] = useState(null)
  const [myVehicles, setMyVehicles] = useState([])
  const [myCrew, setMyCrew] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [attendingEvents, setAttendingEvents] = useState([])
  const [createdEvents, setCreatedEvents] = useState([])
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)

  const [pestana, setPestana] = useState('garaje')
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [galleryImages, setGalleryImages] = useState(null)
  const [galleryTitulo, setGalleryTitulo] = useState('')

  const [editForm, setEditForm] = useState({
    username: '',
    avatar_url: '',
    bio: '',
    instagram: '',
    twitter: '',
    tiktok: '',
    youtube: '',
  })

  /* --- Datos --- */

  const fetchAllData = useCallback(async () => {
    if (!session?.user?.id) return
    const uid = session.user.id

    const { data: profData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single()

    setProfile(profData)
    if (profData) {
      setEditForm({
        username: profData.username || '',
        avatar_url: profData.avatar_url,
        bio: profData.bio || '',
        instagram: profData.instagram || '',
        twitter: profData.twitter || '',
        tiktok: profData.tiktok || '',
        youtube: profData.youtube || '',
      })
    }

    const { data: vehData } = await supabase
      .from('vehicles')
      .select('*, vehicle_images(*)')
      .eq('user_id', uid)
    if (vehData) setMyVehicles(vehData)

    const { data: crewMemberData } = await supabase
      .from('crew_members')
      .select('crews(*)')
      .eq('user_id', uid)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle()
    if (crewMemberData?.crews) setMyCrew(crewMemberData.crews)

    const { data: favData } = await supabase
      .from('favorites')
      .select('event_id, events (*)')
      .eq('user_id', uid)
    if (favData) setFavorites(favData.map((i) => i.events).filter(Boolean))

    const { data: attData } = await supabase
      .from('event_attendees')
      .select('event_id, events (*)')
      .eq('user_id', uid)
    if (attData) setAttendingEvents(attData.map((i) => i.events).filter(Boolean))

    const { data: creData } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', uid)
      .order('fecha', { ascending: false })
    if (creData) setCreatedEvents(creData)

    const [seguidores, siguiendo] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', uid),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', uid),
    ])
    setFollowersCount(seguidores.count || 0)
    setFollowingCount(siguiendo.count || 0)
  }, [session])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  /* --- Acciones --- */

  const abrirGaleria = (car) => {
    const fotos = []
    if (car.image_url) fotos.push(car.image_url)
    car.vehicle_images?.forEach((img) => fotos.push(img.image_url))

    if (fotos.length === 0) {
      navigate('/garaje')
      return
    }
    setGalleryTitulo(`${car.marca} ${car.modelo}`)
    setGalleryImages(fotos)
  }

  const subirAvatar = async (file) => {
    const comprimido = await imageCompression(file, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.8,
    })
    const ruta = `${session.user.id}-${Date.now()}.webp`
    const { error } = await supabase.storage
      .from('avatars')
      .upload(ruta, comprimido, { contentType: 'image/webp' })
    if (error) throw error
    return supabase.storage.from('avatars').getPublicUrl(ruta).data.publicUrl
  }

  const guardarPerfil = async () => {
    setLoading(true)
    try {
      let avatar = editForm.avatar_url
      if (avatarFile) avatar = await subirAvatar(avatarFile)

      const limpiar = (v) => (v ? v.replace('@', '').trim() || null : null)

      const { error } = await supabase
        .from('profiles')
        .update({
          username: editForm.username,
          avatar_url: avatar,
          bio: editForm.bio,
          instagram: limpiar(editForm.instagram),
          twitter: limpiar(editForm.twitter),
          tiktok: limpiar(editForm.tiktok),
          youtube: limpiar(editForm.youtube),
          updated_at: new Date(),
        })
        .eq('id', session.user.id)

      if (error) throw error

      toast.current?.show({
        severity: 'success',
        summary: 'Guardado',
        detail: 'Tu perfil está actualizado.',
      })
      setShowEditDialog(false)
      setAvatarFile(null)
      fetchAllData()
    } catch (err) {
      console.error('Error guardando perfil:', err)
      toast.current?.show({
        severity: 'error',
        summary: 'No se ha guardado',
        detail: 'Revisa los datos e inténtalo otra vez.',
      })
    } finally {
      setLoading(false)
    }
  }

  const compartir = async () => {
    const url = `${window.location.origin}/usuario/${profile?.username}`
    if (navigator.share) {
      navigator.share({ title: `Perfil de ${profile?.username}`, url }).catch(() => {})
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.current?.show({
        severity: 'success',
        summary: 'Enlace copiado',
        detail: 'Ya lo puedes pegar donde quieras.',
        life: 3000,
      })
    } catch {
      toast.current?.show({
        severity: 'warn',
        summary: 'No se ha podido copiar',
        detail: url,
      })
    }
  }

  if (!session) {
    return (
      <div className='pf-sin-sesion'>
        <h1>Inicia sesión para ver tu perfil</h1>
      </div>
    )
  }

  /* --- Contenido de las pestañas --- */

  const cantidades = {
    garaje: myVehicles.length,
    organizados: createdEvents.length,
    apuntado: attendingEvents.length,
    guardados: favorites.length,
  }

  const abrirEvento = (id) => navigate(`/evento/${id}`)

  const listaEventos = {
    organizados: createdEvents,
    apuntado: attendingEvents,
    guardados: favorites,
  }[pestana]

  const VACIOS = {
    garaje: {
      icono: Car,
      titulo: 'El garaje está vacío',
      texto: 'Sube tu coche y enséñaselo a la comunidad.',
      accion: 'Añadir vehículo',
      ir: '/garaje',
    },
    organizados: {
      icono: Flag,
      titulo: 'Aún no has montado nada',
      texto: 'Crea una quedada y verás quién se apunta.',
      accion: 'Crear evento',
      ir: '/eventos',
    },
    apuntado: {
      icono: CheckCircle,
      titulo: 'No estás apuntado a nada',
      texto: 'Mira la agenda y apúntate a lo que te encaje.',
      accion: 'Ver eventos',
      ir: '/eventos',
    },
    guardados: {
      icono: Heart,
      titulo: 'No has guardado ningún evento',
      texto: 'Guarda los que te interesen para no perderlos de vista.',
      accion: 'Explorar agenda',
      ir: '/eventos',
    },
  }

  const portada = myVehicles.find((v) => v.image_url)?.image_url

  return (
    <>
      <SEO
        title='Mi Perfil'
        description='Tu ficha en CarMeet: garaje, eventos organizados y quedadas a las que vas.'
        noindex
      />

      <PageTransition>
        <div className='pf'>
          <Toast ref={toast} />

          {/* --- Banda de cabecera --- */}
          <header className='pf-banda'>
            <div className='pf-portada' aria-hidden='true'>
              {portada && <img src={portada} alt='' fetchPriority='high' />}
              <div className='pf-velo' />
            </div>

            <div className='pf-banda-caja'>
              <div className='pf-identidad'>
                <Avatar
                  image={profile?.avatar_url}
                  icon={!profile?.avatar_url ? 'pi pi-user' : null}
                  shape='circle'
                  className='pf-avatar'
                />

                <div className='pf-nombre-bloque'>
                  <span className='rotulo'>Mi ficha</span>
                  <h1 className='pf-nombre'>{profile?.username || 'Piloto'}</h1>

                  {myCrew && (
                    <button
                      type='button'
                      className='pf-crew'
                      onClick={() => navigate(`/crew/${myCrew.name}`)}
                    >
                      <Shield size={13} aria-hidden='true' />
                      {myCrew.name}
                    </button>
                  )}
                </div>

                <div className='pf-acciones'>
                  <button
                    type='button'
                    className='pf-accion'
                    onClick={() => setShowEditDialog(true)}
                  >
                    <Pencil size={16} />
                    Editar
                  </button>
                  <button type='button' className='pf-accion' onClick={compartir}>
                    <Share2 size={16} />
                    Compartir
                  </button>
                  <button
                    type='button'
                    className='pf-accion salir'
                    onClick={() => supabase.auth.signOut()}
                    aria-label='Cerrar sesión'
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              </div>

              {profile?.bio && <p className='pf-bio'>{profile.bio}</p>}

              {REDES.some((r) => profile?.[r.campo]) && (
                <div className='pf-redes'>
                  {REDES.map(({ campo, icono: Icono, url, nombre }) =>
                    profile?.[campo] ? (
                      <a
                        key={campo}
                        href={url(profile[campo])}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='pf-red'
                        aria-label={nombre}
                        title={nombre}
                      >
                        <Icono size={17} />
                      </a>
                    ) : null,
                  )}
                </div>
              )}

              {/* Cifras como telemetría */}
              <div className='pf-cifras'>
                {[
                  { valor: myVehicles.length, etiqueta: 'Coches' },
                  { valor: createdEvents.length, etiqueta: 'Eventos' },
                  { valor: followersCount, etiqueta: 'Seguidores' },
                  { valor: followingCount, etiqueta: 'Siguiendo' },
                ].map((c) => (
                  <div className='pf-cifra' key={c.etiqueta}>
                    <span className='pf-cifra-valor datos'>{c.valor}</span>
                    <span className='pf-cifra-etiqueta'>{c.etiqueta}</span>
                  </div>
                ))}
              </div>
            </div>
          </header>

          {/* --- Pestañas --- */}
          <nav className='pf-pestanas' aria-label='Secciones del perfil'>
            {PESTANAS.map(({ id, etiqueta, icono: Icono }) => (
              <button
                key={id}
                type='button'
                className={`pf-pestana ${pestana === id ? 'activa' : ''}`}
                onClick={() => setPestana(id)}
                aria-current={pestana === id}
              >
                <Icono size={16} aria-hidden='true' />
                <span className='pf-pestana-texto'>{etiqueta}</span>
                <span className='pf-pestana-num datos'>{cantidades[id]}</span>
              </button>
            ))}
          </nav>

          {/* --- Contenido --- */}
          <div className='pf-contenido'>
            {pestana === 'garaje' && (
              myVehicles.length > 0 ? (
                <>
                  <div className='pf-rejilla'>
                    {myVehicles.map((v) => (
                      <TarjetaVehiculo key={v.id} vehiculo={v} onAbrir={abrirGaleria} />
                    ))}
                  </div>
                  <button
                    type='button'
                    className='pf-anadir'
                    onClick={() => navigate('/garaje')}
                  >
                    <Plus size={18} />
                    Añadir otro vehículo
                  </button>
                </>
              ) : null
            )}

            {pestana !== 'garaje' && listaEventos.length > 0 && (
              <div className='pf-lista'>
                {listaEventos.map((e) => (
                  <TarjetaEvento key={e.id} evento={e} onAbrir={abrirEvento} />
                ))}
              </div>
            )}

            {cantidades[pestana] === 0 && (
              <div className='pf-vacio'>
                {React.createElement(VACIOS[pestana].icono, {
                  size: 30,
                  'aria-hidden': 'true',
                })}
                <h2>{VACIOS[pestana].titulo}</h2>
                <p>{VACIOS[pestana].texto}</p>
                <button
                  type='button'
                  className='btn-librea'
                  onClick={() => navigate(VACIOS[pestana].ir)}
                >
                  {VACIOS[pestana].accion}
                </button>
              </div>
            )}
          </div>

          {/* --- Editar perfil --- */}
          <Dialog
            visible={showEditDialog}
            onHide={() => setShowEditDialog(false)}
            header='Editar perfil'
            dismissableMask
            draggable={false}
            style={{ width: 'min(30rem, 94vw)' }}
          >
            <div className='pf-form'>
              <label className='pf-avatar-carga'>
                <Avatar
                  image={
                    avatarFile ? URL.createObjectURL(avatarFile) : editForm.avatar_url
                  }
                  icon={
                    !avatarFile && !editForm.avatar_url ? 'pi pi-user' : null
                  }
                  shape='circle'
                  className='pf-avatar-previo'
                />
                <span className='pf-avatar-boton'>
                  <Camera size={15} />
                  Cambiar foto
                </span>
                <input
                  type='file'
                  accept='image/*'
                  className='sr-solo'
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                />
              </label>

              <div className='pf-campo'>
                <label className='rotulo' htmlFor='pf-username'>
                  Nombre de piloto
                </label>
                <InputText
                  id='pf-username'
                  value={editForm.username}
                  onChange={(e) =>
                    setEditForm({ ...editForm, username: e.target.value })
                  }
                  className='w-full'
                />
              </div>

              <div className='pf-campo'>
                <label className='rotulo' htmlFor='pf-bio'>
                  Biografía
                </label>
                <InputTextarea
                  id='pf-bio'
                  rows={3}
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className='w-full'
                  placeholder='Cuenta algo de ti y de tus coches'
                />
              </div>

              <div className='pf-redes-form'>
                {REDES.map(({ campo, icono: Icono, nombre }) => (
                  <div className='pf-campo' key={campo}>
                    <label className='rotulo' htmlFor={`pf-${campo}`}>
                      <Icono size={12} aria-hidden='true' /> {nombre}
                    </label>
                    <InputText
                      id={`pf-${campo}`}
                      value={editForm[campo]}
                      onChange={(e) =>
                        setEditForm({ ...editForm, [campo]: e.target.value })
                      }
                      className='w-full'
                      placeholder='tu_usuario'
                    />
                  </div>
                ))}
              </div>

              <button
                type='button'
                className='btn-librea pf-guardar'
                onClick={guardarPerfil}
                disabled={loading}
              >
                {loading ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </Dialog>

          {galleryImages && (
            <LightboxFotos
              fotos={galleryImages}
              titulo={galleryTitulo}
              subtitulo={`${galleryImages.length} fotos`}
              onCerrar={() => setGalleryImages(null)}
            />
          )}
        </div>
      </PageTransition>
    </>
  )
}

export default ProfilePage
