import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Avatar } from 'primereact/avatar'
import { Toast } from 'primereact/toast'
import {
  Share2,
  Car,
  Flag,
  Heart,
  CalendarDays,
  MapPin,
  Images,
  Shield,
  Instagram,
  Youtube,
  Twitter,
  Music2,
  UserPlus,
  UserCheck,
  Ban,
} from 'lucide-react'

import { supabase } from '../supabaseClient'
import { sendPushNotification } from '../utils/onesignal'
import { useBloqueo } from '../hooks/useModeracion'
import PageTransition from '../components/PageTransition'
import LightboxFotos from '../components/LightboxFotos'
import BotonDenunciar from '../components/BotonDenunciar'
import SEO from '../components/SEO'
import './ProfilePage.css'

/*
 * Perfil público de otro piloto.
 *
 * Comparte diseño y hoja de estilos con la ficha propia (ProfilePage):
 * son la misma pantalla vista desde fuera, y no tiene sentido que se vean
 * distintas. Esta es además la que se comparte por WhatsApp, así que es la
 * que más gente ve.
 *
 * Lo que cambia respecto a la propia: no hay editar ni cerrar sesión, hay
 * seguir, se pueden dar respetos a los coches, y se puede denunciar o
 * bloquear al usuario.
 */

const PESTANAS = [
  { id: 'garaje', etiqueta: 'Garaje', icono: Car },
  { id: 'eventos', etiqueta: 'Eventos', icono: Flag },
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

/* --- Coche con respetos --- */

const TarjetaCoche = ({ vehiculo, onAbrir, onRespeto }) => {
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

        <button
          type='button'
          className={`pf-respeto ${vehiculo.isLikedByMe ? 'dado' : ''}`}
          onClick={(e) => onRespeto(e, vehiculo.id, vehiculo.isLikedByMe)}
          aria-pressed={vehiculo.isLikedByMe}
          aria-label={
            vehiculo.isLikedByMe ? 'Quitar respeto' : 'Dar respeto a este coche'
          }
        >
          <Heart size={15} fill={vehiculo.isLikedByMe ? 'currentColor' : 'none'} />
          <span className='datos'>{vehiculo.likesCount}</span>
        </button>
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

/* --- Evento --- */

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

  const [pestana, setPestana] = useState('garaje')
  const [galleryImages, setGalleryImages] = useState(null)
  const [galleryTitulo, setGalleryTitulo] = useState('')

  const { bloqueados, bloquear, desbloquear } = useBloqueo(session)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  /* --- Datos --- */

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const esUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          identifier,
        )

      const { data: prof, error } = await supabase
        .from('profiles')
        .select('*')
        .eq(esUuid ? 'id' : 'username', identifier)
        .maybeSingle()

      if (error || !prof) throw new Error('Usuario no encontrado')
      setProfile(prof)
      const uid = prof.id

      const { data: crewData } = await supabase
        .from('crew_members')
        .select('crews(*)')
        .eq('user_id', uid)
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle()
      if (crewData?.crews) setUserCrew(crewData.crews)

      const { data: vehData } = await supabase
        .from('vehicles')
        .select('*, vehicle_images(*), vehicle_likes(user_id)')
        .eq('user_id', uid)

      if (vehData) {
        setVehicles(
          vehData.map((v) => {
            const likes = v.vehicle_likes || []
            return {
              ...v,
              likesCount: likes.length,
              isLikedByMe: session
                ? likes.some((l) => l.user_id === session.user.id)
                : false,
            }
          }),
        )
      }

      const { data: evData } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', uid)
        .order('fecha', { ascending: false })
      if (evData) setCreatedEvents(evData)

      const [seguidores, siguiendo] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', uid),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', uid),
      ])
      setFollowersCount(seguidores.count || 0)
      setFollowingCount(siguiendo.count || 0)

      if (session?.user?.id) {
        const { data: sigo } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', session.user.id)
          .eq('following_id', uid)
          .maybeSingle()
        setIsFollowing(!!sigo)
      }
    } catch (err) {
      console.error('Error cargando perfil:', err)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [identifier, session])

  useEffect(() => {
    cargar()
  }, [cargar])

  /* --- Acciones --- */

  const abrirGaleria = (car) => {
    const fotos = []
    if (car.image_url) fotos.push(car.image_url)
    car.vehicle_images?.forEach((img) => fotos.push(img.image_url))
    if (fotos.length === 0) return
    setGalleryTitulo(`${car.marca} ${car.modelo}`)
    setGalleryImages(fotos)
  }

  const darRespeto = async (e, vehicleId, yaDado) => {
    e.stopPropagation()

    if (!session?.user?.id) {
      toast.current?.show({
        severity: 'info',
        summary: 'Necesitas una cuenta',
        detail: 'Entra para dar respetos a los coches.',
      })
      navigate('/login', { state: { returnUrl: `/usuario/${identifier}` } })
      return
    }

    // Optimista: el corazón responde al momento
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId
          ? {
              ...v,
              isLikedByMe: !yaDado,
              likesCount: yaDado ? v.likesCount - 1 : v.likesCount + 1,
            }
          : v,
      ),
    )

    try {
      if (yaDado) {
        await supabase
          .from('vehicle_likes')
          .delete()
          .match({ user_id: session.user.id, vehicle_id: vehicleId })
        return
      }

      await supabase
        .from('vehicle_likes')
        .insert({ user_id: session.user.id, vehicle_id: vehicleId })

      if (profile.id === session.user.id) return

      await supabase.from('notifications').insert({
        user_id: profile.id,
        actor_id: session.user.id,
        tipo: 'nuevo_like_vehiculo',
      })

      const miNombre =
        session.user.user_metadata?.username || 'Alguien de la comunidad'
      await sendPushNotification(
        [profile.id],
        'Nuevos respetos',
        `A ${miNombre} le gusta tu garaje.`,
        `/usuario/${profile.username}`,
      )
    } catch (err) {
      console.error('Error al dar respeto:', err)
      // Se deshace lo optimista
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicleId
            ? {
                ...v,
                isLikedByMe: yaDado,
                likesCount: yaDado ? v.likesCount + 1 : v.likesCount - 1,
              }
            : v,
        ),
      )
      toast.current?.show({
        severity: 'error',
        summary: 'No se ha podido guardar',
        detail: 'Inténtalo otra vez en un momento.',
      })
    }
  }

  const alternarSeguir = async () => {
    if (!session?.user?.id) {
      toast.current?.show({
        severity: 'info',
        summary: 'Necesitas una cuenta',
        detail: 'Entra para seguir a otros pilotos.',
      })
      navigate('/login', { state: { returnUrl: `/usuario/${identifier}` } })
      return
    }

    setFollowLoading(true)
    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', session.user.id)
          .eq('following_id', profile.id)
        setIsFollowing(false)
        setFollowersCount((n) => n - 1)
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: session.user.id, following_id: profile.id })
        if (error) throw error

        setIsFollowing(true)
        setFollowersCount((n) => n + 1)

        await supabase.from('notifications').insert({
          user_id: profile.id,
          actor_id: session.user.id,
          tipo: 'nuevo_seguidor',
        })

        const miNombre =
          session.user.user_metadata?.username || 'Alguien de la comunidad'
        await sendPushNotification(
          [profile.id],
          'Nuevo seguidor',
          `${miNombre} ha empezado a seguirte.`,
          `/usuario/${profile.username}`,
        )
      }
    } catch (err) {
      console.error('Error en seguimiento:', err)
      toast.current?.show({
        severity: 'error',
        summary: 'No se ha podido completar',
        detail: 'Inténtalo otra vez.',
      })
    } finally {
      setFollowLoading(false)
    }
  }

  const compartir = async () => {
    const url = `${window.location.origin}/usuario/${profile.username}`
    if (navigator.share) {
      navigator.share({ title: `Garaje de ${profile.username}`, url }).catch(() => {})
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.current?.show({
        severity: 'success',
        summary: 'Enlace copiado',
        detail: 'Ya lo puedes pegar donde quieras.',
        life: 2500,
      })
    } catch {
      toast.current?.show({ severity: 'warn', summary: 'No se ha podido copiar', detail: url })
    }
  }

  /* --- Estados de carga y error --- */

  if (loading) {
    return (
      <div className='pf'>
        <div className='pf-contenido'>
          <div className='pf-rejilla' aria-hidden='true'>
            {Array.from({ length: 3 }).map((_, i) => (
              <div className='pf-hueco' key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <PageTransition>
        <div className='pf'>
          <div className='pf-contenido'>
            <div className='pf-vacio'>
              <Car size={30} aria-hidden='true' />
              <h2>Ese piloto no existe</h2>
              <p>
                El perfil que buscas no está en CarMeet. Puede que haya
                cambiado de nombre o que el enlace esté mal.
              </p>
              <button
                type='button'
                className='btn-librea'
                onClick={() => navigate('/comunidad')}
              >
                Ver la comunidad
              </button>
            </div>
          </div>
        </div>
      </PageTransition>
    )
  }

  const esMiPerfil = session?.user?.id === profile.id
  const estaBloqueado = bloqueados.has(profile.id)
  const portada = vehicles.find((v) => v.image_url)?.image_url
  const cantidades = { garaje: vehicles.length, eventos: createdEvents.length }

  return (
    <>
      <SEO
        title={`Perfil de ${profile.username}`}
        description={
          profile.bio ||
          `Mira el garaje de ${profile.username} y los eventos que organiza en CarMeet.`
        }
        image={profile.avatar_url || undefined}
        type='profile'
      />

      <PageTransition>
        <div className='pf'>
          <Toast ref={toast} />

          <header className='pf-banda'>
            <div className='pf-portada' aria-hidden='true'>
              {portada && <img src={portada} alt='' fetchPriority='high' />}
              <div className='pf-velo' />
            </div>

            <div className='pf-banda-caja'>
              <div className='pf-identidad'>
                <Avatar
                  image={profile.avatar_url}
                  icon={!profile.avatar_url ? 'pi pi-user' : null}
                  shape='circle'
                  className='pf-avatar'
                />

                <div className='pf-nombre-bloque'>
                  <span className='rotulo'>Piloto</span>
                  <h1 className='pf-nombre'>{profile.username}</h1>

                  {userCrew && (
                    <button
                      type='button'
                      className='pf-crew'
                      onClick={() => navigate(`/crew/${userCrew.name}`)}
                    >
                      <Shield size={13} aria-hidden='true' />
                      {userCrew.name}
                    </button>
                  )}
                </div>

                <div className='pf-acciones'>
                  {!esMiPerfil && (
                    <button
                      type='button'
                      className={`pf-accion ${isFollowing ? '' : 'principal'}`}
                      onClick={alternarSeguir}
                      disabled={followLoading}
                    >
                      {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
                      {isFollowing ? 'Siguiendo' : 'Seguir'}
                    </button>
                  )}

                  <button type='button' className='pf-accion' onClick={compartir}>
                    <Share2 size={16} />
                    Compartir
                  </button>

                  {!esMiPerfil && session && (
                    <>
                      {estaBloqueado ? (
                        <button
                          type='button'
                          className='pf-accion'
                          onClick={() => desbloquear(profile.id)}
                        >
                          <Ban size={16} />
                          Desbloquear
                        </button>
                      ) : (
                        <BotonDenunciar
                          tipo='perfil'
                          id={profile.id}
                          autorId={profile.id}
                          autor={profile.username}
                          session={session}
                          onBloqueado={() => bloquear(profile.id)}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>

              {profile.bio && <p className='pf-bio'>{profile.bio}</p>}

              {REDES.some((r) => profile[r.campo]) && (
                <div className='pf-redes'>
                  {REDES.map(({ campo, icono: Icono, url, nombre }) =>
                    profile[campo] ? (
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

              <div className='pf-cifras'>
                {[
                  { valor: vehicles.length, etiqueta: 'Coches' },
                  {
                    valor: vehicles.reduce((s, v) => s + v.likesCount, 0),
                    etiqueta: 'Respetos',
                  },
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

          <div className='pf-contenido'>
            {pestana === 'garaje' && vehicles.length > 0 && (
              <div className='pf-rejilla'>
                {vehicles.map((v) => (
                  <TarjetaCoche
                    key={v.id}
                    vehiculo={v}
                    onAbrir={abrirGaleria}
                    onRespeto={darRespeto}
                  />
                ))}
              </div>
            )}

            {pestana === 'eventos' && createdEvents.length > 0 && (
              <div className='pf-lista'>
                {createdEvents.map((e) => (
                  <TarjetaEvento
                    key={e.id}
                    evento={e}
                    onAbrir={(id) => navigate(`/evento/${id}`)}
                  />
                ))}
              </div>
            )}

            {cantidades[pestana] === 0 && (
              <div className='pf-vacio'>
                {pestana === 'garaje' ? (
                  <Car size={30} aria-hidden='true' />
                ) : (
                  <Flag size={30} aria-hidden='true' />
                )}
                <h2>
                  {pestana === 'garaje'
                    ? 'Todavía no ha subido ningún coche'
                    : 'Todavía no ha organizado nada'}
                </h2>
                <p>
                  {pestana === 'garaje'
                    ? `Cuando ${profile.username} suba su garaje, aparecerá aquí.`
                    : `Cuando ${profile.username} monte una quedada, aparecerá aquí.`}
                </p>
              </div>
            )}
          </div>

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

export default PublicProfile
