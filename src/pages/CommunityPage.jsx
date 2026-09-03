import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Avatar } from 'primereact/avatar'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Toast } from 'primereact/toast'
import imageCompression from 'browser-image-compression'
import {
  Users,
  UserCheck,
  Shield,
  Car,
  Search,
  Plus,
  Heart,
  Image as ImagenIcono,
  ArrowRight,
} from 'lucide-react'

import { supabase } from '../supabaseClient'
import { sendPushNotification } from '../utils/onesignal'
import { useBloqueo } from '../hooks/useModeracion'
import PageTransition from '../components/PageTransition'
import SEO from '../components/SEO'
import './CommunityPage.css'

/*
 * Comunidad.
 *
 * Cuatro pestañas: pilotos, a quién sigues, crews y el ranking de coches.
 * Cada una con su contador, para saber si hay algo dentro antes de entrar.
 *
 * El buscador filtra la pestaña en la que estés y se queda pegado arriba
 * al bajar, que es donde hace falta cuando la lista es larga.
 *
 * Se filtra lo publicado por gente bloqueada, que antes no se hacía aquí.
 */

const PESTANAS = [
  { id: 'pilotos', etiqueta: 'Pilotos', icono: Users },
  { id: 'siguiendo', etiqueta: 'Siguiendo', icono: UserCheck },
  { id: 'crews', etiqueta: 'Crews', icono: Shield },
  { id: 'coches', etiqueta: 'Coches', icono: Car },
]

const sinTildes = (t = '') =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/* --- Piloto --- */

const TarjetaPiloto = ({ usuario, onAbrir }) => {
  const [avatarRoto, setAvatarRoto] = useState(false)
  const [portadaRota, setPortadaRota] = useState(false)

  const portada = usuario.vehicles?.find((v) => v.image_url)?.image_url
  const coches = usuario.vehicles?.length || 0

  return (
    <article
      className='cm-piloto'
      onClick={() => onAbrir(usuario)}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onAbrir(usuario)}
    >
      <div className='cm-piloto-portada'>
        {portada && !portadaRota ? (
          <img
            src={portada}
            alt=''
            loading='lazy'
            decoding='async'
            onError={() => setPortadaRota(true)}
          />
        ) : (
          <div className='cm-sinfoto'>
            <Car size={32} aria-hidden='true' />
          </div>
        )}
      </div>

      <div className='cm-piloto-cuerpo'>
        <Avatar
          image={!avatarRoto ? usuario.avatar_url : null}
          icon={avatarRoto || !usuario.avatar_url ? 'pi pi-user' : null}
          shape='circle'
          className='cm-piloto-avatar'
          onImageError={() => setAvatarRoto(true)}
        />

        <h3 className='cm-piloto-nombre'>{usuario.username || 'Piloto'}</h3>

        <span className='cm-piloto-coches datos'>
          {coches} {coches === 1 ? 'coche' : 'coches'}
        </span>

        <span className='cm-piloto-ir'>
          Ver ficha <ArrowRight size={14} aria-hidden='true' />
        </span>
      </div>
    </article>
  )
}

/* --- Crew --- */

const TarjetaCrew = ({ crew, onAbrir }) => {
  const miembros = crew.crew_members?.length || 0

  return (
    <article
      className='cm-crew'
      onClick={() => onAbrir(crew)}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onAbrir(crew)}
    >
      <div className='cm-crew-banner'>
        {crew.banner_image_url ? (
          <img src={crew.banner_image_url} alt='' loading='lazy' decoding='async' />
        ) : (
          <div className='cm-sinfoto'>
            <Shield size={30} aria-hidden='true' />
          </div>
        )}
      </div>

      <div className='cm-crew-cuerpo'>
        <Avatar
          image={crew.profile_image_url}
          icon={!crew.profile_image_url ? 'pi pi-shield' : null}
          shape='circle'
          className='cm-crew-escudo'
        />

        <div className='cm-crew-texto'>
          <h3 className='cm-crew-nombre'>{crew.name}</h3>
          <p className='cm-crew-desc'>
            {crew.description || 'Sin descripción todavía.'}
          </p>
        </div>

        <span className='cm-crew-miembros datos'>
          {miembros}
          <span>{miembros === 1 ? 'miembro' : 'miembros'}</span>
        </span>
      </div>
    </article>
  )
}

/* --- Coche del ranking --- */

const TarjetaCoche = ({ vehiculo, posicion, onAbrir, onRespeto }) => {
  const [roto, setRoto] = useState(false)
  const podio = posicion <= 3

  return (
    <article
      className={`cm-coche ${podio ? 'podio' : ''}`}
      onClick={() => onAbrir(vehiculo)}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onAbrir(vehiculo)}
    >
      <div className='cm-coche-foto'>
        {vehiculo.image_url && !roto ? (
          <img
            src={vehiculo.image_url}
            alt={`${vehiculo.marca} ${vehiculo.modelo}`}
            loading='lazy'
            decoding='async'
            onError={() => setRoto(true)}
          />
        ) : (
          <div className='cm-sinfoto'>
            <Car size={32} aria-hidden='true' />
          </div>
        )}

        {/* La posición solo se marca cuando significa algo */}
        {podio && (
          <span className='cm-posicion datos'>
            {String(posicion).padStart(2, '0')}
          </span>
        )}

        <button
          type='button'
          className={`cm-respeto ${vehiculo.isLikedByMe ? 'dado' : ''}`}
          onClick={(e) =>
            onRespeto(e, vehiculo.id, vehiculo.isLikedByMe, vehiculo.user_id)
          }
          aria-pressed={vehiculo.isLikedByMe}
          aria-label={vehiculo.isLikedByMe ? 'Quitar respeto' : 'Dar respeto'}
        >
          <Heart size={15} fill={vehiculo.isLikedByMe ? 'currentColor' : 'none'} />
          <span className='datos'>{vehiculo.likesCount}</span>
        </button>
      </div>

      <div className='cm-coche-cuerpo'>
        <h3 className='cm-coche-titulo'>
          {vehiculo.marca} {vehiculo.modelo}
        </h3>
        <span className='cm-coche-autor datos'>
          {vehiculo.profiles?.username || 'Piloto'}
        </span>
      </div>
    </article>
  )
}

/* --- Página --- */

const CommunityPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useRef(null)

  const [session, setSession] = useState(null)
  const [pestana, setPestana] = useState(location.state?.tab || 'pilotos')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)

  const [pilotos, setPilotos] = useState([])
  const [siguiendo, setSiguiendo] = useState([])
  const [crews, setCrews] = useState([])
  const [coches, setCoches] = useState([])

  const [dialogoCrew, setDialogoCrew] = useState(false)
  const [creandoCrew, setCreandoCrew] = useState(false)
  const [nuevaCrew, setNuevaCrew] = useState({ name: '', description: '' })
  const [escudoCrew, setEscudoCrew] = useState(null)
  const [bannerCrew, setBannerCrew] = useState(null)

  const { filtrar } = useBloqueo(session)

  /* --- Datos --- */

  const cargar = useCallback(async (sesion) => {
    setCargando(true)

    const { data: perfiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, vehicles(image_url)')

    if (perfiles) {
      setPilotos(
        sesion ? perfiles.filter((p) => p.id !== sesion.user.id) : perfiles,
      )

      if (sesion) {
        const { data: sigue } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', sesion.user.id)
        const ids = new Set((sigue || []).map((f) => f.following_id))
        setSiguiendo(perfiles.filter((p) => ids.has(p.id)))
      }
    }

    const { data: crewsData } = await supabase
      .from('crews')
      .select('*, crew_members(id)')
    if (crewsData) setCrews(crewsData)

    const { data: vehiculos } = await supabase
      .from('vehicles')
      .select('*, profiles(username, avatar_url), vehicle_likes(user_id)')

    if (vehiculos) {
      setCoches(
        vehiculos
          .map((v) => {
            const likes = v.vehicle_likes || []
            return {
              ...v,
              likesCount: likes.length,
              isLikedByMe: sesion
                ? likes.some((l) => l.user_id === sesion.user.id)
                : false,
            }
          })
          .sort((a, b) => b.likesCount - a.likesCount),
      )
    }

    setCargando(false)
  }, [])

  useEffect(() => {
    let activo = true
    supabase.auth.getSession().then(({ data }) => {
      if (!activo) return
      setSession(data.session)
      cargar(data.session)
    })
    return () => {
      activo = false
    }
  }, [cargar])

  /* --- Respetos --- */

  const darRespeto = async (e, vehicleId, yaDado, duenoId) => {
    e.stopPropagation()

    if (!session?.user?.id) {
      toast.current?.show({
        severity: 'info',
        summary: 'Necesitas una cuenta',
        detail: 'Entra para dar respetos a los coches.',
      })
      navigate('/login', { state: { returnUrl: '/comunidad' } })
      return
    }

    setCoches((prev) =>
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

      if (duenoId && duenoId !== session.user.id) {
        await supabase.from('notifications').insert({
          user_id: duenoId,
          actor_id: session.user.id,
          tipo: 'nuevo_like_vehiculo',
        })
        const miNombre =
          session.user.user_metadata?.username || 'Alguien de la comunidad'
        await sendPushNotification(
          [duenoId],
          'Nuevos respetos',
          `A ${miNombre} le gusta tu coche.`,
          '/perfil',
        )
      }
    } catch (err) {
      console.error('Error al dar respeto:', err)
      setCoches((prev) =>
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
    }
  }

  /* --- Crear crew --- */

  const subirImagenCrew = async (file, prefijo) => {
    const comprimido = await imageCompression(file, {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: 'image/webp',
    })
    const ruta = `${session.user.id}/${prefijo}-${Date.now()}.webp`
    const { error } = await supabase.storage.from('crews').upload(ruta, comprimido)
    if (error) throw error
    return supabase.storage.from('crews').getPublicUrl(ruta).data.publicUrl
  }

  const crearCrew = async () => {
    if (!nuevaCrew.name.trim()) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Falta el nombre',
        detail: 'La crew necesita un nombre para existir.',
      })
      return
    }

    setCreandoCrew(true)
    try {
      const escudo = escudoCrew ? await subirImagenCrew(escudoCrew, 'profile') : null
      const banner = bannerCrew ? await subirImagenCrew(bannerCrew, 'banner') : null

      const { data: creada, error } = await supabase
        .from('crews')
        .insert({
          name: nuevaCrew.name.trim(),
          description: nuevaCrew.description.trim(),
          profile_image_url: escudo,
          banner_image_url: banner,
          created_by: session.user.id,
        })
        .select()
        .single()

      if (error) throw error

      await supabase.from('crew_members').insert({
        crew_id: creada.id,
        user_id: session.user.id,
        role: 'admin',
        status: 'approved',
      })

      toast.current?.show({
        severity: 'success',
        summary: 'Crew creada',
        detail: 'Ya es oficial. Invita a quien quieras.',
      })

      setDialogoCrew(false)
      setNuevaCrew({ name: '', description: '' })
      setEscudoCrew(null)
      setBannerCrew(null)
      cargar(session)
    } catch (err) {
      console.error('Error creando crew:', err)
      toast.current?.show({
        severity: 'error',
        summary: 'No se ha podido crear',
        detail: 'Puede que ese nombre ya esté cogido.',
      })
    } finally {
      setCreandoCrew(false)
    }
  }

  /* --- Filtrado --- */

  const listas = useMemo(() => {
    const q = sinTildes(busqueda.trim())

    const pilotosVis = filtrar(pilotos, (p) => p.id)
    const siguiendoVis = filtrar(siguiendo, (p) => p.id)
    const cochesVis = filtrar(coches, (v) => v.user_id)

    const filtraPersonas = (l) =>
      q ? l.filter((p) => sinTildes(p.username).includes(q)) : l

    return {
      pilotos: filtraPersonas(pilotosVis),
      siguiendo: filtraPersonas(siguiendoVis),
      crews: q
        ? crews.filter(
            (c) =>
              sinTildes(c.name).includes(q) || sinTildes(c.description).includes(q),
          )
        : crews,
      coches: q
        ? cochesVis.filter(
            (v) =>
              sinTildes(`${v.marca} ${v.modelo}`).includes(q) ||
              sinTildes(v.profiles?.username).includes(q),
          )
        : cochesVis,
    }
  }, [busqueda, pilotos, siguiendo, crews, coches, filtrar])

  const cantidades = {
    pilotos: listas.pilotos.length,
    siguiendo: listas.siguiendo.length,
    crews: listas.crews.length,
    coches: listas.coches.length,
  }

  const VACIOS = {
    pilotos: {
      titulo: busqueda ? 'Nadie con ese nombre' : 'Todavía no hay pilotos',
      texto: busqueda
        ? 'Prueba con otra búsqueda.'
        : 'En cuanto se registre gente, aparecerá aquí.',
    },
    siguiendo: {
      titulo: 'No sigues a nadie',
      texto: 'Cuando sigas a alguien, lo verás aquí de un vistazo.',
    },
    crews: {
      titulo: busqueda ? 'Ninguna crew con ese nombre' : 'Aún no hay crews',
      texto: busqueda
        ? 'Prueba con otra búsqueda.'
        : 'Monta la primera y reúne a los tuyos.',
    },
    coches: {
      titulo: busqueda ? 'Ningún coche con esa búsqueda' : 'El garaje colectivo está vacío',
      texto: busqueda
        ? 'Prueba con otra marca o modelo.'
        : 'Cuando alguien suba su coche, entrará en el ranking.',
    },
  }

  const abrirPerfil = (u) => navigate(`/usuario/${u.username || u.id}`)
  const abrirCrew = (c) => navigate(`/crew/${c.name}`)
  const abrirCoche = (v) =>
    navigate(`/usuario/${v.profiles?.username || v.user_id}`)

  return (
    <>
      <SEO
        title='Comunidad'
        description='Pilotos, crews y los coches con más respetos de CarMeet.'
      />

      <PageTransition>
        <div className='cm'>
          <Toast ref={toast} />

          <header className='cm-cabecera'>
            <div className='cm-cabecera-caja'>
              <div>
                <span className='rotulo'>La parrilla</span>
                <h1 className='cm-titulo'>Comunidad</h1>
              </div>

              {session && (
                <button
                  type='button'
                  className='btn-librea'
                  onClick={() => setDialogoCrew(true)}
                >
                  <Plus size={18} />
                  Crear crew
                </button>
              )}
            </div>
          </header>

          {/* Pestañas y buscador, pegados arriba al bajar */}
          <div className='cm-barra'>
            <nav className='cm-pestanas' aria-label='Secciones de la comunidad'>
              {PESTANAS.map(({ id, etiqueta, icono: Icono }) => (
                <button
                  key={id}
                  type='button'
                  className={`cm-pestana ${pestana === id ? 'activa' : ''}`}
                  onClick={() => setPestana(id)}
                  aria-current={pestana === id}
                >
                  <Icono size={16} aria-hidden='true' />
                  <span className='cm-pestana-texto'>{etiqueta}</span>
                  <span className='cm-pestana-num datos'>{cantidades[id]}</span>
                </button>
              ))}
            </nav>

            <div className='cm-buscador'>
              <label className='sr-solo' htmlFor='cm-buscar'>
                Buscar en la comunidad
              </label>
              <Search size={17} className='cm-lupa' aria-hidden='true' />
              <input
                id='cm-buscar'
                type='search'
                className='cm-campo'
                placeholder='Buscar piloto, crew o coche…'
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>

          <div className='cm-contenido'>
            {cargando && (
              <div className='cm-rejilla' aria-hidden='true'>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div className='cm-hueco' key={i} />
                ))}
              </div>
            )}

            {!cargando && pestana === 'pilotos' && cantidades.pilotos > 0 && (
              <div className='cm-rejilla'>
                {listas.pilotos.map((u) => (
                  <TarjetaPiloto key={u.id} usuario={u} onAbrir={abrirPerfil} />
                ))}
              </div>
            )}

            {!cargando && pestana === 'siguiendo' && cantidades.siguiendo > 0 && (
              <div className='cm-rejilla'>
                {listas.siguiendo.map((u) => (
                  <TarjetaPiloto key={u.id} usuario={u} onAbrir={abrirPerfil} />
                ))}
              </div>
            )}

            {!cargando && pestana === 'crews' && cantidades.crews > 0 && (
              <div className='cm-crews'>
                {listas.crews.map((c) => (
                  <TarjetaCrew key={c.id} crew={c} onAbrir={abrirCrew} />
                ))}
              </div>
            )}

            {!cargando && pestana === 'coches' && cantidades.coches > 0 && (
              <div className='cm-rejilla'>
                {listas.coches.map((v, i) => (
                  <TarjetaCoche
                    key={v.id}
                    vehiculo={v}
                    posicion={i + 1}
                    onAbrir={abrirCoche}
                    onRespeto={darRespeto}
                  />
                ))}
              </div>
            )}

            {!cargando && cantidades[pestana] === 0 && (
              <div className='cm-vacio'>
                <Users size={30} aria-hidden='true' />
                <h2>{VACIOS[pestana].titulo}</h2>
                <p>{VACIOS[pestana].texto}</p>
                {pestana === 'crews' && session && !busqueda && (
                  <button
                    type='button'
                    className='btn-librea'
                    onClick={() => setDialogoCrew(true)}
                  >
                    <Plus size={18} />
                    Crear la primera
                  </button>
                )}
              </div>
            )}
          </div>

          {/* --- Crear crew --- */}
          <Dialog
            visible={dialogoCrew}
            onHide={() => setDialogoCrew(false)}
            header='Crear una crew'
            dismissableMask
            draggable={false}
            style={{ width: 'min(30rem, 94vw)' }}
          >
            <div className='cm-form'>
              <p className='cm-form-intro'>
                Una crew es tu club: podéis organizar eventos privados que solo
                vean sus miembros.
              </p>

              <div className='cm-campo-form'>
                <label className='rotulo' htmlFor='cm-nombre'>
                  Nombre
                </label>
                <InputText
                  id='cm-nombre'
                  value={nuevaCrew.name}
                  onChange={(e) =>
                    setNuevaCrew({ ...nuevaCrew, name: e.target.value })
                  }
                  className='w-full'
                  placeholder='Los Clásicos de Cáceres'
                />
              </div>

              <div className='cm-campo-form'>
                <label className='rotulo' htmlFor='cm-desc'>
                  Descripción
                </label>
                <InputTextarea
                  id='cm-desc'
                  rows={3}
                  value={nuevaCrew.description}
                  onChange={(e) =>
                    setNuevaCrew({ ...nuevaCrew, description: e.target.value })
                  }
                  className='w-full'
                  placeholder='De qué va vuestra crew y a quién buscáis'
                />
              </div>

              <div className='cm-imagenes'>
                {[
                  { valor: escudoCrew, set: setEscudoCrew, texto: 'Escudo' },
                  { valor: bannerCrew, set: setBannerCrew, texto: 'Portada' },
                ].map(({ valor, set, texto }) => (
                  <label className='cm-carga' key={texto}>
                    <ImagenIcono size={18} aria-hidden='true' />
                    <span className='cm-carga-texto'>
                      {valor ? valor.name.slice(0, 18) : texto}
                    </span>
                    <input
                      type='file'
                      accept='image/*'
                      className='sr-solo'
                      onChange={(e) => set(e.target.files?.[0] || null)}
                    />
                  </label>
                ))}
              </div>

              <button
                type='button'
                className='btn-librea cm-crear'
                onClick={crearCrew}
                disabled={creandoCrew}
              >
                {creandoCrew ? 'Creando…' : 'Crear crew'}
              </button>
            </div>
          </Dialog>
        </div>
      </PageTransition>
    </>
  )
}

export default CommunityPage
