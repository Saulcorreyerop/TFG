import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Avatar } from 'primereact/avatar'
import { Toast } from 'primereact/toast'
import {
  Lock,
  Users,
  Shield,
  ArrowLeft,
  Check,
  X,
  UserPlus,
  Clock,
  Car,
  MessageSquare,
  LogOut,
  Images,
} from 'lucide-react'

import { supabase } from '../supabaseClient'
import { sendPushNotification } from '../utils/onesignal'
import PageTransition from '../components/PageTransition'
import SEO from '../components/SEO'
import CrewChat from '../components/CrewChat'
import './CrewDetailPage.css'

/*
 * Ficha de una crew.
 *
 * Misma estructura que la ficha de piloto: banda de cabecera con el
 * banner de fondo, cifras como telemetría y el contenido en pestañas con
 * contador. El canal es una pestaña más, con su altura fija: así deja de
 * quedarse pegado al pie de la página.
 *
 * Las peticiones pendientes, si eres admin, van ANTES de las pestañas:
 * es lo único de la página que pide una acción tuya.
 *
 * Arreglado de paso: las tarjetas de coches leían v.make / v.model /
 * v.fuel_type, pero las columnas se llaman marca / modelo / combustible,
 * así que salían vacías. Y el botón de aceptar solicitud tenía
 * "backgroundcolor" en minúscula y no pintaba fondo.
 *
 * Nuevo: un miembro puede salir de la crew (la política RLS "Usuarios
 * pueden salir" ya lo permitía; faltaba el botón). El fundador no puede
 * irse y dejar la crew sin admin.
 */

const PESTANAS = [
  { id: 'canal', etiqueta: 'Canal', icono: MessageSquare },
  { id: 'miembros', etiqueta: 'Miembros', icono: Users },
  { id: 'garaje', etiqueta: 'Garaje', icono: Car },
]

/* --- Coche de la crew --- */

const TarjetaCoche = ({ vehiculo, onAbrir }) => {
  const [roto, setRoto] = useState(false)
  const fotos = 1 + (vehiculo.vehicle_images?.length || 0)

  return (
    <article
      className='cr-coche'
      onClick={() => onAbrir(vehiculo.owner)}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onAbrir(vehiculo.owner)}
    >
      <div className='cr-coche-foto'>
        {vehiculo.image_url && !roto ? (
          <img
            src={vehiculo.image_url}
            alt={`${vehiculo.marca} ${vehiculo.modelo}`}
            loading='lazy'
            decoding='async'
            onError={() => setRoto(true)}
          />
        ) : (
          <div className='cr-sinfoto'>
            <Car size={34} aria-hidden='true' />
          </div>
        )}
        {fotos > 1 && (
          <span className='cr-contador-fotos datos'>
            <Images size={12} aria-hidden='true' />
            {fotos}
          </span>
        )}
      </div>
      <div className='cr-coche-cuerpo'>
        <h3 className='cr-coche-titulo'>
          {vehiculo.marca} {vehiculo.modelo}
        </h3>
        <div className='cr-coche-meta datos'>
          {vehiculo.cv && <span>{vehiculo.cv} CV</span>}
          {vehiculo.anio && <span>{vehiculo.anio}</span>}
          <span className='cr-coche-dueno'>{vehiculo.owner}</span>
        </div>
      </div>
    </article>
  )
}

/* --- Página --- */

const CrewDetailPage = ({ session }) => {
  const { crewName } = useParams()
  const navigate = useNavigate()
  const toast = useRef(null)

  const [crew, setCrew] = useState(null)
  const [members, setMembers] = useState([])
  const [crewVehicles, setCrewVehicles] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [userStatus, setUserStatus] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const [pestana, setPestana] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmandoSalida, setConfirmandoSalida] = useState(false)

  /* --- Datos --- */

  const fetchCrewData = useCallback(async () => {
    try {
      const { data: crewData, error: crewErr } = await supabase
        .from('crews')
        .select('*')
        .eq('name', decodeURIComponent(crewName))
        .single()

      if (crewErr || !crewData) throw new Error('Crew no encontrada')
      setCrew(crewData)

      const { data: membersData, error: memErr } = await supabase
        .from('crew_members')
        .select(
          'id, user_id, role, status, profiles(id, username, avatar_url, vehicles(id, marca, modelo, cv, anio, combustible, image_url, vehicle_images(id)))',
        )
        .eq('crew_id', crewData.id)

      if (memErr) throw memErr

      const aprobados = (membersData || []).filter((m) => m.status === 'approved')
      const pendientes = (membersData || []).filter((m) => m.status === 'pending')

      setMembers(aprobados)
      setPendingRequests(pendientes)
      setCrewVehicles(
        aprobados.flatMap((m) =>
          (m.profiles?.vehicles || []).map((v) => ({
            ...v,
            owner: m.profiles.username,
          })),
        ),
      )

      if (session?.user) {
        const yo = (membersData || []).find((m) => m.user_id === session.user.id)
        setUserStatus(yo ? yo.status : null)
        setIsAdmin(yo ? yo.role === 'admin' : false)
      } else {
        setUserStatus(null)
        setIsAdmin(false)
      }
    } catch (err) {
      console.error('Error cargando la crew:', err.message)
      setCrew(null)
    } finally {
      setLoading(false)
    }
  }, [crewName, session])

  useEffect(() => {
    if (crewName) fetchCrewData()
  }, [crewName, fetchCrewData])

  // Pestaña inicial: el canal si puedes entrar, los miembros si no
  useEffect(() => {
    if (loading || pestana) return
    setPestana(userStatus === 'approved' ? 'canal' : 'miembros')
  }, [loading, userStatus, pestana])

  /* --- Solicitar unirse --- */

  const solicitarUnirme = async () => {
    if (!session) {
      navigate('/login', { state: { returnUrl: `/crew/${encodeURIComponent(crewName)}` } })
      return
    }
    setOcupado(true)
    try {
      const { error } = await supabase.from('crew_members').insert({
        crew_id: crew.id,
        user_id: session.user.id,
        status: 'pending',
      })
      if (error) throw error

      await supabase.from('notifications').insert({
        user_id: crew.created_by,
        actor_id: session.user.id,
        tipo: 'solicitud_crew',
        crew_id: crew.id,
      })

      const miNombre = session.user.user_metadata?.username || 'Un piloto'
      await sendPushNotification(
        [crew.created_by],
        'Solicitud de crew',
        `${miNombre} quiere unirse a ${crew.name}.`,
        `/crew/${encodeURIComponent(crew.name)}`,
      )

      toast.current?.show({
        severity: 'success',
        summary: 'Solicitud enviada',
        detail: 'El administrador ya lo sabe. Te avisamos cuando te acepte.',
      })
      fetchCrewData()
    } catch (err) {
      console.error(err)
      toast.current?.show({
        severity: 'error',
        summary: 'No se ha podido enviar',
        detail: err.code === '23505' ? 'Ya habías solicitado unirte.' : 'Inténtalo otra vez.',
      })
    } finally {
      setOcupado(false)
    }
  }

  /* --- Aceptar / rechazar --- */

  const resolverSolicitud = async (solicitudId, accion, solicitanteId) => {
    setOcupado(true)
    try {
      if (accion === 'approve') {
        const { error } = await supabase
          .from('crew_members')
          .update({ status: 'approved' })
          .eq('id', solicitudId)
        if (error) throw error

        await supabase.from('notifications').insert({
          user_id: solicitanteId,
          actor_id: session.user.id,
          tipo: 'crew_aceptada',
          crew_id: crew.id,
        })
        await sendPushNotification(
          [solicitanteId],
          'Solicitud aceptada',
          `Ya eres miembro de ${crew.name}.`,
          `/crew/${encodeURIComponent(crew.name)}`,
        )
        toast.current?.show({
          severity: 'success',
          summary: 'Aceptado',
          detail: 'Ya es miembro y lo hemos avisado.',
        })
      } else {
        const { error } = await supabase.from('crew_members').delete().eq('id', solicitudId)
        if (error) throw error
        toast.current?.show({ severity: 'info', summary: 'Solicitud rechazada' })
      }
      fetchCrewData()
    } catch (err) {
      console.error(err)
      toast.current?.show({
        severity: 'error',
        summary: 'No se ha podido completar',
        detail: 'Inténtalo otra vez.',
      })
    } finally {
      setOcupado(false)
    }
  }

  /* --- Salir de la crew --- */

  const salir = async () => {
    setOcupado(true)
    try {
      const { error } = await supabase
        .from('crew_members')
        .delete()
        .eq('crew_id', crew.id)
        .eq('user_id', session.user.id)
      if (error) throw error

      toast.current?.show({
        severity: 'info',
        summary: 'Has salido de la crew',
        detail: 'Puedes volver a solicitar entrar cuando quieras.',
      })
      setConfirmandoSalida(false)
      setPestana('miembros')
      fetchCrewData()
    } catch (err) {
      console.error(err)
      toast.current?.show({
        severity: 'error',
        summary: 'No se ha podido salir',
        detail: 'Inténtalo otra vez.',
      })
    } finally {
      setOcupado(false)
    }
  }

  /* --- Estados --- */

  if (loading) {
    return (
      <div className='cr'>
        <div className='cr-contenido'>
          <div className='cr-rejilla' aria-hidden='true'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div className='cr-hueco' key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!crew) {
    return (
      <PageTransition>
        <div className='cr'>
          <div className='cr-contenido'>
            <div className='cr-vacio'>
              <Shield size={30} aria-hidden='true' />
              <h2>Esa crew no existe</h2>
              <p>Puede que haya cambiado de nombre o que el enlace esté mal.</p>
              <button type='button' className='btn-librea' onClick={() => navigate('/comunidad')}>
                Ver todas las crews
              </button>
            </div>
          </div>
        </div>
      </PageTransition>
    )
  }

  const esMiembro = userStatus === 'approved'
  const esFundador = session?.user?.id === crew.created_by
  const cantidades = {
    canal: null,
    miembros: members.length,
    garaje: crewVehicles.length,
  }

  return (
    <>
      <SEO
        title={`Crew: ${crew.name}`}
        description={
          crew.description ||
          `Únete a ${crew.name} en CarMeet. Mira los coches de sus miembros y rueda con ellos.`
        }
        image={crew.banner_image_url || crew.profile_image_url}
        type='profile'
      />

      <PageTransition>
        <div className='cr'>
          <Toast ref={toast} />

          {/* --- Banda --- */}
          <header className='cr-banda'>
            <div className='cr-portada' aria-hidden='true'>
              {crew.banner_image_url && (
                <img src={crew.banner_image_url} alt='' fetchPriority='high' />
              )}
              <div className='cr-velo' />
            </div>

            <div className='cr-banda-caja'>
              <button
                type='button'
                className='cr-volver'
                onClick={() => navigate(-1)}
                aria-label='Volver'
              >
                <ArrowLeft size={18} />
              </button>

              <div className='cr-identidad'>
                <Avatar
                  image={crew.profile_image_url}
                  icon={!crew.profile_image_url ? 'pi pi-shield' : null}
                  shape='circle'
                  className='cr-escudo'
                />

                <div className='cr-nombre-bloque'>
                  <span className='rotulo'>Crew</span>
                  <div className='cr-nombre-fila'>
                    <h1 className='cr-nombre'>{crew.name}</h1>
                    {isAdmin && <span className='cr-chip'>Eres admin</span>}
                  </div>
                  {crew.description && <p className='cr-desc'>{crew.description}</p>}
                </div>

                <div className='cr-acciones'>
                  {!session || !userStatus ? (
                    <button
                      type='button'
                      className='cr-accion principal'
                      onClick={solicitarUnirme}
                      disabled={ocupado}
                    >
                      <UserPlus size={16} />
                      Solicitar unirme
                    </button>
                  ) : userStatus === 'pending' ? (
                    <span className='cr-estado pendiente'>
                      <Clock size={15} aria-hidden='true' />
                      Solicitud pendiente
                    </span>
                  ) : (
                    <span className='cr-estado miembro'>
                      <Check size={15} aria-hidden='true' />
                      Miembro
                    </span>
                  )}

                  {esMiembro && !esFundador && (
                    confirmandoSalida ? (
                      <span className='cr-confirmar'>
                        <span>¿Seguro?</span>
                        <button type='button' className='cr-accion peligro' onClick={salir} disabled={ocupado}>
                          Sí, salir
                        </button>
                        <button type='button' className='cr-accion' onClick={() => setConfirmandoSalida(false)}>
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type='button'
                        className='cr-accion'
                        onClick={() => setConfirmandoSalida(true)}
                        aria-label='Salir de la crew'
                        title='Salir de la crew'
                      >
                        <LogOut size={16} />
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className='cr-cifras'>
                {[
                  { valor: members.length, etiqueta: 'Miembros' },
                  { valor: crewVehicles.length, etiqueta: 'Coches' },
                  ...(isAdmin
                    ? [{ valor: pendingRequests.length, etiqueta: 'Pendientes', atencion: pendingRequests.length > 0 }]
                    : []),
                ].map((c) => (
                  <div className={`cr-cifra ${c.atencion ? 'atencion' : ''}`} key={c.etiqueta}>
                    <span className='cr-cifra-valor datos'>{c.valor}</span>
                    <span className='cr-cifra-etiqueta'>{c.etiqueta}</span>
                  </div>
                ))}
              </div>
            </div>
          </header>

          {/* --- Peticiones: lo único que pide acción, así que va primero --- */}
          {isAdmin && pendingRequests.length > 0 && (
            <section className='cr-peticiones'>
              <div className='cr-peticiones-caja'>
                <header className='cr-peticiones-cabecera'>
                  <span className='rotulo'>Necesitan respuesta</span>
                  <h2 className='cr-seccion-titulo'>
                    {pendingRequests.length}{' '}
                    {pendingRequests.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}
                  </h2>
                </header>

                <ul className='cr-peticiones-lista'>
                  {pendingRequests.map((req) => (
                    <li className='cr-peticion' key={req.id}>
                      <button
                        type='button'
                        className='cr-peticion-quien'
                        onClick={() => navigate(`/usuario/${req.profiles?.username}`)}
                      >
                        <Avatar
                          image={req.profiles?.avatar_url}
                          icon={!req.profiles?.avatar_url ? 'pi pi-user' : null}
                          shape='circle'
                          className='cr-avatar-peq'
                        />
                        <span className='cr-peticion-nombre'>{req.profiles?.username}</span>
                      </button>

                      <div className='cr-peticion-botones'>
                        <button
                          type='button'
                          className='cr-resolver aceptar'
                          onClick={() => resolverSolicitud(req.id, 'approve', req.user_id)}
                          disabled={ocupado}
                          aria-label={`Aceptar a ${req.profiles?.username}`}
                        >
                          <Check size={15} />
                          Aceptar
                        </button>
                        <button
                          type='button'
                          className='cr-resolver rechazar'
                          onClick={() => resolverSolicitud(req.id, 'reject', req.user_id)}
                          disabled={ocupado}
                          aria-label={`Rechazar a ${req.profiles?.username}`}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* --- Pestañas --- */}
          <nav className='cr-pestanas' aria-label='Secciones de la crew'>
            {PESTANAS.map(({ id, etiqueta, icono: Icono }) => (
              <button
                key={id}
                type='button'
                className={`cr-pestana ${pestana === id ? 'activa' : ''}`}
                onClick={() => setPestana(id)}
                aria-current={pestana === id}
              >
                {id === 'canal' && !esMiembro ? (
                  <Lock size={16} aria-hidden='true' />
                ) : (
                  <Icono size={16} aria-hidden='true' />
                )}
                <span className='cr-pestana-texto'>{etiqueta}</span>
                {cantidades[id] !== null && (
                  <span className='cr-pestana-num datos'>{cantidades[id]}</span>
                )}
              </button>
            ))}
          </nav>

          {/* --- Contenido --- */}
          <div className='cr-contenido'>
            {pestana === 'canal' &&
              (esMiembro ? (
                <div className='cr-canal-caja'>
                  <CrewChat crewId={crew.id} crewName={crew.name} session={session} />
                </div>
              ) : (
                <div className='cr-vacio ambar'>
                  <Lock size={28} aria-hidden='true' />
                  <h2>Canal solo para miembros</h2>
                  <p>
                    {userStatus === 'pending'
                      ? 'Tu solicitud está pendiente. En cuanto un administrador la acepte, entrarás al canal.'
                      : session
                        ? 'Solicita unirte desde arriba. Cuando te acepten, podrás leer y escribir aquí.'
                        : 'Inicia sesión y solicita unirte a la crew para entrar al canal.'}
                  </p>
                  {!session && (
                    <button
                      type='button'
                      className='btn-librea'
                      onClick={() =>
                        navigate('/login', { state: { returnUrl: `/crew/${encodeURIComponent(crewName)}` } })
                      }
                    >
                      Iniciar sesión
                    </button>
                  )}
                </div>
              ))}

            {pestana === 'miembros' && (
              <div className='cr-miembros'>
                {members.map((m) => (
                  <button
                    type='button'
                    className='cr-miembro'
                    key={m.id}
                    onClick={() => navigate(`/usuario/${m.profiles?.username}`)}
                  >
                    <Avatar
                      image={m.profiles?.avatar_url}
                      icon={!m.profiles?.avatar_url ? 'pi pi-user' : null}
                      shape='circle'
                      className='cr-miembro-avatar'
                    />
                    <span className='cr-miembro-texto'>
                      <span className='cr-miembro-nombre'>{m.profiles?.username}</span>
                      <span className={`cr-miembro-rol ${m.role === 'admin' ? 'fundador' : ''}`}>
                        {m.role === 'admin' ? 'Fundador' : 'Miembro'}
                      </span>
                    </span>
                    <span className='cr-miembro-coches datos'>
                      {m.profiles?.vehicles?.length || 0}
                      <Car size={12} aria-hidden='true' />
                    </span>
                  </button>
                ))}
              </div>
            )}

            {pestana === 'garaje' &&
              (crewVehicles.length > 0 ? (
                <div className='cr-rejilla'>
                  {crewVehicles.map((v) => (
                    <TarjetaCoche
                      key={v.id}
                      vehiculo={v}
                      onAbrir={(owner) => navigate(`/usuario/${owner}`)}
                    />
                  ))}
                </div>
              ) : (
                <div className='cr-vacio'>
                  <Car size={28} aria-hidden='true' />
                  <h2>El garaje de la crew está vacío</h2>
                  <p>Cuando los miembros suban sus coches, aparecerán aquí.</p>
                </div>
              ))}
          </div>
        </div>
      </PageTransition>
    </>
  )
}

export default CrewDetailPage
